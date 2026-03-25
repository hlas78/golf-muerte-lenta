import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Round from "@/lib/models/Round";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";

const pad2 = (value) => String(value).padStart(2, "0");

const formatDate = (date) => {
  if (!date) {
    return "";
  }
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) {
    return "";
  }
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(
    next.getDate()
  )}`;
};

const buildRange = (start, end) => {
  const today = new Date();
  const fallbackStart = new Date(today);
  fallbackStart.setMonth(fallbackStart.getMonth() - 1);
  const startDate = start ? new Date(`${start}T00:00:00`) : fallbackStart;
  const endDate = end ? new Date(`${end}T23:59:59.999`) : today;
  return { startDate, endDate };
};

export async function GET(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.id);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const { startDate, endDate } = buildRange(start, end);

  const rounds = await Round.find({
    status: "closed",
    $or: [
      { startedAt: { $gte: startDate, $lte: endDate } },
      {
        startedAt: { $exists: false },
        createdAt: { $gte: startDate, $lte: endDate },
      },
      {
        startedAt: null,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    ],
  }).sort({ startedAt: 1, createdAt: 1 });

  if (rounds.length === 0) {
    return NextResponse.json({ columns: [], rows: [] });
  }

  const roundIds = rounds.map((round) => round._id);
  const payments = await Payment.find({ round: { $in: roundIds } }).lean();

  const playerIds = new Set();
  rounds.forEach((round) => {
    (round.players || []).forEach((playerId) =>
      playerIds.add(String(playerId))
    );
  });
  payments.forEach((payment) => {
    if (payment.from) playerIds.add(String(payment.from));
    if (payment.to) playerIds.add(String(payment.to));
  });

  const players = await User.find({ _id: { $in: Array.from(playerIds) } })
    .select("name")
    .lean();
  const playerById = players.reduce((acc, player) => {
    acc[String(player._id)] = player;
    return acc;
  }, {});

  const columns = rounds.map((round) => {
    const dateValue = round.startedAt || round.createdAt;
    return {
      id: String(round._id),
      label: formatDate(dateValue),
      date: dateValue,
    };
  });

  const rowsByPlayer = {};
  Array.from(playerIds).forEach((playerId) => {
    rowsByPlayer[playerId] = {
      playerId,
      name: playerById[playerId]?.name || "Jugador",
      values: {},
      total: 0,
      roundsCount: 0,
    };
  });

  rounds.forEach((round) => {
    (round.players || []).forEach((playerId) => {
      const key = String(playerId);
      if (rowsByPlayer[key]) {
        rowsByPlayer[key].roundsCount += 1;
      }
    });
  });

  payments.forEach((payment) => {
    const roundId = String(payment.round);
    const amount = Number(payment.amount) || 0;
    const fromId = payment.from ? String(payment.from) : null;
    const toId = payment.to ? String(payment.to) : null;

    if (fromId && rowsByPlayer[fromId]) {
      rowsByPlayer[fromId].values[roundId] =
        (rowsByPlayer[fromId].values[roundId] || 0) - amount;
      rowsByPlayer[fromId].total -= amount;
    }
    if (toId && rowsByPlayer[toId]) {
      rowsByPlayer[toId].values[roundId] =
        (rowsByPlayer[toId].values[roundId] || 0) + amount;
      rowsByPlayer[toId].total += amount;
    }
  });

  const rows = Object.values(rowsByPlayer).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return NextResponse.json({
    columns,
    rows,
    range: { start: formatDate(startDate), end: formatDate(endDate) },
  });
}
