import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
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
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status !== "closed") {
    return NextResponse.json({ error: "Round not closed" }, { status: 400 });
  }

  const hasPlayers = Array.isArray(round.players) && round.players.length > 0;
  round.status = hasPlayers ? "active" : "open";
  round.endedAt = null;
  await round.save();

  return NextResponse.json({ ok: true, status: round.status });
}
