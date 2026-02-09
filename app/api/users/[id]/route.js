import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import {
  allocateStrokes,
  getCourseHandicapForRound,
  normalizeHoleHandicaps,
} from "@/lib/scoring";
import { verifyToken, hashPassword } from "@/lib/auth";

export async function PATCH(request, { params }) {
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

  const body = await request.json();
  const updates = {};

  if (body.name) {
    updates.name = String(body.name).trim();
  }
  if (body.phone) {
    const phone = String(body.phone).trim();
    if (!/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: "Telefono invalido" },
        { status: 400 }
      );
    }
    updates.phone = phone;
  }
  if (body.role) {
    updates.role = body.role;
  }
  if (body.handicap != null) {
    updates.handicap = Number(body.handicap) || 0;
  }
  if (body.grintId != null) {
    updates.grintId = String(body.grintId).trim();
  }
  if (body.password) {
    updates.passwordHash = await hashPassword(body.password);
  }

  await User.updateOne({ _id: id }, updates);

  if (body.handicap != null) {
    const rounds = await Round.find({
      players: id,
      status: { $ne: "closed" },
    });
    const updatedHandicap = Number(body.handicap) || 0;
    for (const round of rounds) {
      const scorecard = await Scorecard.findOne({
        round: round._id,
        player: id,
      });
      if (!scorecard) {
        continue;
      }
      const tees = round.courseSnapshot?.tees || {};
      const allTees = [...(tees.male || []), ...(tees.female || [])];
      const teeName =
        scorecard.teeName ||
        round.playerTees?.find(
          (entry) => String(entry.player) === String(id)
        )?.teeName ||
        round.teeName;
      const selected =
        allTees.find((tee) => tee.tee_name === teeName) || allTees[0];
      if (!selected) {
        continue;
      }
      const courseHandicap = getCourseHandicapForRound(
        selected,
        round,
        updatedHandicap
      );
      console.log(`${round.courseSnapshot.clubName} handicap: ${courseHandicap}`)
      const normalizedHoles = normalizeHoleHandicaps(
        selected?.holes || [],
        round
      );
      const holeHandicaps =
        normalizedHoles.map((hole, idx) => ({
          hole: hole.hole ?? idx + 1,
          handicap: hole.handicap,
        })) || [];
      const strokesMap = allocateStrokes(
        courseHandicap,
        holeHandicaps,
        round.holes
      );
      let netTotal = 0;
      for (let i = 1; i <= round.holes; i += 1) {
        const hole = scorecard.holes?.find((entry) => entry.hole === i);
        const strokes = hole?.strokes || 0;
        const net = strokes - (strokesMap[i] || 0);
        netTotal += net;
      }
      await Scorecard.updateOne(
        { _id: scorecard._id },
        { courseHandicap, teeName: selected.tee_name, netTotal }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
