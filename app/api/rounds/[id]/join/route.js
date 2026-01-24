import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { WELCOME_MESSAGES } from "@/lib/welcomeMessages";

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

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
    const campo =
      round.courseSnapshot?.clubName || round.courseSnapshot?.courseName || "el campo";
    const template =
      WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    const message = template.replace("{campo}", campo);
    await sendMessage(user.phone, message);
  }
  return NextResponse.json({ ok: true });
}
