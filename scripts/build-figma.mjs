// Builds site/figma/: a frozen, script-free copy of the landing page for importing
// into Figma with html.to.design. It opens the live page at 1440px, waits
// for the Fix step, then freezes it: the WebGL sphere and the striped
// wordmark become images, icon sprites are inlined, scripts are removed,
// and figma.css turns off motion, backdrop blur and other effects the
// importer does not support. Usage: node scripts/build-figma.mjs
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:5173";
const outDir = "site/figma";
const WIDTH = 1440;
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

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: 1000 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${base}/`);
  await page.evaluate(() => document.fonts.ready);
  // The Fix step, with its status notes done and the output lit.
  await page.waitForFunction(
    () => document.querySelector(".flow")?.dataset.stage === "3",
    null,
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".flow__note.is-done").length === 2,
    null,
    { timeout: 10000 },
  );
  await page.waitForTimeout(400);

  // 1. The sphere: hide everything else in the stage, shoot the canvas.
  // A transparent PNG, so the wires drawn under it stay visible.
  await page.addStyleTag({
    content:
      "html,body,.hero,.flow{background:transparent!important}.lines{visibility:hidden}",
  });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".flow__stage > *"))
      if (!el.matches(".flow__canvas")) el.style.visibility = "hidden";
  });
  await page
    .locator(".flow__canvas")
    .screenshot({ path: `${outDir}/sphere.png`, omitBackground: true });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".flow__stage > *"))
      el.style.visibility = "";
    document.querySelector("style:last-of-type")?.remove();
  });

  // 2. The wordmark: its pattern fill and text clip become one image.
  await page.locator(".footer__mark svg").scrollIntoViewIfNeeded();
  await page
    .locator(".footer__mark svg")
    .screenshot({ path: `${outDir}/wordmark.png` });

  // 3. Freeze the DOM.
  const html = await page.evaluate((WIDTH) => {
    const doc = document;
    doc.documentElement.classList.remove("js");

    // Lock the flow to its current size, in plain pixels.
    const flow = doc.querySelector(".flow");
    const stage = doc.querySelector(".flow__stage");
    const fr = flow.getBoundingClientRect();
    const u = fr.height / 560;
    const side = Math.min(56, Math.max(24, WIDTH * 0.04));
    flow.style.cssText = `width:${fr.width}px;height:${fr.height}px;container-type:normal`;
    stage.style.cssText = [
      `--u:${u}px`,
      `--dx-left:${side - 150 * u}px`,
      `--dx-mid:${fr.width / 2 - 600 * u}px`,
      `--dx-end:${fr.width - side - 1050 * u}px`,
    ].join(";");
    const canvas = stage.querySelector(".flow__canvas");
    const sphere = doc.createElement("img");
    sphere.className = "flow__canvas";
    sphere.src = "sphere.png";
    sphere.alt = "";
    canvas.replaceWith(sphere);
    flow.classList.add("is-live");

    // Pin the Fix step: the live cycle may have moved on while capturing.
    flow.dataset.stage = "3";
    doc
      .querySelectorAll(".flow__steps span")
      .forEach((el, i) => el.classList.toggle("is-on", i === 3));
    doc.querySelector(".flow__out").classList.add("is-hot");
    const notes = { a: "Drafting the fix…", c: "Ranking by EPSS…" };
    for (const note of doc.querySelectorAll(".flow__note")) {
      const text = notes[note.dataset.slot];
      note.classList.toggle("is-on", Boolean(text));
      note.classList.toggle("is-done", Boolean(text));
      note.querySelector(".flow__note-step").textContent = text
        ? "Step 04 · Fix"
        : "";
      note.querySelector(".flow__note-text").textContent = text || "";
      if (!text) note.remove();
    }
    for (const lead of doc.querySelectorAll(".flow__lead"))
      if (notes[lead.dataset.slot]) lead.classList.add("is-on");
      else lead.remove();

    // Line-field bars: keep each where it rests.
    for (const bar of doc.querySelectorAll(".lines__bar")) {
      const t = getComputedStyle(bar).transform;
      bar.style.transform = t === "none" ? "" : t;
    }

    // Wordmark image.
    const mark = doc.querySelector(".footer__mark svg");
    const img = doc.createElement("img");
    img.src = "wordmark.png";
    img.alt = "";
    img.width = Math.round(mark.getBoundingClientRect().width);
    img.height = Math.round(mark.getBoundingClientRect().height);
    mark.replaceWith(img);

    // Inline every sprite icon, so no <use> references are left.
    const symbols = new Map(
      [...doc.querySelectorAll("symbol")].map((s) => [s.id, s]),
    );
    for (const use of doc.querySelectorAll("use")) {
      const id = (use.getAttribute("href") || "").slice(1);
      const symbol = symbols.get(id);
      const svg = use.closest("svg");
      if (!symbol || !svg) continue;
      if (symbol.getAttribute("viewBox"))
        svg.setAttribute("viewBox", symbol.getAttribute("viewBox"));
      for (const attr of [
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
      ])
        if (symbol.getAttribute(attr) && !svg.getAttribute(attr))
          svg.setAttribute(attr, symbol.getAttribute(attr));
      use.replaceWith(...[...symbol.childNodes].map((n) => n.cloneNode(true)));
    }
    doc.querySelector("svg.sprite")?.remove();

    // Static page: everything revealed, no scripts, nothing hidden.
    for (const el of doc.querySelectorAll("[data-reveal]"))
      el.classList.add("is-visible");
    for (const el of doc.querySelectorAll(
      "script, .skip-link, #mobile-navigation, .nav__toggle, .motion-toggle",
    ))
      el.remove();

    // A working copy, not a page to share or index.
    for (const el of doc.querySelectorAll(
      'link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"]',
    ))
      el.remove();
    const robots = doc.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    doc.querySelector('meta[name="viewport"]').after(robots);
    for (const el of doc.querySelectorAll(".lines"))
      el.classList.remove("is-paused");

    // Paths and stylesheet for site/figma/.
    const css = doc.querySelector('link[rel="stylesheet"]');
    css.setAttribute("href", "../css/styles.css");
    for (const link of doc.querySelectorAll(
      'link[rel="icon"], link[rel="preload"]',
    ))
      link.setAttribute("href", "../" + link.getAttribute("href"));
    const extra = doc.createElement("link");
    extra.rel = "stylesheet";
    extra.href = "figma.css";
    css.after(extra);
    doc.title = "Leavory — Figma import (static)";
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  }, WIDTH);
  await writeFile(`${outDir}/index.html`, html);
  console.log(`wrote ${outDir}/index.html, sphere.png, wordmark.png`);
} finally {
  await browser.close();
  server?.kill();
}
