import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";
import { withGrintUserPage } from "@/lib/grintClient";

export const runtime = "nodejs";

function buildCourseSearchValue(round) {
  const courseName = round?.courseSnapshot?.courseName || "";
  const clubName = round?.courseSnapshot?.clubName || "";
  if (clubName) {
    return clubName;
  }
  return courseName || "";
}

function buildCourseItemName(round) {
  const courseName = round?.courseSnapshot?.courseName || "";
  const clubName = round?.courseSnapshot?.clubName || "";
  if (courseName && clubName) {
    return `${courseName} | ${clubName}`;
  }
  return clubName || courseName || "";
}

function mapTeeName(teeName) {
  if (!teeName) {
    return "";
  }
  const normalized = teeName.trim().toLowerCase();
  const mapping = {
    azules: "Blue",
    blancas: "White",
    doradas: "Gold",
    rojas: "Red",
    negras: "Black",
    plateadas: "Silver",
  };
  return mapping[normalized] || teeName;
}

export async function POST(request) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id).select(
    "+grintPasswordEncrypted"
  );
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!actor.grintEmail || !actor.grintPasswordEncrypted) {
    return NextResponse.json(
      { error: "Credenciales de TheGrint no configuradas." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const scorecardId = body.scorecardId;
  if (!scorecardId) {
    return NextResponse.json({ error: "Scorecard requerido" }, { status: 400 });
  }

  const scorecard = await Scorecard.findById(scorecardId);
  if (!scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  if (scorecard.grintUploadedAt) {
    return NextResponse.json(
      { error: "La tarjeta ya fue cargada a TheGrint." },
      { status: 409 }
    );
  }
  const round = await Round.findById(scorecard.round);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (!scorecard.accepted) {
    return NextResponse.json(
      { error: "Scorecard no aceptada" },
      { status: 400 }
    );
  }
  if (String(scorecard.player) !== String(actor._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keepOpen = Boolean(process.env.GRINT_UPLOAD_KEEP_OPEN);
  const headless = Boolean(process.env.GRINT_UPLOAD_KEEP_OPEN);
  try {
    await withGrintUserPage(
      actor,
      async ({ page }) => {
        await page.goto("https://thegrint.com/score/add_full_score", {
          waitUntil: "domcontentloaded",
        });

        const searchValue = buildCourseSearchValue(round);
        const itemName = buildCourseItemName(round);
        const courseInput = page.locator("#ucourse");
        await courseInput.click();
        await courseInput.fill("");
        await courseInput.type(searchValue, { delay: 40 });
        await page.keyboard.press("ArrowDown");
        await page.waitForSelector(".suggestion", { timeout: 15000 });

        let suggestion = itemName
          ? page.locator(`.suggestion[item-name="${itemName}"]`).first()
          : null;
        if (suggestion && (await suggestion.count())) {
          await suggestion.click();
        } else {
          const candidates = page.locator(".suggestion");
          const count = await candidates.count();
          if (count > 0) {
            await candidates.first().click();
          }
        }

        await page.waitForSelector("#tees", { timeout: 15000 });
        const teeValue = mapTeeName(scorecard.teeName || "");
        if (teeValue) {
          const teeSelect = page.locator("#tees");
          await teeSelect.click();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await page.waitForFunction(
            (value) => {
              const select = document.querySelector("#tees");
              if (!select) return false;
              const options = Array.from(select.options || []);
              return options.some(
                (opt) =>
                  opt.value === value ||
                  opt.textContent?.trim().toLowerCase() === value.toLowerCase()
              );
            },
            teeValue,
            { timeout: 15000 }
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await page.selectOption("#tees", [
            { value: teeValue },
            { label: teeValue },
          ]);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await page.evaluate((value) => {
            const select = document.querySelector("#tees");
            if (!select) return;
            const options = Array.from(select.options || []);
            const match = options.find(
              (opt) =>
                opt.value === value ||
                opt.textContent?.trim().toLowerCase() === value.toLowerCase()
            );
            if (match) {
              select.value = match.value;
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, teeValue);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        await page.locator("#round").click();
        if (round.holes === 9) {
          await page.selectOption("#round", { value: "F9" });
          await page.evaluate(() => {
            const select = document.querySelector("#round");
            if (!select) return;
            select.value = "F9";
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          });
        } else {
          await page.selectOption("#round", { value: "18" });
          await page.evaluate(() => {
            const select = document.querySelector("#round");
            if (!select) return;
            select.value = "18";
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          });
        }

        for (const hole of scorecard.holes || []) {
          const holeNumber = hole.hole;
          if (holeNumber == null) {
            continue;
          }
          if (hole.strokes != null) {
            const input = page.locator(`input[name="scH${holeNumber}"]`);
            if (await input.count()) {
              await input.fill(String(hole.strokes));
            }
          }
          if (hole.putts != null) {
            const input = page.locator(`input[name="ptH${holeNumber}"]`);
            if (await input.count()) {
              await input.fill(String(hole.putts));
            }
          }
        }
        if (Boolean(process.env.GRINT_UPLOAD_PRIVATE_PRACTICE)) {
          await page.locator("#practice_score").setChecked(true);
          await page.locator("#private_score").setChecked(true);
        }

        await Promise.all([
          page.waitForURL("https://thegrint.com/score", { timeout: 20000 }),
          page.locator("a.tg-button-submit.submit").click(),
        ]);
      },
      { headless, keepOpen }
    );
    console.log('Tarjeta guardada')
    scorecard.grintUploadedAt = new Date();
    console.log(scorecard);
    await scorecard.save();
    console.log('Mongodb tarjeta guardada')
  } catch (error) {
    console.log('Error Grint: ', error);
    return NextResponse.json(
      { error: "No se pudo cargar la tarjeta." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, submitted: true });
}
