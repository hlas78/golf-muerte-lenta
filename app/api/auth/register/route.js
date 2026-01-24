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
  const handicap = Number(payload.handicap);

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { error: "Telefono invalido" },
      { status: 400 }
    );
  }

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name: name || `Jugador ${phone.slice(-4)}`,
      phone,
      passwordHash: "pending",
      role: "player",
      status: "pending",
      handicap: Number.isFinite(handicap) ? handicap : 0,
    });
  } else if (Number.isFinite(handicap)) {
    user.handicap = handicap;
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
    `¡Hola ${name || user.name} 👋! \n\nGracias por solicitar tu acceso a ☠️ La Muerte Lenta ☠️\n\nEn cuanto la solicitud sea aprobada, recibirás tu acceso. Agrega el contacto que te voy a enviar a continuación para facilitar el proceso de alta`
  );
  
  sendMessage(phone, 'BEGIN:VCARD\nVERSION:3.0\nN:Avisos;Muerte Lenta;;;\nFN:Avisos Muerte Lenta\nTEL;type=CELL;type=VOICE;waid=5215530967255:+525530967255\nEND:VCARD');

  return NextResponse.json({ ok: true });
}
