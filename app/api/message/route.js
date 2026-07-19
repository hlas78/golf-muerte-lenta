import { NextResponse } from "next/server";
import crypto from "crypto";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import {
  buildWelcomeAccess,
  buildWelcomeMessage,
} from "@/lib/welcomeMessageBuilder";
import { getCourseHandicapForRound } from "@/lib/scoring";
import {
  SARCASTIC_MESSAGES,
  buildPlayerSettlementMessages,
} from "@/lib/settlementMessages";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function buildMagicLink(token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return `${baseUrl}/auth/verify?token=${token}`;
}

export async function POST(request) {
  await connectDb();
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const inboundMessage = String(payload.message || "").trim().toLowerCase();
  if (!["ingreso", "cuentas"].includes(inboundMessage)) {
    return NextResponse.json({ ok: true, action: "ignored-message" });
  }

  const fromLast10 = normalizePhone(payload.from);
  if (!fromLast10 || fromLast10.length < 10) {
    return NextResponse.json(
      { ok: false, reason: "invalid-from" },
      { status: 400 }
    );
  }

  const user = await User.findOne({
    phone: { $regex: `${fromLast10}$` },
    status: "active",
  });
  if (!user) {
    return NextResponse.json({ ok: true, action: "ignored" });
  }

  if (inboundMessage === "cuentas") {
    const round = await Round.findOne({
      status: "closed",
      players: user._id,
    }).sort({ endedAt: -1, startedAt: -1, createdAt: -1 });

    if (!round) {
      await sendMessage(
        user.phone,
        "No encontré una jugada cerrada para compartirte cuentas."
      );
      return NextResponse.json({ ok: true, action: "no-closed-round" });
    }

    const payments = await Payment.find({ round: round._id });
    if (payments.length === 0) {
      await sendMessage(
        user.phone,
        "Tu última jugada cerrada no tiene cuentas registradas."
      );
      return NextResponse.json({ ok: true, action: "no-payments" });
    }

    const participants = await User.find({
      _id: { $in: Array.from(new Set(round.players || [])) },
    });
    const populatedScorecards = await Scorecard.find({ round: round._id })
      .populate(
        "player",
        "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted -grintScoreHistory"
      )
      .sort({ createdAt: 1 });
    const randomMessage = `☠️ ${
      SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)]
    } ☠️`;
    const messagesByPlayerId = buildPlayerSettlementMessages({
      round,
      payments,
      participants,
      populatedScorecards,
      randomMessage,
    });
    const messages = messagesByPlayerId[String(user._id)] || [];

    if (messages.length === 0) {
      await sendMessage(
        user.phone,
        "No encontré cuentas pendientes para tu última jugada cerrada."
      );
      return NextResponse.json({ ok: true, action: "no-player-messages" });
    }

    for (const message of messages) {
      await sendMessage(user.phone, message);
    }

    return NextResponse.json({
      ok: true,
      action: "accounts-sent",
      roundId: String(round._id),
      userId: String(user._id),
    });
  }

  const round = await Round.findOne({
    status: { $in: ["open", "active"] },
    players: user._id,
  }).sort({ startedAt: -1, createdAt: -1 });

  if (round) {
    if (!user.magicToken) {
      user.magicToken = crypto.randomBytes(24).toString("hex");
      user.magicTokenCreatedAt = new Date();
      await user.save();
    }

    const tees = round.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const teeName =
      round.playerTees?.find(
        (entry) => String(entry.player) === String(user._id)
      )?.teeName || "";
    const groupNumber =
      round.playerGroups?.find(
        (entry) => String(entry.player) === String(user._id)
      )?.group || null;
    const selectedTee =
      allTees.find((option) => option.tee_name === teeName) || allTees[0];
    const courseHandicap = selectedTee
      ? getCourseHandicapForRound(selectedTee, round, user.handicap || 0)
      : null;
    const { recordLink, linkText } = buildWelcomeAccess(
      round,
      user,
      user.magicToken
    );
    const campo =
      round.courseSnapshot?.clubName ||
      round.courseSnapshot?.courseName ||
      "el campo";
    const message = buildWelcomeMessage({
      campo,
      creatorName: "",
      description: round.description || "",
      recordLink,
      linkText,
      startedAt: round.startedAt,
      groupLabel: groupNumber ? `Grupo ${groupNumber}` : "",
      teeName: selectedTee?.tee_name || teeName,
      courseHandicap,
      grintDaysOutOfDate: user.grintDaysOutOfDate,
    });
    await sendMessage(user.phone, message);
    return NextResponse.json({
      ok: true,
      action: "welcome-sent",
      roundId: String(round._id),
      userId: String(user._id),
    });
  }

  if (!user.magicToken) {
    user.magicToken = crypto.randomBytes(24).toString("hex");
  }
  user.magicTokenCreatedAt = new Date();
  await user.save();

  const link = buildMagicLink(user.magicToken);
  const message = `Hola ${user.name || ""}.\n\nAquí tienes tu liga para entrar:\n${link}\n\nSi no intentaste ingresar, ignora este mensaje.`;
  await sendMessage(user.phone, message);

  return NextResponse.json({
    ok: true,
    action: "magic-link-sent",
    userId: String(user._id),
  });
}
