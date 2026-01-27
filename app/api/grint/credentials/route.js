import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { encryptSecret } from "@/lib/grintSecrets";
import { verifyGrintCredentials } from "@/lib/grintClient";

export const runtime = "nodejs";

export async function GET() {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.id).select(
    "grintEmail grintVerifiedAt"
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    grintEmail: user.grintEmail || "",
    grintVerifiedAt: user.grintVerifiedAt || null,
  });
}

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.id).select("+grintPasswordEncrypted");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password son requeridos." },
      { status: 400 }
    );
  }

  try {
    await verifyGrintCredentials(user._id, email, password);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo validar el acceso." },
      { status: 400 }
    );
  }

  user.grintEmail = email;
  user.grintPasswordEncrypted = encryptSecret(password);
  user.grintVerifiedAt = new Date();
  await user.save();

  return NextResponse.json({ ok: true });
}
