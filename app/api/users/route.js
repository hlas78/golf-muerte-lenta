import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import Round from "@/lib/models/Round";
import { hashPassword, verifyToken } from "@/lib/auth";

const normalizeIds = (value) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

const getMexicoCityDayKey = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

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
  const includeGrintPending =
    request.nextUrl.searchParams.get("includeGrintPending") === "1";
  const query = status ? { status } : {};
  const users = await User.find(query)
    .select("-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted -grintScoreHistory")
    .sort({ name: 1 })
    .lean();

  if (!includeGrintPending || users.length === 0) {
    return NextResponse.json(users);
  }

  const now = new Date();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const pendingByUser = new Map(users.map((user) => [String(user._id), 0]));
  const rounds = await Round.find({
    players: { $in: users.map((user) => user._id) },
    $or: [
      { startedAt: { $lte: now } },
      { startedAt: { $exists: false }, createdAt: { $lte: now } },
      { startedAt: null, createdAt: { $lte: now } },
    ],
  })
    .select("players startedAt createdAt")
    .lean();

  rounds.forEach((round) => {
    const roundDay = getMexicoCityDayKey(round.startedAt || round.createdAt);
    if (!roundDay) {
      return;
    }
    (round.players || []).forEach((playerId) => {
      const id = String(playerId);
      const user = userById.get(id);
      if (!user) {
        return;
      }
      const lastGrintDay = getMexicoCityDayKey(user.grintLastScoreAt);
      if (!lastGrintDay || roundDay > lastGrintDay) {
        pendingByUser.set(id, (pendingByUser.get(id) || 0) + 1);
      }
    });
  });

  return NextResponse.json(
    users.map((user) => ({
      ...user,
      gmlRoundsWithoutGrint: pendingByUser.get(String(user._id)) || 0,
    }))
  );
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
  const defaultTeeName = payload.defaultTeeName
    ? String(payload.defaultTeeName).trim().toUpperCase()
    : "BLANCAS";
  const user = await User.create({
    name: payload.name,
    phone: payload.phone,
    passwordHash,
    role: payload.role || "player",
    handicap: payload.handicap || 0,
    grintId: payload.grintId ? String(payload.grintId).trim() : "",
    status: payload.status || "active",
    defaultTeeName,
    hasCart: Boolean(payload.hasCart),
    friends: normalizeIds(payload.friends),
    enemies: normalizeIds(payload.enemies),
    family: normalizeIds(payload.family),
  });
  return NextResponse.json({ id: user._id });
}
