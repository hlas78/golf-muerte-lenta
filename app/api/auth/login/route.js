import { NextResponse } from "next/server";
import crypto from "crypto";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { signToken, verifyPassword } from "@/lib/auth";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

function buildMagicLink(token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return `${baseUrl}/auth/verify?token=${token}`;
}

export async function POST(request) {
  await connectDb();
  const payload = await request.json();
  const user = await User.findOne({ phone: payload.phone });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "User pending" }, { status: 403 });
  }
  const ok = await verifyPassword(payload.password, user.passwordHash);
  if (!ok) {
    const oneHourMs = 60 * 60 * 1000;
    const lastSentAt = user.magicTokenCreatedAt
      ? new Date(user.magicTokenCreatedAt).getTime()
      : 0;
    const now = Date.now();
    const canSend = now - lastSentAt >= oneHourMs;

    if (!user.magicToken) {
      user.magicToken = crypto.randomBytes(24).toString("hex");
    }
    if (canSend) {
      user.magicTokenCreatedAt = new Date();
      await user.save();
      const link = buildMagicLink(user.magicToken);
      await sendMessage(
        user.phone,
        `Hola ${user.name || ""}.\n\nParece que tu contraseña no coincidió. Aquí tienes una liga para entrar sin contraseña:\n${link}\n\nSi no intentaste iniciar sesión, ignora este mensaje.`
      );
    }
    return NextResponse.json({ error: "Contraseña incorrecta. Te enviamos una luga por whatsapp para ingresar" }, { status: 401 });
  }
  const token = signToken({ id: user._id, role: user.role });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("gml_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
  return response;
}
