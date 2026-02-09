import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Course from "@/lib/models/Course";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

export async function POST(request) {
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

  const data = await request.json();
  if (!data?.round || !data?.players) {
    return NextResponse.json({ error: "Archivo invalido" }, { status: 400 });
  }

  const playersByPhone = new Map();
  const phones = data.players.map((player) => player.phone).filter(Boolean);
  if (phones.length > 0) {
    const users = await User.find({ phone: { $in: phones } });
    users.forEach((user) => playersByPhone.set(user.phone, user));
  }

  const mappedPlayers = data.players
    .map((player) => playersByPhone.get(player.phone))
    .filter(Boolean);

  if (mappedPlayers.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron jugadores en el sistema" },
      { status: 400 }
    );
  }

  const courseId = data.round.courseSnapshot?.courseId;
  const course = courseId
    ? await Course.findOne({ courseId })
    : null;

  const round = await Round.create({
    course: course?._id,
    courseSnapshot: data.round.courseSnapshot,
    teeName: data.round.teeName || "por-jugador",
    holes: data.round.holes || 18,
    nineType: data.round.nineType || "front",
    status: data.round.status || "open",
    createdBy: actor._id,
    supervisor: actor._id,
    players: mappedPlayers.map((player) => player._id),
    description: data.round.description || "",
    configSnapshot: data.round.configSnapshot,
    endedAt: data.round.endedAt || null,
  });

  const playerTees = Array.isArray(data.playerTees)
    ? data.playerTees
        .map((entry) => {
          const player = playersByPhone.get(entry.phone);
          if (!player) return null;
          return { player: player._id, teeName: entry.teeName };
        })
        .filter(Boolean)
    : [];
  if (playerTees.length > 0) {
    round.playerTees = playerTees;
    await round.save();
  }

  const scorecards = Array.isArray(data.scorecards) ? data.scorecards : [];
  if (scorecards.length > 0) {
    await Scorecard.insertMany(
      scorecards
        .map((card) => {
          const player = playersByPhone.get(card.phone);
          if (!player) return null;
          return {
            round: round._id,
            player: player._id,
            teeName: card.teeName,
            courseHandicap: card.courseHandicap,
            grossTotal: card.grossTotal,
            netTotal: card.netTotal,
            puttsTotal: card.puttsTotal,
            accepted: Boolean(card.accepted),
            holes: card.holes,
            grintUploadedAt: card.grintUploadedAt || null,
          };
        })
        .filter(Boolean)
    );
  }

  const payments = Array.isArray(data.payments) ? data.payments : [];
  if (payments.length > 0) {
    await Payment.insertMany(
      payments
        .map((payment) => {
          const from = playersByPhone.get(payment.fromPhone);
          const to = playersByPhone.get(payment.toPhone);
          if (!from || !to) return null;
          return {
            round: round._id,
            from: from._id,
            to: to._id,
            amount: payment.amount,
            item: payment.item,
            hole: payment.hole,
            note: payment.note,
          };
        })
        .filter(Boolean)
    );
  }

  const missingPlayers = data.players
    .filter((player) => !playersByPhone.has(player.phone))
    .map((player) => player.phone);

  return NextResponse.json({
    ok: true,
    id: round._id,
    missingPlayers,
  });
}
