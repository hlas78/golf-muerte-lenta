import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { createRequire } from "module";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import Config from "@/lib/models/Config";
import {
  allocateStrokes,
  calculatePayments,
  getCourseHandicapForRound,
  normalizeHoleHandicaps,
} from "@/lib/scoring";
import { verifyToken } from "@/lib/auth";
import { sendMessageWithRandomDelay } from "@/lib/welcomeMessageDispatch";
import {
  SARCASTIC_MESSAGES,
  buildPlayerSettlementMessages,
} from "@/lib/settlementMessages";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

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

function minimizeTransfers(summary) {
  const debtors = [];
  const creditors = [];
  Object.entries(summary).forEach(([playerId, amount]) => {
    if (amount < 0) {
      debtors.push({ playerId, amount: Math.abs(amount) });
    } else if (amount > 0) {
      creditors.push({ playerId, amount });
    }
  });

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({
        from: debtors[i].playerId,
        to: creditors[j].playerId,
        amount: pay,
      });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
    }
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

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
  const isSupervisor = actor.role === "admin" || actor.role === "supervisor";
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

  const config = await Config.findOne({ key: "global" });
  const calcTees = round.courseSnapshot?.tees || {};
  const calcAllTees = [...(calcTees.male || []), ...(calcTees.female || [])];
  const calcFallbackTee =
    calcAllTees.find((option) => option.tee_name === round.teeName) ||
    calcAllTees[0];
  const calcNormalizedFallbackHoles = normalizeHoleHandicaps(
    calcFallbackTee?.holes || [],
    round
  );
  const calcHoleHandicaps =
    calcNormalizedFallbackHoles.map((hole, idx) => ({
      hole: hole.hole ?? idx + 1,
      handicap: hole.handicap,
      par: hole.par,
    })) || [];

  const calcHoleHandicapsByPlayer = {};
  const calcPopulatedScorecards = await Scorecard.find({ round: round._id })
    .populate(
      "player",
      "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted -grintScoreHistory"
    )
    .sort({ createdAt: 1 });
  calcPopulatedScorecards.forEach((card) => {
    const playerTee =
      card.teeName ||
      round.playerTees?.find(
        (entry) => String(entry.player) === String(card.player?._id)
      )?.teeName;
    const tee =
      calcAllTees.find((option) => option.tee_name === playerTee) ||
      calcFallbackTee;
    const normalizedPlayerHoles = normalizeHoleHandicaps(
      tee?.holes || [],
      round
    );
    calcHoleHandicapsByPlayer[card.player?._id?.toString()] =
      normalizedPlayerHoles.map((hole, idx) => ({
        hole: hole.hole ?? idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || calcHoleHandicaps;

    const courseHandicap = getCourseHandicapForRound(
      tee,
      round,
      card.player?.handicap
    );
    const strokesMap = allocateStrokes(
      courseHandicap,
      calcHoleHandicapsByPlayer[card.player?._id?.toString()] ||
        calcHoleHandicaps,
      round.holes
    );
    const netTotal = (card.holes || [])
      .slice(0, round.holes)
      .reduce((sum, hole) => {
        const strokes = hole?.strokes || 0;
        return sum + (strokes - (strokesMap[hole.hole] || 0));
      }, 0);
    card.courseHandicap = courseHandicap;
    card.netTotal = netTotal;
  });

  await Promise.all(
    calcPopulatedScorecards.map((card) =>
      Scorecard.updateOne(
        { _id: card._id },
        { courseHandicap: card.courseHandicap, netTotal: card.netTotal }
      )
    )
  );

  const roundConfigSnapshot = round.configSnapshot;
  const roundConfig =
    roundConfigSnapshot && roundConfigSnapshot.bets
      ? roundConfigSnapshot
      : { bets: roundConfigSnapshot || config?.bets || {} };
  const calculated = calculatePayments({
    config: roundConfig,
    round,
    scorecards: calcPopulatedScorecards,
    holeHandicaps: calcHoleHandicaps,
    holeHandicapsByPlayer: calcHoleHandicapsByPlayer,
  });

  await Payment.deleteMany({ round: round._id });
  if (calculated.length > 0) {
    await Payment.insertMany(
      calculated.map((payment) => ({
        ...payment,
        round: round._id,
      }))
    );
  }
  const payments = await Payment.find({ round: round._id });

  const summary = buildSummary(payments);
  const optimizedTransfers = minimizeTransfers(summary);

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const fallbackTee =
    allTees.find((option) => option.tee_name === round.teeName) || allTees[0];
  const normalizedFallbackHoles = normalizeHoleHandicaps(
    fallbackTee?.holes || [],
    round
  );
  const holeHandicaps =
    normalizedFallbackHoles.map((hole, idx) => ({
      hole: hole.hole ?? idx + 1,
      handicap: hole.handicap,
      par: hole.par,
    })) || [];

  const populatedScorecards = await Scorecard.find({ round: round._id })
    .populate(
      "player",
      "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted -grintScoreHistory"
    )
    .sort({ createdAt: 1 });
  const holeHandicapsByPlayer = {};
  const courseHandicapByPlayer = {};
  const strokesByPlayerHole = {};
  let minCourseHandicap = Number.POSITIVE_INFINITY;

  populatedScorecards.forEach((card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) {
      return;
    }
    const playerTee =
      card.teeName ||
      round.playerTees?.find(
        (entry) => String(entry.player) === String(card.player?._id)
      )?.teeName;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || fallbackTee;
    const normalizedPlayerHoles = normalizeHoleHandicaps(
      tee?.holes || [],
      round
    );
    holeHandicapsByPlayer[playerId] =
      normalizedPlayerHoles.map((hole, idx) => ({
        hole: hole.hole ?? idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || holeHandicaps;

    const courseHandicap = getCourseHandicapForRound(
      tee,
      round,
      card.player?.handicap
    );
    courseHandicapByPlayer[playerId] = courseHandicap;
    if (Number.isFinite(courseHandicap) && courseHandicap < minCourseHandicap) {
      minCourseHandicap = courseHandicap;
    }

    const holeStrokes = {};
    (card.holes || []).forEach((hole) => {
      holeStrokes[hole.hole] = hole.strokes;
    });
    strokesByPlayerHole[playerId] = holeStrokes;
  });

  const strokesMapByPlayer = {};
  const netTotalsByPlayer = {};
  const frontEnd = Math.min(round.holes, 9);
  const effectiveMinHandicap = Number.isFinite(minCourseHandicap)
    ? minCourseHandicap
    : 0;
  const getNetTotalForRange = (card, strokesMap, startHole, endHole) => {
    let netTotal = 0;
    for (let i = startHole; i <= endHole; i += 1) {
      const hole = card.holes?.find((entry) => entry.hole === i);
      const strokes = hole?.strokes || 0;
      netTotal += strokes - (strokesMap[i] || 0);
    }
    return netTotal;
  };

  populatedScorecards.forEach((card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) {
      return;
    }
    const courseHandicap = courseHandicapByPlayer[playerId] ?? 0;
    const relativeHandicap = Math.max(0, courseHandicap - effectiveMinHandicap);
    const strokesMap = allocateStrokes(
      relativeHandicap,
      holeHandicapsByPlayer[playerId] || holeHandicaps,
      round.holes
    );
    strokesMapByPlayer[playerId] = strokesMap;
    const frontNet = getNetTotalForRange(card, strokesMap, 1, frontEnd);
    const backNet =
      round.holes > 9
        ? getNetTotalForRange(card, strokesMap, 10, round.holes)
        : null;
    const matchNet = getNetTotalForRange(card, strokesMap, 1, round.holes);
    netTotalsByPlayer[playerId] = {
      front: frontNet,
      back: backNet,
      match: matchNet,
    };
  });

  const participants = await User.find({
    _id: { $in: Array.from(new Set(round.players || [])) },
  });
  const randomMessage = `☠️ ${SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)]} ☠️`;
  const messagesByPlayerId = buildPlayerSettlementMessages({
    round,
    payments,
    participants,
    populatedScorecards,
    randomMessage,
  });

  await Promise.allSettled(
    participants.map((player) => {
      const playerId = String(player._id);
      const messages = messagesByPlayerId[playerId] || [];
      return Promise.allSettled(
        messages.map((message) =>
          sendMessageWithRandomDelay(
            sendMessage,
            player.phone,
            message.replace("Hoyo Hoyo", "Hoyo")
          )
        )
      );
    })
  );

  round.status = "closed";
  round.endedAt = new Date();
  await round.save();

  return NextResponse.json({ ok: true, summary, optimizedTransfers });
}
