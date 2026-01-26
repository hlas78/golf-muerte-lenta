import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import crypto from "crypto";
import Round from "@/lib/models/Round";
import Course from "@/lib/models/Course";
import Config from "@/lib/models/Config";
import User from "@/lib/models/User";
import Scorecard from "@/lib/models/Scorecard";
import { verifyToken } from "@/lib/auth";
import { buildWelcomeMessage } from "@/lib/welcomeMessageBuilder";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

function buildRecordLink(roundId, token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  return `${baseUrl}/rounds/${roundId}/record?${params.toString()}`;
}

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
    description: payload.description || "",
    configSnapshot: config.bets,
  });

  const playerIds = Array.isArray(payload.players)
    ? Array.from(new Set(payload.players.map(String)))
    : [];
  if (playerIds.length > 0) {
    const tees = course?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const defaultTeeName = allTees[0]?.tee_name || round.teeName || "";
    round.playerTees = playerIds.map((playerId) => ({
      player: playerId,
      teeName: defaultTeeName,
    }));
    round.status = "active";
    await round.save();

    await Scorecard.insertMany(
      playerIds.map((playerId) => ({
        round: round._id,
        player: playerId,
        teeName: defaultTeeName,
        holes: Array.from({ length: round.holes }, (_, idx) => ({
          hole: idx + 1,
          strokes: null,
          putts: null,
          ohYes: false,
          sandy: false,
          penalties: [],
          bunker: false,
          water: false,
          holeOut: false,
        })),
      }))
    );

    const participants = await User.find({ _id: { $in: playerIds } });
    const campo =
      round.courseSnapshot?.clubName ||
      round.courseSnapshot?.courseName ||
      "el campo";
    await Promise.allSettled(
      participants.map(async (player) => {
        if (!player.magicToken) {
          player.magicToken = crypto.randomBytes(24).toString("hex");
          player.magicTokenCreatedAt = new Date();
          await player.save();
        }
        const recordLink = buildRecordLink(round._id, player.magicToken);
        const message = buildWelcomeMessage({
          campo,
          creatorName: user?.name || "sin nombre",
          description: round.description || "",
          recordLink,
        });
        return sendMessage(player.phone, message);
      })
    );
  }

  return NextResponse.json({ id: round._id });
}
