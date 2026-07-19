import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { buildRoundWelcomeGroupMessage } from "@/lib/welcomeMessageBuilder";
import { getCourseHandicapForRound } from "@/lib/scoring";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");
const WELCOME_GROUP_ID = "120363405357623444@g.us";

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
  if (user.status !== "active") {
    return NextResponse.json(
      { error: "Solo se pueden agregar jugadores activos." },
      { status: 400 }
    );
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
  const now = new Date();
  if ((!round.startedAt || round.startedAt <= now) && !round.welcomeSentAt) {
    const participantIds = Array.from(new Set(round.players || [])).map(String);
    const participants = await User.find({ _id: { $in: participantIds } });
    const tees = round.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const roster = participants
      .map((participant) => {
        const teeName =
          round.playerTees?.find(
            (entry) => String(entry.player) === String(participant._id)
          )?.teeName || "";
        const tee =
          allTees.find((option) => option.tee_name === teeName) || allTees[0];
        return {
          name: participant.name,
          handicap: participant.handicap ?? 0,
          teeName: tee?.tee_name || teeName,
          courseHandicap: tee
            ? getCourseHandicapForRound(tee, round, participant.handicap)
            : null,
          group:
            round.playerGroups?.find(
              (entry) => String(entry.player) === String(participant._id)
            )?.group || 99,
        };
      })
      .sort((a, b) => (a.group - b.group) || a.name.localeCompare(b.name));
    const message = buildRoundWelcomeGroupMessage({
      campo,
      description: round.description || "",
      startedAt: round.startedAt,
      players: roster,
    });
    await sendMessage(WELCOME_GROUP_ID, message);
    round.welcomeSentAt = new Date();
    round.welcomeSentPlayers = participantIds;
    await round.save();
  }

  return NextResponse.json({ ok: true });
}
