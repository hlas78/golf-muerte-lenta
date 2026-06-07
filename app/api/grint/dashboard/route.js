import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { withGrintPage } from "@/lib/grintClient";
import { fetchDashboardScores } from "@/lib/grintDashboard";

export const runtime = "nodejs";

export async function GET(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.id).select(
    "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted -grintScoreHistory"
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const grintId = searchParams.get("grintId");
  if (!grintId || !/^\d+$/.test(grintId)) {
    return NextResponse.json({ error: "Invalid grintId" }, { status: 400 });
  }
  if (
    !["admin", "supervisor"].includes(user.role) &&
    String(user.grintId) !== String(grintId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const scores = await withGrintPage(async ({ page }) =>
      fetchDashboardScores(page, grintId)
    );
    return NextResponse.json({ scores });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo leer el dashboard." },
      { status: 500 }
    );
  }
}
