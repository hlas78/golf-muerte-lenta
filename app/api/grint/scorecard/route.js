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
      const url = `https://thegrint.com/score/edit_score/${scoreId}?handicap_company_id=7`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      console.log(`Descarga tarjeta ${url}`);
      try {
        const dismiss = page.locator(
          'a.mb-2.px-4[aria-label="Close"][data-dismiss="modal"]'
        );
        if (await dismiss.first().isVisible({ timeout: 1000 })) {
          await dismiss.first().click();
          await page.waitForTimeout(500);
          const viewLink = page.locator("a.link-score.view-link-score");
          if (await viewLink.first().isVisible({ timeout: 1500 })) {
            await viewLink.first().click();
            await page.waitForTimeout(500);
          } else {
            await page.goto(url, { waitUntil: "domcontentloaded" });
          }
        }
      } catch {
        // ignore modal if not present
      }
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
