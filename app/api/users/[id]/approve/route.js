import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword, verifyToken } from "@/lib/auth";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

const CONFIRM_MESSAGES = [
  "Listo, quedas dentro. No la riegues tan rapido. 😎⛳️",
  "Aprobado. El green te espera, el sarcasmo tambien. 🏌️‍♂️😂",
  "Bienvenido al caos. Ya puedes entrar. 🧨⛳️",
  "Admin dio el ok. A ver si hoy si juegas. 🤝🏌️",
];

const PASSWORD_MESSAGES = [
  "Tu contraseña de acceso es: *{password}* y puedes usarla en otros dispositivos. 🔑📱"];

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const admin = await User.findById(payload.id);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  user.status = "active";
  const tempPassword = generatePassword();
  user.passwordHash = await hashPassword(tempPassword);
  await user.save();

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/auth/verify?token=${user.magicToken}`;
  const passwordMessage =
    PASSWORD_MESSAGES[Math.floor(Math.random() * PASSWORD_MESSAGES.length)].replace(
      "{password}",
      tempPassword
    );
  const message = `${CONFIRM_MESSAGES[Math.floor(Math.random() * CONFIRM_MESSAGES.length)]}\n\n${passwordMessage}\n\nÉsta es tu liga de acceso, puedes usarla para ingresar al sistema sin contraseña:\n${url}\n\n`;
  await sendMessage(user.phone, message);
  return NextResponse.json({ ok: true });
}
