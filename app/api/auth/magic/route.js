import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { signToken } from "@/lib/auth";

export async function POST(request) {
  await connectDb();
  const payload = await request.json();
  const token = String(payload.token || "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const user = await User.findOne({ magicToken: token });
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (user.status !== "active") {
    return NextResponse.json({ status: "pending" });
  }

  const jwt = signToken({ id: user._id, role: user.role });
  const response = NextResponse.json({ status: "active" });
  response.cookies.set("gml_token", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
  return response;
}
