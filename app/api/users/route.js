import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword, verifyToken } from "@/lib/auth";

export async function GET(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const admin = await User.findById(payload.id);
  if (!admin || (admin.role !== "admin" && admin.role !== "supervisor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const status = request.nextUrl.searchParams.get("status");
  const query = status ? { status } : {};
  const users = await User.find(query)
    .select("-passwordHash")
    .sort({ name: 1 });
  return NextResponse.json(users);
}

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payloadToken = verifyToken(token);
  const admin = await User.findById(payloadToken.id);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payload = await request.json();
  const passwordHash = await hashPassword(payload.password || "gml1234");
  const user = await User.create({
    name: payload.name,
    phone: payload.phone,
    passwordHash,
    role: payload.role || "player",
    handicap: payload.handicap || 0,
    status: payload.status || "active",
  });
  return NextResponse.json({ id: user._id });
}
