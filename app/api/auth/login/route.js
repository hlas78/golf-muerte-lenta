import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { signToken, verifyPassword } from "@/lib/auth";

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
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = signToken({ id: user._id, role: user.role });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("gml_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
