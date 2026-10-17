import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import connectDb from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import User from "@/lib/models/User";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import { simulatePoolRound } from "@/lib/poolSimulation.mjs";

export async function GET(request, { params }) {
  const token = (await cookies()).get("gml_token")?.value;
  let auth;
  try {
    auth = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDb();
  const user = await User.findById(auth.id).select("role").lean();
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!mongoose.isObjectIdOrHexString(id)) {
    return NextResponse.json({ error: "Jugada inválida." }, { status: 400 });
  }
  const round = await Round.findById(id).lean();
  if (!round) return NextResponse.json({ error: "Jugada no encontrada." }, { status: 404 });
  if (round.status !== "closed") {
    return NextResponse.json({ error: "La simulación está disponible al cerrar la jugada." }, { status: 409 });
  }
  const [scorecards, payments] = await Promise.all([
    Scorecard.find({ round: id }).populate("player", "name").lean(),
    Payment.find({ round: id }).select("from to amount").lean(),
  ]);
  // Informational only: never persist payments or invoke settlement/message dispatch.
  return NextResponse.json(simulatePoolRound({ round, scorecards, payments, feeCents: 25000 }), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
