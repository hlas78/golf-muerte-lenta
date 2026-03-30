import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import User from "@/lib/models/User";
import connectDb from "@/lib/db";

const POLL_URL =
  "https://wa.opcionguik.com.mx/walink/poll/get/5215530967255/120363405357623444@g.us";

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits
};

export async function GET() {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authPayload = verifyToken(token);
  const user = await User.findById(authPayload.id);
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(POLL_URL, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "No se pudo obtener la encuesta." },
      { status: 500 }
    );
  }
  const data = await res.json();

  const users = await User.find({ status: { $ne: "baja" } })
    .select("name phone")
    .lean();
  const usersByPhone = users.reduce((acc, user) => {
    const phone = normalizePhone(user.phone);
    if (phone) {
      acc[phone] = user;
    }
    return acc;
  }, {});

  const first = Array.isArray(data) ? data[0] : null;
  const options =
    first?.parentMessage?.pollOptions ||
    first?.parentMessage?._data?._data?.pollOptions ||
    first?.parentMessage?._data?.pollOptions ||
    [];

  const votesByOption = {};
  if (Array.isArray(data)) {
    data.forEach((entry) => {
      const phone = normalizePhone(entry?.phone || entry?.voter);
      const selected = Array.isArray(entry?.selectedOptions)
        ? entry.selectedOptions
        : [];
      selected.forEach((option) => {
        const name = option?.name;
        if (!name || !phone) {
          return;
        }
        if (!votesByOption[name]) {
          votesByOption[name] = new Set();
        }
        votesByOption[name].add(phone);
      });
    });
  }

  const mappedOptions = (Array.isArray(options) ? options : []).map((option) => {
    const name = option?.name;
    const phones = name ? Array.from(votesByOption[name] || []) : [];
    const matched = phones
      .map((phone) => usersByPhone[phone])
      .filter(Boolean)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        phone: user.phone,
      }));
    return { name, players: matched };
  });

  return NextResponse.json({ options: mappedOptions });
}
