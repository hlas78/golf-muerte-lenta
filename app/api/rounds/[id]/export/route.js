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

  const { id } = await params;
  const round = await Round.findById(id)
    .populate("players", "-passwordHash")
    .lean();
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const scorecards = await Scorecard.find({ round: round._id })
    .populate("player", "-passwordHash")
    .lean();
  const payments = await Payment.find({ round: round._id }).lean();

  const players = (round.players || []).map((player) => ({
    phone: player.phone,
    name: player.name,
    handicap: player.handicap,
    role: player.role,
  }));
  const playerTees = (round.playerTees || []).map((entry) => {
    const player = (round.players || []).find(
      (p) => String(p._id) === String(entry.player)
    );
    return {
      phone: player?.phone || null,
      teeName: entry.teeName,
    };
  });

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    round: {
      holes: round.holes,
      nineType: round.nineType,
      teeName: round.teeName,
      status: round.status,
      description: round.description || "",
      createdAt: round.createdAt,
      endedAt: round.endedAt || null,
      courseSnapshot: round.courseSnapshot,
      configSnapshot: round.configSnapshot,
    },
    players,
    playerTees,
    scorecards: scorecards.map((card) => ({
      phone: card.player?.phone || null,
      teeName: card.teeName,
      courseHandicap: card.courseHandicap,
      grossTotal: card.grossTotal,
      netTotal: card.netTotal,
      puttsTotal: card.puttsTotal,
      accepted: card.accepted,
      holes: card.holes,
      grintUploadedAt: card.grintUploadedAt || null,
    })),
    payments: payments.map((payment) => {
      const fromPlayer = (round.players || []).find(
        (p) => String(p._id) === String(payment.from)
      );
      const toPlayer = (round.players || []).find(
        (p) => String(p._id) === String(payment.to)
      );
      return {
        fromPhone: fromPlayer?.phone || null,
        toPhone: toPlayer?.phone || null,
        amount: payment.amount,
        item: payment.item,
        hole: payment.hole,
        note: payment.note,
      };
    }),
  };

  return NextResponse.json(exportPayload);
}
