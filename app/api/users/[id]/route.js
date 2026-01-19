import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
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
  if (body.password) {
    updates.passwordHash = await hashPassword(body.password);
  }

  await User.updateOne({ _id: id }, updates);

  return NextResponse.json({ ok: true });
}
