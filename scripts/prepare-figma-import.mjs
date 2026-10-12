// Import-safe decorations and semantic layer names, only for site/figma/.
import { writeFile } from "node:fs/promises";
import { outlineStamps } from "./outline-stamps.mjs";

export async function prepareFigmaImport(page, outDir) {
  await page.goto("http://127.0.0.1:5173/figma/");
  await page.evaluate(() => document.fonts.ready);
  await outlineStamps(page);
  const fields = page.locator(".lines:not(img)");
  const count = await fields.count();
  const assets = [];
  // Hide other content while capturing each decoration, including the CTA copy.
  const isolation = await page.addStyleTag({
    content:
      "body * { visibility: hidden !important; } .lines, .lines * { visibility: visible !important; }",
  });
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    const bounds = await field.boundingBox();
    const name = await field.evaluate((el) =>
      el.classList.contains("lines--left")
        ? "hero-lines-left"
        : el.classList.contains("lines--right")
          ? "hero-lines-right"
          : "cta-lines",
    );
    await field.screenshot({
      path: `${outDir}/${name}.png`,
      animations: "disabled",
    });
    assets.push({ name, width: bounds.width, height: bounds.height });
  }
  await isolation.evaluate((el) => el.remove());
  await page.evaluate((assets) => {
    document.querySelectorAll(".lines:not(img)").forEach((field, i) => {
      const asset = assets[i];
      const isCta = field.classList.contains("lines--cta");
      const img = document.createElement(isCta ? "div" : "img");
      img.className = `${field.className} figma-line-field`;
      img.src = `${asset.name}.png`;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.style.cssText = `width:${asset.width}px;height:${asset.height}px;bottom:auto`;
      if (isCta) {
        img.removeAttribute("src");
        img.style.cssText = `width:100%;height:100%;background-image:url("${asset.name}.png");background-repeat:repeat-x;background-size:${asset.width}px 100%`;
      }
      field.replaceWith(img);
    });
    const name = (el, label) => {
      el.dataset.name = label;
      // A semantic class also helps importers that name layers from CSS classes.
      const token = `figma-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, "")}`;
      el.setAttribute(
        "class",
        `${token} ${el.getAttribute("class") || ""}`.trim(),
      );
    };
    name(document.body, "Leavory / Desktop 1440");
    name(document.querySelector("main"), "Page / Main content");
    name(document.querySelector("header.nav"), "Navigation / Header");
    name(document.querySelector("footer"), "Footer / Brand and links");
    document.querySelectorAll("main > section").forEach((el, i) => {
      const title =
        el.querySelector("h1, h2")?.textContent.trim().replace(/\s+/g, " ") ||
        el.getAttribute("aria-label") ||
        el.className;
      name(el, `Section ${String(i + 1).padStart(2, "0")} / ${title}`);
    });
    const groups = {
      ".logo": "Brand / Logo",
      ".nav__links": "Navigation / Links",
      ".hero__head": "Hero / Heading",
      ".flow": "Hero / Pipeline flow",
      ".flow__stage": "Flow / Illustration",
      ".flow__canvas": "Flow / Sphere",
      ".flow__steps": "Flow / Steps",
      ".flow__out": "Flow / Fix first card",
      ".flow__note": "Flow / Status card",
      ".flow__sources": "Flow / Sources",
      ".stamp": "Brand / Circular stamp",
      ".app": "Product / Application preview",
      ".fig": "Product / Illustration",
      ".role": "Card / Audience",
      ".step": "Card / Process step",
      ".chip": "Component / Chip",
      ".pill": "Button",
      ".cta form": "Form / Request a demo",
      ".footer__mark": "Brand / Wordmark",
      ".figma-line-field": "Decoration / Lines",
    };
    for (const [selector, label] of Object.entries(groups)) {
      document.querySelectorAll(selector).forEach((el, i) => {
        const text = el.matches(".pill, .role, .step")
          ? el.textContent.trim().replace(/\s+/g, " ").slice(0, 70)
          : "";
        name(el, `${label} / ${text || String(i + 1).padStart(2, "0")}`);
      });
    }
  }, assets);
  await writeFile(`${outDir}/index.html`, await page.content());
  console.log(
    `Prepared Figma import: ${assets.length} line-field images and semantic layer names.`,
  );
}
