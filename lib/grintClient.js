import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { decryptSecret } from "@/lib/grintSecrets";

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

async function loginIfNeeded(page, storageStatePath, { email, password }) {
  await page.goto("https://thegrint.com/dashboard", {
    waitUntil: "domcontentloaded",
  });
  if (!page.url().includes("/passthru")) {
    return;
  }

  if (!email || !password) {
    throw new Error("Credenciales de TheGrint no configuradas.");
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
  if (page.url().includes("/passthru")) {
    throw new Error("No se pudo iniciar sesion en TheGrint.");
  }
  await page.context().storageState({ path: storageStatePath });
}

export function getGrintSessionPath(userId) {
  const dir = path.join(process.cwd(), "data", "grint-sessions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${userId}.json`);
}

export async function withGrintPage(handler, options = {}) {
  const storageStatePath = path.join(
    process.cwd(),
    "scripts",
    "thegrint-storage.json"
  );
  const hasStorageState = fs.existsSync(storageStatePath);
  const headless = options.headless ?? process.env.NODE_ENV === "production";
  console.log(`headless: {headless}`)
  const keepOpen = options.keepOpen ?? false;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    hasStorageState ? { storageState: storageStatePath } : {}
  );
  const page = await context.newPage();
  try {
    const email = process.env.GRINT_EMAIL;
    const password = process.env.GRINT_PASSWORD;
    await loginIfNeeded(page, storageStatePath, { email, password });
    return await handler({ page });
  } finally {
    await context.storageState({ path: storageStatePath });
    if (!keepOpen) {
      await context.close();
      await browser.close();
    }
  }
}

export async function withGrintUserPage(user, handler, options = {}) {
  const storageStatePath = getGrintSessionPath(user._id);
  const hasStorageState = fs.existsSync(storageStatePath);
  const headless = options.headless ?? process.env.NODE_ENV === "production";
  console.log(`headless 2: {headless}`)
  const keepOpen = options.keepOpen ?? false;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(
    hasStorageState ? { storageState: storageStatePath } : {}
  );
  const page = await context.newPage();
  try {
    const email = user.grintEmail;
    const password = user.grintPasswordEncrypted
      ? decryptSecret(user.grintPasswordEncrypted)
      : null;
    await loginIfNeeded(page, storageStatePath, { email, password });
    return await handler({ page });
  } finally {
    await context.storageState({ path: storageStatePath });
    if (!keepOpen) {
      await context.close();
      await browser.close();
    }
  }
}

export async function verifyGrintCredentials(
  userId,
  email,
  password,
  options = {}
) {
  const storageStatePath = getGrintSessionPath(userId);
  const headless = options.headless ?? process.env.NODE_ENV === "production";
  console.log(`headless 3: {headless}`)
  const keepOpen = options.keepOpen ?? false;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginIfNeeded(page, storageStatePath, { email, password });
    await context.storageState({ path: storageStatePath });
    return true;
  } finally {
    if (!keepOpen) {
      await context.close();
      await browser.close();
    }
  }
}
