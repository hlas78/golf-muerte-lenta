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
  const approver = await User.findById(payload.id);
  if (!approver) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, scorecardId } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  const isSupervisor =
    approver.role === "admin" ||
    String(round.supervisor) === String(approver._id);
  if (!isSupervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scorecard = await Scorecard.findById(scorecardId);
  if (!scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  scorecard.accepted = true;
  scorecard.acceptedBy = approver._id;
  await scorecard.save();

  return NextResponse.json({ ok: true });
}
