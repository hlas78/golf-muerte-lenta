import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { allocateStrokes, calculatePayments } from "@/lib/scoring";
import Config from "@/lib/models/Config";
import { verifyToken } from "@/lib/auth";

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
