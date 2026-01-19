import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
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
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  const isSupervisor =
    actor.role === "admin" ||
    String(round.supervisor) === String(actor._id);
  if (!isSupervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scorecards = await Scorecard.find({ round: round._id });
  const allAccepted =
    scorecards.length > 0 && scorecards.every((card) => card.accepted);
  if (!allAccepted) {
    return NextResponse.json(
      { error: "Faltan tarjetas por aceptar" },
      { status: 400 }
    );
  }

  round.status = "closed";
  round.endedAt = new Date();
  await round.save();

  return NextResponse.json({ ok: true });
}
