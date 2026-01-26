import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { withGrintPage } from "@/lib/grintClient";
import { parseScorecardHtml } from "@/lib/scorecardScraper";

export const runtime = "nodejs";

export async function GET(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.id).select("-passwordHash");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scoreId = searchParams.get("scoreId");
  if (!scoreId || !/^\d+$/.test(scoreId)) {
    return NextResponse.json({ error: "Invalid scoreId" }, { status: 400 });
  }

  try {
    const result = await withGrintPage(async ({ page }) => {
      const url = `https://thegrint.com/score/edit_score/${scoreId}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      return parseScorecardHtml(html);
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo leer la tarjeta." },
      { status: 500 }
    );
  }
}
