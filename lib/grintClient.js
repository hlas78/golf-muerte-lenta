import fs from "fs";
import path from "path";
import { chromium } from "playwright";

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

async function loginIfNeeded(page, storageStatePath) {
  await page.goto("https://thegrint.com/dashboard", {
    waitUntil: "domcontentloaded",
  });
  if (!page.url().includes("/passthru")) {
    return;
  }

  const email = process.env.GRINT_EMAIL;
  const password = process.env.GRINT_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan GRINT_EMAIL o GRINT_PASSWORD en env.");
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

export async function withGrintPage(handler) {
  const storageStatePath = path.join(
    process.cwd(),
    "scripts",
    "thegrint-storage.json"
  );
  const hasStorageState = fs.existsSync(storageStatePath);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    hasStorageState ? { storageState: storageStatePath } : {}
  );
  const page = await context.newPage();
  try {
    await loginIfNeeded(page, storageStatePath);
    return await handler({ page });
  } finally {
    await context.storageState({ path: storageStatePath });
    await context.close();
    await browser.close();
  }
}
