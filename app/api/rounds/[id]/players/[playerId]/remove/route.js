import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

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

  const { id, playerId } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }

  round.players = (round.players || []).filter(
    (player) => String(player) !== String(playerId)
  );
  round.playerTees = (round.playerTees || []).filter(
    (entry) => String(entry.player) !== String(playerId)
  );
  await round.save();

  await Scorecard.deleteMany({ round: round._id, player: playerId });
  await Payment.deleteMany({
    round: round._id,
    $or: [{ from: playerId }, { to: playerId }],
  });

  return NextResponse.json({ ok: true });
}
