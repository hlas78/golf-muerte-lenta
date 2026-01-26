import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { buildWelcomeMessage } from "@/lib/welcomeMessageBuilder";

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
    const recordLink = buildRecordLink(round._id, user.magicToken);
    const message = buildWelcomeMessage({
      campo,
      creatorName: creator?.name || "sin nombre",
      description: round.description || "",
      recordLink,
    });
    const playerTee =
      round.playerTees?.find(
        (entry) => String(entry.player) === String(user._id)
      )?.teeName || teeName;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || allTees[0];
    const holesCount = round.holes;
    const parTotal =
      holesCount === 9
        ? tee?.holes?.slice(0, 9).reduce((sum, hole) => sum + (hole.par || 0), 0)
        : tee?.par_total ??
          tee?.holes?.slice(0, holesCount).reduce(
            (sum, hole) => sum + (hole.par || 0),
            0
          );
    const courseRating =
      holesCount === 9 ? tee?.front_course_rating : tee?.course_rating;
    const slopeRating =
      holesCount === 9 ? tee?.front_slope_rating : tee?.slope_rating;
    const courseHandicap =
      courseRating && slopeRating && Number.isFinite(user.handicap)
        ? Math.round(
            user.handicap * (slopeRating / 113) + (courseRating - parTotal)
          )
        : user.handicap || 0;
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
    await sendMessage(user.phone, message);
  }
  return NextResponse.json({ ok: true });
}
