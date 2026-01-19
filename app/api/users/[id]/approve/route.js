import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

const CONFIRM_MESSAGES = [
  "Listo, quedas dentro. No la riegues tan rapido. 😎⛳️",
  "Aprobado. El green te espera, el sarcasmo tambien. 🏌️‍♂️😂",
  "Bienvenido al caos. Ya puedes entrar. 🧨⛳️",
  "Admin dio el ok. A ver si hoy si juegas. 🤝🏌️",
];

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
  await user.save();

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/auth/verify?token=${user.magicToken}`;
  const message = `${CONFIRM_MESSAGES[Math.floor(Math.random() * CONFIRM_MESSAGES.length)]}\n${url}`;
  await sendMessage(user.phone, message);
  return NextResponse.json({ ok: true });
}
