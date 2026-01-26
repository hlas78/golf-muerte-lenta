import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { parseScorecardHtml } from "../lib/scorecardScraper.js";

function printUsage() {
  console.log("Usage: node scripts/parseScorecardUrl.js <url>");
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function loadEnvFile(filename) {
  const filePath = path.join(process.cwd(), filename);
  try {
    const content = await fs.readFile(filePath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const idx = trimmed.indexOf("=");
      if (idx === -1) {
        return;
      }
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value.replace(/^"(.*)"$/, "$1");
      }
    });
  } catch {
    // Ignore missing env files.
  }
}

function prompt({ label, masked = false }) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (masked) {
      rl.stdoutMuted = true;
      rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.stdoutMuted) {
          rl.output.write("*");
        } else {
          rl.output.write(stringToWrite);
        }
      };
    }
    rl.question(label, (answer) => {
      rl.close();
      if (masked) {
        process.stdout.write("\n");
      }
      resolve(answer);
    });
  });
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.count()) {
      await locator.first().fill(value);
      return true;
    }
  }
  return false;
}

async function login(page) {
  await page.goto("https://thegrint.com/dashboard", {
    waitUntil: "domcontentloaded",
  });
  if (!page.url().includes("/passthru")) {
    return page;
  }

  await page
    .locator('a.btn.login-button-email:has-text("Sign in With Username or Email")')
    .first()
    .click();

  await page.waitForSelector("#usernameLogin", { timeout: 15000 });
  await page.waitForSelector("#pwdLogin", { timeout: 15000 });

  const email = process.env.GRINT_EMAIL || (await prompt({ label: "Email: " }));
  const password =
    process.env.GRINT_PASSWORD ||
    (await prompt({ label: "Password: ", masked: true }));

  const filledEmail = await fillFirst(page, ["#usernameLogin"], email);
  const filledPassword = await fillFirst(page, ["#pwdLogin"], password);
  if (!filledEmail || !filledPassword) {
    throw new Error("No se encontraron los campos de login.");
  }
  const submit = page.locator("#submit-form-login");
  if (await submit.count()) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      submit.first().click(),
    ]);
  }
  return page;
}

async function loadHtml(target) {
  if (target.startsWith("file://")) {
    const filePath = fileURLToPath(target);
    return fs.readFile(filePath, "utf8");
  }
  if (isHttpUrl(target)) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const storageStatePath = path.join(scriptDir, "thegrint-storage.json");
    let hasStorageState = false;
    try {
      await fs.access(storageStatePath);
      hasStorageState = true;
    } catch {
      hasStorageState = false;
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(
      hasStorageState ? { storageState: storageStatePath } : {}
    );
    const page = await context.newPage();
    try {
      await login(page);
      await page.goto(target, { waitUntil: "domcontentloaded" });
      if (page.url().includes("/passthru")) {
        throw new Error("No se pudo iniciar sesion.");
      }
      await context.storageState({ path: storageStatePath });
      return await page.content();
    } finally {
      await context.close();
      await browser.close();
    }
  }
  return fs.readFile(target, "utf8");
}

async function main() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const target = process.argv[2];
  if (!target) {
    printUsage();
    process.exit(1);
  }

  const html = await loadHtml(target);
  const data = parseScorecardHtml(html);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
