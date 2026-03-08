import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { buildWelcomeMessage } from "@/lib/welcomeMessageBuilder";
import { getCourseHandicapForRound } from "@/lib/scoring";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

function buildRecordLink(roundId, token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  return `${baseUrl}/rounds/${roundId}/record?${params.toString()}`;
}

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id);
  if (!actor || (actor.role !== "admin" && actor.role !== "supervisor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { playerId } = await request.json();
  if (!playerId) {
    return NextResponse.json(
      { error: "Jugador requerido." },
      { status: 400 }
    );
  }
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  const user = await User.findById(playerId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const preferred = String(user.defaultTeeName || "").toUpperCase();
  const fallback =
    allTees.find((option) => option.tee_name === "BLANCAS") || allTees[0];
  const selectedTee =
    (preferred && allTees.find((option) => option.tee_name === preferred)) ||
    fallback;
  if (!selectedTee) {
    return NextResponse.json({ error: "Sin tees disponibles." }, { status: 400 });
  }

  const alreadyJoined = (round.players || []).some(
    (entry) => String(entry) === String(playerId)
  );
  if (!alreadyJoined) {
    round.players = round.players || [];
    round.players.push(playerId);
  }
  const existing = round.playerTees?.find(
    (entry) => String(entry.player) === String(playerId)
  );
  if (existing) {
    existing.teeName = selectedTee.tee_name;
  } else {
    round.playerTees = round.playerTees || [];
    round.playerTees.push({ player: playerId, teeName: selectedTee.tee_name });
  }
  round.status = "active";
  await round.save();

  const existingCard = await Scorecard.findOne({
    round: round._id,
    player: user._id,
  });
  if (!existingCard) {
    await Scorecard.create({
      round: round._id,
      player: user._id,
      teeName: selectedTee.tee_name,
      courseHandicap: getCourseHandicapForRound(
        selectedTee,
        round,
        user.handicap
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
    });
  }

  if (!user.magicToken) {
    user.magicToken = crypto.randomBytes(24).toString("hex");
    user.magicTokenCreatedAt = new Date();
    await user.save();
  }
  const campo =
    round.courseSnapshot?.clubName || round.courseSnapshot?.courseName || "el campo";
  const creator = round.createdBy ? await User.findById(round.createdBy) : null;
  const recordLink = buildRecordLink(round._id, user.magicToken);
  const message = buildWelcomeMessage({
    campo,
    creatorName: creator?.name || "sin nombre",
    description: round.description || "",
    recordLink,
  });
  await sendMessage(user.phone, message);

  return NextResponse.json({ ok: true });
}
