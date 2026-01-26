import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

export async function GET(request, { params }) {
  await connectDb();
  const { id } = await params;
  const round = await Round.findById(id)
    .populate("players", "-passwordHash")
    .populate("supervisor", "-passwordHash");
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  return NextResponse.json(round);
}

export async function DELETE(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const admin = await User.findById(payload.id);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  await Payment.deleteMany({ round: round._id });
  await Scorecard.deleteMany({ round: round._id });
  await Round.deleteOne({ _id: round._id });

  return NextResponse.json({ ok: true });
}
