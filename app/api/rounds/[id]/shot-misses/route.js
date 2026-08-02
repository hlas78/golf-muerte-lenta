import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Round from "@/lib/models/Round";
import User from "@/lib/models/User";
import ShotMiss from "@/lib/models/ShotMiss";

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authPayload = verifyToken(token);
  const actor = await User.findById(authPayload.id);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await request.json();
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const hole = Number(payload?.hole);
  const club = String(payload?.club || "").trim();
  if (!club || !Number.isFinite(hole) || hole < 1 || hole > 18) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const isInRound = round.players?.some(
    (roundPlayerId) => String(roundPlayerId) === String(actor._id)
  );
  if (!isInRound) {
    return NextResponse.json(
      { error: "Solo puedes registrar tus tiros si participas en la jugada" },
      { status: 400 }
    );
  }

  const shotMiss = await ShotMiss.create({
    round: round._id,
    player: actor._id,
    recordedBy: actor._id,
    hole,
    club,
    distance: payload?.distance ? String(payload.distance).trim() : "",
    direction: payload?.direction ? String(payload.direction).trim() : "",
    height: payload?.height ? String(payload.height).trim() : "",
    notes: payload?.notes ? String(payload.notes).trim() : "",
    gps: payload?.gps
      ? {
          latitude: toFiniteNumber(payload.gps.latitude),
          longitude: toFiniteNumber(payload.gps.longitude),
          accuracy: toFiniteNumber(payload.gps.accuracy),
          altitude: toFiniteNumber(payload.gps.altitude),
          altitudeAccuracy: toFiniteNumber(payload.gps.altitudeAccuracy),
          heading: toFiniteNumber(payload.gps.heading),
          speed: toFiniteNumber(payload.gps.speed),
          capturedAt: payload.gps.capturedAt
            ? new Date(payload.gps.capturedAt)
            : new Date(),
        }
      : undefined,
  });

  return NextResponse.json({ ok: true, shotMiss });
}
