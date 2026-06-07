function stripTags(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseScoresTable(html) {
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

export async function fetchDashboardScores(page, grintId) {
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
  const html = await response.text();
  return parseScoresTable(html);
}

export function parseDashboardScoreDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    let [, first, second, year] = slashMatch;
    let month = Number(first);
    let day = Number(second);
    const normalizedYear = Number(year.length === 2 ? `20${year}` : year);
    if (month > 12) {
      [day, month] = [month, day];
    }
    const parsed = new Date(normalizedYear, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const namedMatch = raw.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedMatch) {
    const month = monthMap[namedMatch[1].slice(0, 3).toLowerCase()];
    const day = Number(namedMatch[2]);
    const year = Number(namedMatch[3]);
    if (month != null) {
      const parsed = new Date(year, month, day);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}
