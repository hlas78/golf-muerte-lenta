import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { getCourseHandicapForRound } from "@/lib/scoring";

export async function PUT(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id);
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, playerId } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  const isSupervisor = actor.role === "admin" || actor.role === "supervisor";
  const isSelf = String(actor._id) === String(playerId);
  if (!isSupervisor && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }

  const body = await request.json();
  const teeName = body.teeName;
  if (!teeName) {
    return NextResponse.json({ error: "Tee requerido" }, { status: 400 });
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const validTee = allTees.some((option) => option.tee_name === teeName);
  if (!validTee) {
    return NextResponse.json({ error: "Tee invalido" }, { status: 400 });
  }

  const existing = round.playerTees?.find(
    (entry) => String(entry.player) === String(playerId)
  );
  if (existing) {
    existing.teeName = teeName;
  } else {
    round.playerTees = round.playerTees || [];
    round.playerTees.push({ player: playerId, teeName });
  }

  const player = await User.findById(playerId);
  const selectedTee = allTees.find((option) => option.tee_name === teeName);
  if (player && selectedTee) {
    const courseHandicap = getCourseHandicapForRound(
      selectedTee,
      round,
      player.handicap
    );
    console.log(`${round.courseSnapshot.clubName} handicap: ${courseHandicap}`)
    await Scorecard.findOneAndUpdate(
      { round: round._id, player: player._id },
      { teeName, courseHandicap }
    );
  }

  await round.save();
  return NextResponse.json({ ok: true });
}
