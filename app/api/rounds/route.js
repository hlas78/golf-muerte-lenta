import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import crypto from "crypto";
import Round from "@/lib/models/Round";
import Course from "@/lib/models/Course";
import Config from "@/lib/models/Config";
import User from "@/lib/models/User";
import Scorecard from "@/lib/models/Scorecard";
import { verifyToken } from "@/lib/auth";
import {
  buildRoundWelcomeGroupMessage,
} from "@/lib/welcomeMessageBuilder";
import { getCourseHandicapForRound } from "@/lib/scoring";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");
const WELCOME_GROUP_ID = "120363405357623444@g.us";

async function dispatchRoundWelcomeMessage(roundId) {
  await connectDb();
  const round = await Round.findById(roundId).lean();
  if (!round || round.welcomeSentAt) {
    return;
  }

  const playerIds = Array.isArray(round.players)
    ? Array.from(new Set(round.players.map(String)))
    : [];
  if (playerIds.length === 0) {
    return;
  }

  const participants = await User.find({
    _id: { $in: playerIds },
    status: "active",
  }).lean();
  if (!participants.length) {
    return;
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const defaultTeeName =
    allTees.find((option) => option.tee_name === "BLANCAS")?.tee_name ||
    allTees[0]?.tee_name ||
    round.teeName ||
    "";
  const teeByPlayer = new Map(
    Array.isArray(round.playerTees)
      ? round.playerTees.map((entry) => [String(entry.player), entry.teeName])
      : []
  );
  const campo =
    round.courseSnapshot?.clubName ||
    round.courseSnapshot?.courseName ||
    "el campo";
  const roster = participants
    .map((player) => {
      const teeName = teeByPlayer.get(String(player._id)) || defaultTeeName;
      const selectedTee =
        allTees.find((option) => option.tee_name === teeName) || allTees[0];
      const courseHandicap = selectedTee
        ? getCourseHandicapForRound(selectedTee, round, player.handicap || 0)
        : null;
      return {
        name: player.name,
        handicap: player.handicap ?? 0,
        teeName,
        courseHandicap,
        group:
          round.playerGroups?.find(
            (entry) => String(entry.player) === String(player._id)
          )?.group || 99,
      };
    })
    .sort((a, b) => a.group - b.group || a.name.localeCompare(b.name));
  const message = buildRoundWelcomeGroupMessage({
    campo,
    description: round.description || "",
    startedAt: round.startedAt,
    players: roster,
  });

  await sendMessage(WELCOME_GROUP_ID, message);
  await Round.updateOne(
    { _id: roundId, welcomeSentAt: { $exists: false } },
    {
      $set: {
        welcomeSentAt: new Date(),
        welcomeSentPlayers: playerIds,
      },
    }
  );
}

async function getConfigSnapshot() {
  let config = await Config.findOne({ key: "global" });
  if (!config) {
    config = await Config.create({ key: "global" });
  }
  return config;
}

export async function GET() {
  await connectDb();
  const rounds = await Round.find()
    .populate(
      "supervisor",
      "name"
    )
    .populate(
      "players",
      "name"
    )
    .sort({ createdAt: -1 })
    .lean();

  const summarized = rounds.map((round) => ({
    _id: round._id,
    status: round.status,
    holes: round.holes,
    nineType: round.nineType,
    description: round.description || "",
    startedAt: round.startedAt,
    createdAt: round.createdAt,
    endedAt: round.endedAt,
    welcomeSentAt: round.welcomeSentAt,
    courseSnapshot: {
      clubName: round.courseSnapshot?.clubName || "",
      courseName: round.courseSnapshot?.courseName || "",
    },
    supervisor: round.supervisor
      ? {
          _id: round.supervisor._id,
          name: round.supervisor.name,
        }
      : null,
    players: Array.isArray(round.players)
      ? round.players.map((player) => ({
          _id: player._id,
          name: player.name,
        }))
      : [],
  }));

  return NextResponse.json(summarized);
}

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authPayload = verifyToken(token);
  const user = await User.findById(authPayload.id);
  if (!user || user.role === "player") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payload = await request.json();
  const course = await Course.findOne({
    courseId: payload.courseId,
    active: { $ne: false },
  });
  if (!course) {
    return NextResponse.json(
      { error: "Campo no encontrado o inactivo" },
      { status: 404 }
    );
  }
  const config = await getConfigSnapshot();

  const startedAtValue = payload.startedAt
    ? new Date(payload.startedAt)
    : null;
  const startedAt =
    startedAtValue && !Number.isNaN(startedAtValue.getTime())
      ? startedAtValue
      : new Date();

  const holesCount = Number(payload.holes) || 18;
  const nineType =
    holesCount === 9 ? payload.nineType || "front" : "front";
  const individualBets = Array.isArray(payload.individualBets)
    ? payload.individualBets.map((bet) => ({
        id: bet?.id,
        playerA: bet?.playerA,
        playerB: bet?.playerB,
        amounts: {
          front: Number(bet?.amounts?.front) || 0,
          back: Number(bet?.amounts?.back) || 0,
          round: Number(bet?.amounts?.round) || 0,
          hole: Number(bet?.amounts?.hole) || 0,
          birdie: Number(bet?.amounts?.birdie) || 0,
          sandy: Number(bet?.amounts?.sandy) || 0,
          wet: Number(bet?.amounts?.wet) || 0,
          ohYes: Number(bet?.amounts?.ohYes) || 0,
        },
      }))
    : [];
  const culebraConfig = {
    enabled: Boolean(payload?.culebra?.enabled),
    players: Array.isArray(payload?.culebra?.players)
      ? payload.culebra.players.map(String)
      : [],
    amount: Number(payload?.culebra?.amount) || 0,
  };
  const playerIds = Array.isArray(payload.players)
    ? Array.from(new Set(payload.players.map(String)))
    : [];
  let participants = [];
  if (playerIds.length > 0) {
    participants = await User.find({
      _id: { $in: playerIds },
      status: "active",
    });
    if (participants.length !== playerIds.length) {
      return NextResponse.json(
        { error: "Solo se pueden agregar jugadores activos." },
        { status: 400 }
      );
    }
  }
  const round = await Round.create({
    course: course?._id,
    courseSnapshot: course,
    teeName: payload.teeName || "por-jugador",
    holes: holesCount,
    nineType,
    status: "open",
    createdBy: payload.createdBy,
    supervisor: payload.supervisor,
    players: payload.players || [],
    description: payload.description || "",
    configSnapshot: {
      system: "group",
      bets: config.bets,
      individualBets,
      culebra: culebraConfig,
      notificationsMuted: true,
    },
    startedAt,
  });
  console.log('round: ', round)
  console.log('players:', playerIds)
  if (playerIds.length > 0) {
    const tees = course?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const defaultTeeName =
      allTees.find((option) => option.tee_name === "BLANCAS")?.tee_name ||
      allTees[0]?.tee_name ||
      round.teeName ||
      "";
    const requestedTees = Array.isArray(payload.playerTees)
      ? payload.playerTees.reduce((acc, entry) => {
          if (!entry?.player || !entry?.teeName) {
            return acc;
          }
          acc[String(entry.player)] = entry.teeName;
          return acc;
        }, {})
      : {};
    const requestedGroups = Array.isArray(payload.playerGroups)
      ? payload.playerGroups.reduce((acc, entry) => {
          if (!entry?.player || !entry?.group) {
            return acc;
          }
          acc[String(entry.player)] = Number(entry.group);
          return acc;
        }, {})
      : {};
    const teeByPlayer = new Map();
    participants.forEach((player) => {
      const requested = requestedTees[String(player._id)];
      const requestedValid =
        requested && allTees.find((option) => option.tee_name === requested);
      const preferred = String(player.defaultTeeName || "").toUpperCase();
      const valid =
        preferred && allTees.find((option) => option.tee_name === preferred);
      teeByPlayer.set(
        String(player._id),
        requestedValid?.tee_name || valid?.tee_name || defaultTeeName
      );
    });
    round.playerTees = playerIds.map((playerId) => ({
      player: playerId,
      teeName: teeByPlayer.get(String(playerId)) || defaultTeeName,
    }));
    round.playerGroups = playerIds.map((playerId) => ({
      player: playerId,
      group: requestedGroups[String(playerId)] || 1,
    }));
    round.groupMarshals = Array.isArray(payload.groupMarshals)
      ? payload.groupMarshals
          .filter((entry) => entry?.player && entry?.group)
          .map((entry) => ({
            player: entry.player,
            group: Number(entry.group),
          }))
      : [];
    round.status = "active";
    await round.save();
    console.log('Ronda guardada')

    await Scorecard.insertMany(
      participants.map((player) => ({
        round: round._id,
        player: player._id,
        teeName: teeByPlayer.get(String(player._id)) || defaultTeeName,
        courseHandicap: getCourseHandicapForRound(
          allTees.find(
            (option) =>
              option.tee_name === teeByPlayer.get(String(player._id))
          ) || allTees[0],
          round,
          player.handicap
        ),
        holes: Array.from({ length: round.holes }, (_, idx) => ({
          hole: idx + 1,
          strokes: null,
          putts: null,
          ohYes: false,
          sandy: false,
          penalties: [],
          bunker: false,
          water: false,
          holeOut: false,
        })),
      }))
    );
    console.log('Tarjetas creadas')
    const now = new Date();
    if (round.startedAt && round.startedAt <= now && !round.welcomeSentAt) {
      const roundId = String(round._id);
      setTimeout(() => {
        dispatchRoundWelcomeMessage(roundId).catch((error) => {
          console.error("Round welcome dispatch failed:", error);
        });
      }, 0);
    }
  }

  return NextResponse.json({ id: round._id });
}
