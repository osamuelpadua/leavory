// Exports the still hero image (reduced motion and no-WebGL fallback) from the
// live scene in js/hero-scan.js, so both always look the same.
// Usage: node scripts/capture-hero.mjs
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:5173";
const reachable = () =>
  fetch(base).then(
    () => true,
    () => false,
  );

let server;
if (!(await reachable())) {
  server = spawn(process.execPath, ["scripts/serve.mjs"], { stdio: "ignore" });
  for (let i = 0; i < 50 && !(await reachable()); i++)
    await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem("leavory-intro", "1"));
  await page.goto(`${base}/?capture`);
  await page.waitForFunction(() => typeof window.heroCapture === "function");
  for (const size of [1000, 640]) {
    const url = await page.evaluate((s) => window.heroCapture(s), size);
    const file = `site/img/obj-scan-${size}.webp`;
    await writeFile(file, Buffer.from(url.split(",")[1], "base64"));
    console.log(`wrote ${file}`);
  }
} finally {
  await browser.close();
  server?.kill();
}
