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

function parseScoresTable(html) {
  const results = [];
  const scriptPattern = /scoresArray\.unshift\(\{([\s\S]*?)\}\);/gi;
  let scriptMatch = scriptPattern.exec(html);
  while (scriptMatch) {
    const block = scriptMatch[1];
    const fields = {};
    const fieldPattern = /([a-zA-Z0-9_]+)\s*:\s*('([^']*)'|([^,]+))/g;
    let fieldMatch = fieldPattern.exec(block);
    while (fieldMatch) {
      const key = fieldMatch[1];
      const value = fieldMatch[3] != null ? fieldMatch[3] : fieldMatch[4];
      fields[key] = typeof value === "string" ? value.trim() : value;
      fieldMatch = fieldPattern.exec(block);
    }
    if (fields.scoreId) {
      results.push({
        scoreId: String(fields.scoreId),
        url: `https://thegrint.com/score/edit_score/${fields.scoreId}?handicap_company_id=7`,
        date: fields.date || null,
        course: fields.courseName || null,
        teeInfo: fields.tees || null,
        score: fields.score != null ? String(fields.score) : null,
        holes: fields.scoreType || null,
        putts: null,
      });
    }
    scriptMatch = scriptPattern.exec(html);
  }
  if (results.length > 0) {
    return results;
  }

  const rowPattern = /<tr class=" clickable-row">([\s\S]*?)<\/tr>/gi;
  let rowMatch = rowPattern.exec(html);
  while (rowMatch) {
    const rowHtml = rowMatch[1];
    const linkMatch = rowHtml.match(
      /href="https:\/\/thegrint\.com\/score\/edit_score\/(\d+)[^"]*"/i
    );
    if (!linkMatch) {
      rowMatch = rowPattern.exec(html);
      continue;
    }
    const scoreId = linkMatch[1];
    const urlMatch = rowHtml.match(
      /href="(https:\/\/thegrint\.com\/score\/edit_score\/\d+[^\"]*)"/i
    );
    const url = urlMatch ? urlMatch[1] : null;
    const tds = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(
      (match) => match[1]
    );
    const date = tds[0] || null;
    const courseCell = tds[1] || "";
    const course = stripTags(courseCell.replace(/<p[\s\S]*?<\/p>/gi, ""));
    const teeMatch = rowHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const teeInfo = teeMatch ? stripTags(teeMatch[1]) : null;
    const score = stripTags(tds[2] || "");
    const holes = stripTags(tds[3] || "");
    const putts = stripTags(tds[4] || "");
    results.push({
      scoreId,
      url,
      date,
      course,
      teeInfo,
      score,
      holes,
      putts,
    });
    rowMatch = rowPattern.exec(html);
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
      const payload = new URLSearchParams({
        wave: "1",
        wave18: "0",
        wave9: "0",
        userId: String(grintId),
        courseId: "",
        typeScore: "0",
        handicap_company_id: "7",
      }).toString();
      console.log(`Get More Scores https://thegrint.com/score/listMoreScores?${payload}`)
      const response = await page.request.post(
        "https://thegrint.com/score/listMoreScores",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          data: payload,
        }
      );
      try {
        const dismiss = page.locator(
          'a.mb-2.px-4[aria-label="Close"][data-dismiss="modal"]'
        );
        if (await dismiss.first().isVisible({ timeout: 5000 })) {
          await dismiss.first().click();
          await page.waitForTimeout(500);
        }
      } catch {
        // ignore modal if not present
      }
      console.log(await response.text())
      const fs = require('fs')
      fs.writeFileSync('/Users/hector/Documents/Code/Golf/golf-muerte-lenta/rounds', await response.text())
      const html = await response.text();
      return parseScoresTable(html);
    });
    return NextResponse.json({ scores });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo leer el dashboard." },
      { status: 500 }
    );
  }
}
