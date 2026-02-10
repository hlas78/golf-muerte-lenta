import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Course from "@/lib/models/Course";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { withGrintPage } from "@/lib/grintClient";

export const runtime = "nodejs";

const TEE_NAME_MAP = {
  BLACK: "NEGRAS",
  BLUE: "AZULES",
  WHITE: "BLANCAS",
  GOLD: "DORADAS",
  SILVER: "PLATEADAS",
  RED: "ROJAS",
};

const RATING_NAME_MAP = {
  NEGRAS: "BLACK",
  AZULES: "BLUE",
  BLANCAS: "WHITE",
  DORADAS: "GOLD",
  PLATEADAS: "SILVER",
  ROJAS: "RED",
};

const toNumber = (value) => {
  const parsed = Number(String(value).replace(/[^\d.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const stripTags = (value) =>
  value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const parseRatings = (sectionHtml) => {
  const ratings = new Map();
  const normalized = stripTags(sectionHtml)
    .replace(/\s+/g, " ")
    .trim();
  const pattern = /([A-Za-z]+)\s+([0-9.]+)\s*\/\s*([0-9.]+)%/g;
  let match = pattern.exec(normalized);
  while (match) {
    ratings.set(match[1].toUpperCase(), {
      course_rating: toNumber(match[2]),
      slope_percent: toNumber(match[3]),
    });
    match = pattern.exec(normalized);
  }
  return ratings;
};

const parseRowNumbers = (rowHtml, options = {}) => {
  const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(
    (match) => stripTags(match[1])
  );
  const startIndex = options.dropFirst ? 1 : 0;
  const sliced = cells.slice(startIndex);
  const outIndex = 9;
  const inIndex = sliced.length - 2;
  const totIndex = sliced.length - 1;
  const values = sliced
    .map((value) => value.trim())
    .filter((value, idx) => {
      if (!value || !/^\d+$/.test(value)) {
        return false;
      }
      if (idx === outIndex || idx === inIndex || idx === totIndex) {
        return false;
      }
      return true;
    })
    .map((value) => Number(value));
  return values;
};

const parseSection = (sectionHtml, ratingsHtml) => {
  const indexMatch = sectionHtml.match(
    /<tr[^>]*>\s*<td>\s*INDEX\s*<\/td>([\s\S]*?)<\/tr>/i
  );
  const parMatch = sectionHtml.match(
    /<tr[^>]*>\s*<td>\s*PAR\s*<\/td>([\s\S]*?)<\/tr>/i
  );
  if (!indexMatch || !parMatch) {
    return null;
  }
  const indexValues = parseRowNumbers(indexMatch[1]).slice(0, 18);
  const parValues = parseRowNumbers(parMatch[1]).slice(0, 18);
  if (indexValues.length !== 18 || parValues.length !== 18) {
    return null;
  }

  const ratings = parseRatings(ratingsHtml || sectionHtml);
  const teeRows = [];
  const teePattern = /<tr class="tee-([^"]+)">([\s\S]*?)<\/tr>/gi;
  let teeMatch = teePattern.exec(sectionHtml);
  while (teeMatch) {
    const rowHtml = teeMatch[2];
    const nameMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    const teeNameRaw = nameMatch ? stripTags(nameMatch[1]) : null;
    const teeNameUpper = teeNameRaw ? teeNameRaw.toUpperCase() : null;
    const yardages = parseRowNumbers(rowHtml, { dropFirst: true }).slice(0, 18);
    if (teeNameUpper && yardages.length === 18) {
      teeRows.push({
        teeNameRaw: teeNameUpper,
        yardages,
      });
    }
    teeMatch = teePattern.exec(sectionHtml);
  }
  return {
    indexValues,
    parValues,
    ratings,
    teeRows,
  };
};

const buildTee = ({ teeNameRaw, yardages }, indexValues, parValues, ratings) => {
  const ratingKey = RATING_NAME_MAP[teeNameRaw] || teeNameRaw;
  const ratingInfo = ratings.get(ratingKey) || {};
  const slopePercent = ratingInfo.slope_percent;
  const slopeRating = slopePercent
    ? Number(((slopePercent / 100) * 113).toFixed(1))
    : null;
  const courseRating = ratingInfo.course_rating ?? null;
  const parTotal = parValues.reduce((sum, par) => sum + par, 0);
  const frontPar = parValues.slice(0, 9).reduce((sum, par) => sum + par, 0);
  const frontCourseRating =
    courseRating != null ? Number((courseRating * (frontPar / parTotal)).toFixed(1)) : null;
  const backCourseRating =
    courseRating != null
      ? Number((courseRating - frontCourseRating).toFixed(1))
      : null;

  const totalYards = yardages.reduce((sum, yard) => sum + yard, 0);
  const totalMeters = Math.round(totalYards * 0.9144);
  const frontYards = yardages.slice(0, 9).reduce((sum, yard) => sum + yard, 0);
  const backYards = yardages.slice(9, 18).reduce((sum, yard) => sum + yard, 0);

  return {
    tee_name: TEE_NAME_MAP[teeNameRaw] || teeNameRaw,
    course_rating: courseRating,
    slope_rating: slopeRating,
    bogey_rating: null,
    total_yards: totalYards,
    total_meters: totalMeters,
    number_of_holes: 18,
    par_total: parTotal,
    front_course_rating: frontCourseRating,
    front_slope_rating: slopeRating,
    front_bogey_rating: null,
    back_course_rating: backCourseRating,
    back_slope_rating: slopeRating,
    back_bogey_rating: null,
    holes: yardages.map((yardage, idx) => ({
      par: parValues[idx],
      yardage,
      handicap: indexValues[idx],
    })),
    front_yards: frontYards,
    back_yards: backYards,
  };
};

const parseCourseHtml = (html) => {
  const titleMatch = html.match(
    /<span class="title-section[^"]*">([\s\S]*?)<\/span>/i
  );
  const title = titleMatch ? stripTags(titleMatch[1]) : null;
  let courseName = title;
  let clubName = title;
  if (title && title.includes(" | ")) {
    const [coursePart, clubPart] = title.split(" | ");
    courseName = coursePart.trim();
    clubName = clubPart.trim();
  }

  const menHeaderMatch = html.match(
    /<div>\s*<span[^>]*>MEN<\/span>([\s\S]*?)<\/div>/i
  );
  const ladiesHeaderMatch = html.match(
    /<div>\s*<span[^>]*>LADIES<\/span>([\s\S]*?)<\/div>/i
  );
  const menMatch = html.match(
    /<span[^>]*>MEN<\/span>[\s\S]*?<div class="div-static">([\s\S]*?)<\/div>\s*<\/div>/i
  );
  const ladiesMatch = html.match(
    /<span[^>]*>LADIES<\/span>[\s\S]*?<div class="div-static">([\s\S]*?)<\/div>\s*<\/div>/i
  );

  const tees = { male: [], female: [] };
  if (menMatch) {
    const section = parseSection(menMatch[1], menHeaderMatch?.[1]);
    if (section) {
      tees.male = section.teeRows.map((row) =>
        buildTee(row, section.indexValues, section.parValues, section.ratings)
      );
    }
  }
  if (ladiesMatch) {
    const section = parseSection(ladiesMatch[1], ladiesHeaderMatch?.[1]);
    if (section) {
      tees.female = section.teeRows
        .filter((row) => (TEE_NAME_MAP[row.teeNameRaw] || row.teeNameRaw) === "ROJAS")
        .map((row) =>
          buildTee(row, section.indexValues, section.parValues, section.ratings)
        );
    }
  }

  return {
    clubName: clubName || "Campo",
    courseName: courseName || "Campo",
    tees,
  };
};

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const url = String(body?.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "URL requerida" }, { status: 400 });
  }
  const courseIdMatch = url.match(/course\/scorecard\/(\d+)/i);
  const courseId = courseIdMatch ? Number(courseIdMatch[1]) : null;
  if (!courseId) {
    return NextResponse.json({ error: "No se pudo leer el courseId" }, { status: 400 });
  }

  try {
    const html = await withGrintPage(async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return page.content();
    });
    const parsed = parseCourseHtml(html);
    const course = await Course.findOneAndUpdate(
      { courseId },
      {
        courseId,
        clubName: parsed.clubName,
        courseName: parsed.courseName,
        tees: parsed.tees,
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ ok: true, courseId: course.courseId });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo descargar el campo." },
      { status: 500 }
    );
  }
}
