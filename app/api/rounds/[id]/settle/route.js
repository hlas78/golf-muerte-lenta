import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import Config from "@/lib/models/Config";
import { verifyToken } from "@/lib/auth";
import { calculatePayments } from "@/lib/scoring";

function buildSummary(payments) {
  const summary = {};
  payments.forEach((payment) => {
    const from = String(payment.from);
    const to = String(payment.to);
    summary[from] = (summary[from] || 0) - payment.amount;
    summary[to] = (summary[to] || 0) + payment.amount;
  });
  return summary;
}

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

  const { id } = await params;
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

  const scorecards = await Scorecard.find({ round: round._id })
    .populate("player", "-passwordHash")
    .sort({ createdAt: 1 });
  const config = await Config.findOne({ key: "global" });
  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const fallbackTee =
    allTees.find((option) => option.tee_name === round.teeName) || allTees[0];
  const holeHandicaps =
    fallbackTee?.holes?.map((hole, idx) => ({
      hole: idx + 1,
      handicap: hole.handicap,
      par: hole.par,
    })) || [];

  const holeHandicapsByPlayer = {};
  scorecards.forEach((card) => {
    const playerTee =
      card.teeName ||
      round.playerTees?.find(
        (entry) => String(entry.player) === String(card.player?._id)
      )?.teeName;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || fallbackTee;
    holeHandicapsByPlayer[card.player?._id?.toString()] =
      tee?.holes?.map((hole, idx) => ({
        hole: idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || holeHandicaps;
  });

  const payments = calculatePayments({
    config: config || { bets: round.configSnapshot },
    round,
    scorecards,
    holeHandicaps,
    holeHandicapsByPlayer,
  });

  await Payment.deleteMany({ round: round._id });
  await Payment.insertMany(
    payments.map((payment) => ({
      ...payment,
      round: round._id,
    }))
  );

  const summary = buildSummary(payments);

  return NextResponse.json({ payments, summary });
}
