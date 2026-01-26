import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { withGrintPage } from "@/lib/grintClient";

export const runtime = "nodejs";

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseDashboardScores(html, grintId) {
  const results = [];
  const containerPattern =
    /<div class="row justify-content-center newsfeed-container[\s\S]*?>/gi;
  const containerIndices = [];
  let containerMatch = containerPattern.exec(html);
  while (containerMatch) {
    containerIndices.push(containerMatch.index);
    containerMatch = containerPattern.exec(html);
  }
  const chunks = containerIndices.length
    ? containerIndices.map((start, idx) => {
        const end =
          idx + 1 < containerIndices.length
            ? containerIndices[idx + 1]
            : html.length;
        return html.slice(start, end);
      })
    : [html];

  const userPattern = new RegExp(
    `<a[^>]*href="https://thegrint\\.com/profile/index/(\\d+)"[^>]*class="[^"]*newsfeed-link-user[^"]*"[^>]*>([\\s\\S]*?)</a>`,
    "i"
  );
  const messagePattern = new RegExp(
    `<a[^>]*class="[^"]*newsfeed-link-message[^"]*"[^>]*href="(https://thegrint\\.com/score/edit_score/(\\d+))"[^>]*>([\\s\\S]*?)</a>`,
    "i"
  );
  const datePattern = /<span[^>]*class="[^"]*newsfeed-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i;

  for (const chunk of chunks) {
    const userMatch = userPattern.exec(chunk);
    if (!userMatch) {
      continue;
    }
    const userId = userMatch[1];
    if (String(userId) !== String(grintId)) {
      continue;
    }
    const userLabel = stripTags(userMatch[2]);
    const messageMatch = messagePattern.exec(chunk);
    if (!messageMatch) {
      continue;
    }
    const url = messageMatch[1];
    const scoreId = messageMatch[2];
    const messageHtml = messageMatch[3];
    const messageText = stripTags(messageHtml);
    const scoreMatch = messageHtml.match(
      /<span[^>]*id="score"[^>]*>([^<]+)<\/span>/i
    );
    const scoreValue = scoreMatch ? stripTags(scoreMatch[1]) : null;
    const atMatch = messageText.match(/at\s+(.+)$/i);
    const course = atMatch ? atMatch[1].trim() : null;
    const dateMatch = datePattern.exec(chunk);
    const dateText = dateMatch ? stripTags(dateMatch[1]) : null;
    results.push({
      scoreId,
      url,
      user: userLabel,
      score: scoreValue,
      course,
      message: messageText,
      date: dateText,
    });
  }
  return results;
}

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
    const scores = await withGrintPage(async ({ page }) => {
      await page.goto("https://thegrint.com/dashboard", {
        waitUntil: "domcontentloaded",
      });
      try {
        await page.waitForSelector("div.newsfeed-container", {
          timeout: 15000,
        });
      } catch {
        // Fallback: some dashboards render a loading label first.
        await page.waitForFunction(
          () =>
            !document.body.innerText.toLowerCase().includes("Loading") &&
            document.querySelectorAll("div.newsfeed-container").length > 0,
          null,
          { timeout: 10000 }
        );
      }
      const html = await page.content();
      return parseDashboardScores(html, grintId);
    });
    return NextResponse.json({ scores });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo leer el dashboard." },
      { status: 500 }
    );
  }
}
