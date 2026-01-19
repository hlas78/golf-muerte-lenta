import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";

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
