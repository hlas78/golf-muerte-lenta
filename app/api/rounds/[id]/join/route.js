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
  const authPayload = verifyToken(token);
  const payload = await request.json();
  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (String(payload.playerId) !== String(authPayload.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await User.findById(payload.playerId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.status !== "active") {
    return NextResponse.json(
      { error: "Solo los jugadores activos pueden unirse a la jugada." },
      { status: 400 }
    );
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  if (user.handicap == null || user.handicap === 0) {
    return NextResponse.json(
      { error: "Handicap requerido" },
      { status: 400 }
    );
  }
  const teeName = payload.teeName;
  if (!teeName) {
    return NextResponse.json({ error: "Tee requerido" }, { status: 400 });
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const validTee = allTees.some((option) => option.tee_name === teeName);
  if (!validTee) {
    return NextResponse.json({ error: "Tee invalido" }, { status: 400 });
  }

  const alreadyJoined = round.players.includes(payload.playerId);
  if (!alreadyJoined) {
    round.players.push(payload.playerId);
  }
  const existing = round.playerTees?.find(
    (entry) => String(entry.player) === String(payload.playerId)
  );
  if (existing) {
    existing.teeName = teeName;
  } else {
    round.playerTees = round.playerTees || [];
    round.playerTees.push({ player: payload.playerId, teeName });
  }
  round.status = "active";
  await round.save();
  if (!alreadyJoined) {
    if (!user.magicToken) {
      user.magicToken = crypto.randomBytes(24).toString("hex");
      user.magicTokenCreatedAt = new Date();
      await user.save();
    }
    const campo =
      round.courseSnapshot?.clubName || round.courseSnapshot?.courseName || "el campo";
    const creator = round.createdBy
      ? await User.findById(round.createdBy)
      : null;
    const playerTee =
      round.playerTees?.find(
        (entry) => String(entry.player) === String(user._id)
      )?.teeName || teeName;
    const groupNumber =
      round.playerGroups?.find(
        (entry) => String(entry.player) === String(user._id)
      )?.group || null;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || allTees[0];
    const courseHandicap = getCourseHandicapForRound(
      tee,
      round,
      user.handicap
    );
    const existingCard = await Scorecard.findOne({
      round: round._id,
      player: user._id,
    });
    if (!existingCard) {
      await Scorecard.create({
        round: round._id,
        player: user._id,
        teeName: tee?.tee_name || playerTee || "",
        courseHandicap,
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
    const now = new Date();
    if ((!round.startedAt || round.startedAt <= now) && !round.welcomeSentAt) {
      const participantIds = Array.from(new Set(round.players || [])).map(String);
      const participants = await User.find({ _id: { $in: participantIds } });
      const roster = participants
        .map((participant) => {
          const participantTeeName =
            round.playerTees?.find(
              (entry) => String(entry.player) === String(participant._id)
            )?.teeName || "";
          const participantTee =
            allTees.find((option) => option.tee_name === participantTeeName) ||
            allTees[0];
          return {
            name: participant.name,
            handicap: participant.handicap ?? 0,
            teeName: participantTee?.tee_name || participantTeeName,
            courseHandicap: participantTee
              ? getCourseHandicapForRound(
                  participantTee,
                  round,
                  participant.handicap
                )
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
  }
  return NextResponse.json({ ok: true });
}
