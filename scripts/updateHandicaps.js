import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { chromium } from "playwright";
let connectDb;
let User;
 

function loadEnvFile(filename) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
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

async function login(page, email, password) {
  await page.goto("https://thegrint.com/dashboard", {
    waitUntil: "domcontentloaded",
  });
  const currentUrl = page.url();
  if (!currentUrl.includes("/passthru")) {
    return page;
  }
  await page
    .locator('a.btn.login-button-email:has-text("Sign in With Username or Email")')
    .first()
    .click();

  await page.waitForSelector("#usernameLogin", { timeout: 15000 });
  await page.waitForSelector("#pwdLogin", { timeout: 15000 });

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

async function extractHandicap(page, { userId }) {
  const res = await page.request.post(
    "https://thegrint.com/user/get_handicap_info/",
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: `user_id=${encodeURIComponent(userId)}&course_id=&tee=`,
    }
  );
  if (!res.ok()) {
    throw new Error(`No se pudo leer handicap (status ${res.status()})`);
  }
  const data = await res.json();
  const value = Number.parseFloat(
    String(data?.index_ghap || "").split('~')[0].replace(/[^\d.-]/g, "")
  );
  if (Number.isNaN(value)) {
    throw new Error("No se pudo leer handicap desde API");
  }
  return value;
}

async function run() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  if (!connectDb || !User) {
    const dbModule = await import("../lib/db.js");
    const userModule = await import("../lib/models/User.js");
    connectDb = dbModule.default;
    User = userModule.default;
  }

  const email = process.env.GRINT_EMAIL || (await prompt({ label: "Email: " }));
  const password =
    process.env.GRINT_PASSWORD ||
    (await prompt({ label: "Password: ", masked: true }));
  await connectDb();

  const users = [await User.findOne({
    grintId: { $exists: true, $ne: "" },
    active: true,
  })];
  if (!users.length) {
    console.log("No hay usuarios con ID Grint.");
    return;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const storageStatePath = path.join(scriptDir, "thegrint-storage.json");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    fs.existsSync(storageStatePath) ? { storageState: storageStatePath } : {}
  );
  const page = await context.newPage();

  try {
    const sessionPage = await login(page, email, password);
    for (const user of users) {
      try {
        // console.log(`Actualizando handicap ${user.name}`)
        const handicap = await extractHandicap(sessionPage, {
          userId: user.grintId,
        });
        await User.updateOne(
          { _id: user._id },
          { handicap, grintLastSync: new Date() }
        );
        console.log(`Actualizado ${user.name}: ${handicap}`);
        const delayMs = Math.floor(1000 + Math.random() * 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        console.error(`Error con ${user.name}: ${error.message}`);
      }
    }
    await context.storageState({ path: storageStatePath });
    console.log("Terminó");
  } finally {
    console.log("Finaliza y cierra navegador");
    await context.close();
    await browser.close();
    await mongoose.disconnect();
    console.log("Navegador cerrado");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
