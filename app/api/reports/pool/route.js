import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import { buildPoolReport } from "@/lib/poolSimulation.mjs";

export async function GET(request) {
  const token = (await cookies()).get("gml_token")?.value;
  let auth;
  try {
    auth = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDb();
  const user = await User.findById(auth.id).select("role").lean();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const start = query.get("start");
  const end = query.get("end");
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const fee = query.get("fee") || "250";
  const feeCents = Math.round(Number(fee) * 100);
  if (!validDate(start) || !validDate(end) || start > end) return NextResponse.json({ error: "Selecciona un rango de fechas válido." }, { status: 400 });
  if (!/^\d+(\.\d{1,2})?$/.test(fee) || !Number.isSafeInteger(feeCents) || feeCents <= 0 || feeCents > 100000000) {
    return NextResponse.json({ error: "La cuota debe ser positiva, con máximo dos decimales y hasta $1,000,000." }, { status: 400 });
  }
  // Mexico City dates, independent of the server's timezone.
  const range = { $gte: new Date(`${start}T00:00:00-06:00`), $lte: new Date(`${end}T23:59:59.999-06:00`) };
  const rounds = await Round.find({ status: "closed", holes: 18, $or: [
    { startedAt: range }, { startedAt: null, createdAt: range },
  ] }).sort({ startedAt: -1, createdAt: -1 }).lean();
  const roundIds = rounds.map((round) => round._id);
  const [scorecards, payments] = await Promise.all([
    Scorecard.find({ round: { $in: roundIds } }).populate("player", "name").lean(),
    Payment.find({ round: { $in: roundIds } }).select("round from to amount").lean(),
  ]);
  return NextResponse.json({ ...buildPoolReport({ rounds, scorecards, payments, feeCents }), range: { start, end } });
}
