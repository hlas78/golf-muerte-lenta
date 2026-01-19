import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Config from "@/lib/models/Config";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

async function getConfig() {
  let config = await Config.findOne({ key: "global" });
  if (!config) {
    config = await Config.create({ key: "global" });
  }
  return config;
}

export async function GET() {
  await connectDb();
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function PUT(request) {
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
  const config = await getConfig();
  config.bets = { ...config.bets, ...payload.bets };
  if (payload.sarcasm) {
    config.sarcasm = payload.sarcasm;
  }
  await config.save();
  return NextResponse.json({ ok: true });
}
