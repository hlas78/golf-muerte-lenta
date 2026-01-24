import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { allocateStrokes, calculatePayments } from "@/lib/scoring";
import Config from "@/lib/models/Config";
import { verifyToken } from "@/lib/auth";
import { WIN_MESSAGES } from "@/lib/winMessages";
import { PENALTY_MESSAGES } from "@/lib/penaltyMessages";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

const pendingWinNotifications = new Map();
const pendingPenaltyNotifications = new Map();

export async function GET(request, { params }) {
  await connectDb();
  const { id } = await params;
  const scorecards = await Scorecard.find({ round: id })
    .populate("player", "-passwordHash")
    .sort({ createdAt: 1 });
  const allAccepted =
    scorecards.length > 0 && scorecards.every((card) => card.accepted);
  return NextResponse.json({ scorecards, allAccepted });
}

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authPayload = verifyToken(token);
  const payload = await request.json();
  const { id } = await params;
  const round = await Round.findById(id);
  const authUser = await User.findById(authPayload.id);
  const player = await User.findById(payload.playerId);
  if (!round || !player) {
    return NextResponse.json({ error: "Invalid round/player" }, { status: 404 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isSupervisor =
    authUser.role === "admin" ||
    String(round.supervisor) === String(authUser._id);
  if (!isSupervisor && String(payload.playerId) !== String(authPayload.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isInRound = round.players?.some(
    (playerId) => String(playerId) === String(payload.playerId)
  );
  if (!isInRound) {
    return NextResponse.json({ error: "Player not joined" }, { status: 400 });
  }
  if (round.status === "closed") {
    return NextResponse.json(
      { error: "Round closed" },
      { status: 400 }
    );
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const playerTee =
    round.playerTees?.find(
      (entry) => String(entry.player) === String(player._id)
    )?.teeName || round.teeName;
  const tee =
    allTees.find((option) => option.tee_name === playerTee) || allTees[0];
  if (!tee) {
    return NextResponse.json({ error: "Tee requerido" }, { status: 400 });
  }
  const holeHandicaps =
    tee?.holes?.map((hole, idx) => ({
      hole: idx + 1,
      handicap: hole.handicap,
    })) || [];

  const holes = payload.holes || [];
  const previous = await Scorecard.findOne({
    round: round._id,
    player: player._id,
  });
  const grossTotal = holes
    .slice(0, round.holes)
    .reduce((sum, hole) => sum + (hole.strokes || 0), 0);
  const puttsTotal = holes
    .slice(0, round.holes)
    .reduce((sum, hole) => sum + (hole.putts || 0), 0);

  const strokesMap = allocateStrokes(
    player.handicap || 0,
    holeHandicaps,
    round.holes
  );
  const netTotal = holes.slice(0, round.holes).reduce((sum, hole) => {
    const strokes = hole.strokes || 0;
    const net = strokes - (strokesMap[hole.hole] || 0);
    return sum + net;
  }, 0);

  const scorecard = await Scorecard.findOneAndUpdate(
    { round: round._id, player: player._id },
    {
      round: round._id,
      player: player._id,
      teeName: tee?.tee_name || playerTee || "",
      holes,
      grossTotal,
      puttsTotal,
      netTotal,
    },
    { upsert: true, new: true }
  );

  const getWinningEvents = (hole) => {
    const events = [];
    if (!hole || hole.par == null || hole.strokes == null) {
      return events;
    }
    const diff = hole.strokes - hole.par;
    if (diff === -1) events.push("birdie");
    if (diff === -2) events.push("eagle");
    if (diff <= -3) events.push("albatross");
    if (hole.sandy) events.push("sandy");
    const isHoleOut =
      hole.putts === 0 &&
      (hole.holeOut || (hole.par != null && hole.strokes <= hole.par));
    if (isHoleOut) events.push("holeOut");
    if (hole.water && hole.strokes === hole.par) events.push("wetPar");
    if (hole.par === 3 && hole.ohYes) events.push("ohYes");
    return events;
  };

  const previousEvents = new Map();
  if (previous?.holes?.length) {
    previous.holes.forEach((hole) => {
      previousEvents.set(hole.hole, new Set(getWinningEvents(hole)));
    });
  }

  const currentEvents = new Map();
  holes.forEach((hole) => {
    if (!hole?.hole) {
      return;
    }
    currentEvents.set(hole.hole, new Set(getWinningEvents(hole)));
  });

  const newEvents = [];
  holes.forEach((hole) => {
    if (!hole?.hole) {
      return;
    }
    const prev = previousEvents.get(hole.hole) || new Set();
    const current = currentEvents.get(hole.hole) || new Set();
    prev.forEach((event) => {
      if (!current.has(event)) {
        const key = `${round._id}:${player._id}:${hole.hole}:${event}`;
        const pending = pendingWinNotifications.get(key);
        if (pending?.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pendingWinNotifications.delete(key);
      }
    });
    getWinningEvents(hole).forEach((event) => {
      if (!prev.has(event)) {
        newEvents.push({ hole: hole.hole, event });
      }
    });
  });

  if (newEvents.length > 0) {
    const itemLabels = {
      birdie: "Birdie",
      eagle: "Aguila",
      albatross: "Albatross",
      sandy: "Sandy",
      holeOut: "Hole out",
      wetPar: "Wet par",
      ohYes: "Oh yes",
    };

    newEvents.forEach((event) => {
      const key = `${round._id}:${player._id}:${event.hole}:${event.event}`;
      const existing = pendingWinNotifications.get(key);
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      const timeoutId = setTimeout(async () => {
        try {
          await connectDb();
          const latestRound = await Round.findById(round._id);
          const latestPlayer = await User.findById(player._id);
          const latestCard = await Scorecard.findOne({
            round: round._id,
            player: player._id,
          });
          const latestHole = latestCard?.holes?.find(
            (hole) => hole.hole === event.hole
          );
          const latestEvents = new Set(getWinningEvents(latestHole));
          if (!latestEvents.has(event.event)) {
            return;
          }
          const participants = await User.find({
            _id: { $in: Array.from(new Set(latestRound?.players || [])) },
          });
          const campo =
            latestRound?.courseSnapshot?.clubName ||
            latestRound?.courseSnapshot?.courseName ||
            "el campo";
          const template =
            WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)];
          const message = template
            .replace("{campo}", campo)
            .replace("{player}", latestPlayer?.name || "Jugador")
            .replace("{item}", itemLabels[event.event] || event.event)
            .replace("{hole}", event.hole);
          await Promise.allSettled(
            participants.map((participant) =>
              sendMessage(participant.phone, message)
            )
          );
        } finally {
          pendingWinNotifications.delete(key);
        }
      }, 300000);
      pendingWinNotifications.set(key, { timeoutId });
    });
  }

  const previousPenalties = new Map();
  if (previous?.holes?.length) {
    previous.holes.forEach((hole) => {
      previousPenalties.set(
        hole.hole,
        new Set(Array.isArray(hole.penalties) ? hole.penalties : [])
      );
    });
  }

  const currentPenalties = new Map();
  holes.forEach((hole) => {
    if (!hole?.hole) {
      return;
    }
    currentPenalties.set(
      hole.hole,
      new Set(Array.isArray(hole.penalties) ? hole.penalties : [])
    );
  });

  const newPenalties = [];
  holes.forEach((hole) => {
    if (!hole?.hole) {
      return;
    }
    const prev = previousPenalties.get(hole.hole) || new Set();
    const current = currentPenalties.get(hole.hole) || new Set();
    prev.forEach((penalty) => {
      if (!current.has(penalty)) {
        const key = `${round._id}:${player._id}:${hole.hole}:${penalty}`;
        const pending = pendingPenaltyNotifications.get(key);
        if (pending?.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pendingPenaltyNotifications.delete(key);
      }
    });
    current.forEach((penalty) => {
      if (!prev.has(penalty)) {
        newPenalties.push({ hole: hole.hole, penalty });
      }
    });
  });

  if (newPenalties.length > 0) {
    const penaltyLabels = {
      pinkies: "Pinkies",
      cuatriputt: "Cuatriputt",
      saltapatras: "Saltapatras",
      paloma: "Paloma",
      nerdina: "Nerdiña",
      whiskeys: "Whiskeys",
    };
    newPenalties.forEach((event) => {
      const key = `${round._id}:${player._id}:${event.hole}:${event.penalty}`;
      const existing = pendingPenaltyNotifications.get(key);
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      const timeoutId = setTimeout(async () => {
        try {
          await connectDb();
          const latestRound = await Round.findById(round._id);
          const latestPlayer = await User.findById(player._id);
          const latestCard = await Scorecard.findOne({
            round: round._id,
            player: player._id,
          });
          const latestHole = latestCard?.holes?.find(
            (hole) => hole.hole === event.hole
          );
          const latestPenalties = new Set(
            Array.isArray(latestHole?.penalties) ? latestHole.penalties : []
          );
          if (!latestPenalties.has(event.penalty)) {
            return;
          }
          const participants = await User.find({
            _id: { $in: Array.from(new Set(latestRound?.players || [])) },
          });
          const campo =
            latestRound?.courseSnapshot?.clubName ||
            latestRound?.courseSnapshot?.courseName ||
            "el campo";
          const template =
            PENALTY_MESSAGES[
              Math.floor(Math.random() * PENALTY_MESSAGES.length)
            ];
          const message = template
            .replace("{campo}", campo)
            .replace("{player}", latestPlayer?.name || "Jugador")
            .replace("{penalty}", penaltyLabels[event.penalty] || event.penalty)
            .replace("{hole}", event.hole);
          await Promise.allSettled(
            participants.map((participant) =>
              sendMessage(participant.phone, message)
            )
          );
        } finally {
          pendingPenaltyNotifications.delete(key);
        }
      }, 300000);
      pendingPenaltyNotifications.set(key, { timeoutId });
    });
  }

  return NextResponse.json({ id: scorecard._id });
}

export async function PUT(request, { params }) {
  await connectDb();
  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const scorecards = await Scorecard.find({ round: round._id })
    .populate("player", "-passwordHash")
    .sort({ createdAt: 1 });
  const allAccepted =
    scorecards.length > 0 && scorecards.every((card) => card.accepted);

  const config = await Config.findOne({ key: "global" });
  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const fallbackTee =
    allTees.find((option) => option.tee_name === round.teeName) || allTees[0];
  const holeHandicaps =
    fallbackTee?.holes?.map((hole, idx) => ({
      hole: idx + 1,
      handicap: hole.handicap,
      par: hole.par,
    })) || [];

  const holeHandicapsByPlayer = {};
  scorecards.forEach((card) => {
    const playerTee =
      card.teeName ||
      round.playerTees?.find(
        (entry) => String(entry.player) === String(card.player?._id)
      )?.teeName;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || fallbackTee;
    holeHandicapsByPlayer[card.player?._id?.toString()] =
      tee?.holes?.map((hole, idx) => ({
        hole: idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || holeHandicaps;
  });

  const payments = calculatePayments({
    config: config || { bets: round.configSnapshot },
    round,
    scorecards,
    holeHandicaps,
    holeHandicapsByPlayer,
  });

  return NextResponse.json({ payments, allAccepted });
}
