import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Course from "@/lib/models/Course";
import Config from "@/lib/models/Config";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

async function getConfigSnapshot() {
  let config = await Config.findOne({ key: "global" });
  if (!config) {
    config = await Config.create({ key: "global" });
  }
  return config;
}

export async function GET() {
  await connectDb();
  const rounds = await Round.find()
    .populate("supervisor", "-passwordHash")
    .populate("players", "-passwordHash")
    .sort({ createdAt: -1 });
  return NextResponse.json(rounds);
}

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authPayload = verifyToken(token);
  const user = await User.findById(authPayload.id);
  if (!user || user.role === "player") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payload = await request.json();
  const course = await Course.findOne({ courseId: payload.courseId });
  const config = await getConfigSnapshot();

  const round = await Round.create({
    course: course?._id,
    courseSnapshot: course,
    teeName: payload.teeName || "por-jugador",
    holes: payload.holes,
    status: "open",
    createdBy: payload.createdBy,
    supervisor: payload.supervisor,
    players: payload.players || [],
    configSnapshot: config.bets,
  });

  return NextResponse.json({ id: round._id });
}
