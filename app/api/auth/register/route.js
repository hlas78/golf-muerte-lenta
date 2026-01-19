import { NextResponse } from "next/server";
import crypto from "crypto";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

function buildMagicLink(token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return `${baseUrl}/auth/verify?token=${token}`;
}

export async function POST(request) {
  await connectDb();
  const payload = await request.json();
  const phone = String(payload.phone || "").trim();
  const name = String(payload.name || "").trim();

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { error: "Telefono invalido" },
      { status: 400 }
    );
  }

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name,
      phone,
      passwordHash: "pending",
      role: "player",
      status: "pending",
    });
  } else if (user.status === "rejected") {
    user.status = "pending";
    user.magicToken = null;
    user.magicTokenCreatedAt = null;
  }

  const oneHourMs = 60 * 60 * 1000;
  const lastSentAt = user.magicTokenCreatedAt
    ? new Date(user.magicTokenCreatedAt).getTime()
    : 0;
  const now = Date.now();

  if (user.magicToken && now - lastSentAt < oneHourMs) {
    return NextResponse.json(
      { error: "Solo puedes solicitar una liga por hora." },
      { status: 429 }
    );
  }

  if (!user.magicToken) {
    user.magicToken = crypto.randomBytes(24).toString("hex");
  }
  user.magicTokenCreatedAt = new Date();
  await user.save();

  const link = buildMagicLink(user.magicToken);
  await sendMessage(
    phone,
    `¡Hola ${name} 👋, estamos validando tu número telefónico ✅, espera a que se confirme tu acceso.`
  );

  return NextResponse.json({ ok: true });
}
