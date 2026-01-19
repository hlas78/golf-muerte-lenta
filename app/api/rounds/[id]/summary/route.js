import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import Payment from "@/lib/models/Payment";
import Scorecard from "@/lib/models/Scorecard";

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

export async function GET(request, { params }) {
  await connectDb();
  const { id } = await params;
  const payments = await Payment.find({ round: id });
  const summary = buildSummary(payments);
  const scorecards = await Scorecard.find({ round: id }).populate(
    "player",
    "-passwordHash"
  );
  return NextResponse.json({ payments, summary, scorecards });
}
