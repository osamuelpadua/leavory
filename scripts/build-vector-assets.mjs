// Export actual hero drawing coordinates and outlined brand lettering as SVG.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { create } from "fontkit";
import wawoff2 from "wawoff2";

const baseFont = create(
  Buffer.from(await wawoff2.decompress(readFileSync("site/fonts/geist.woff2"))),
);
const font = baseFont.getVariation({ wght: 600 });
const run = font.layout("Leavory");
const scaleY = 330 / font.unitsPerEm;
const scaleX = 1160 / run.positions.reduce((sum, p) => sum + p.xAdvance, 0);
let advance = 0;
const outlines = run.glyphs
  .map((glyph, i) => {
    const p = run.positions[i];
    const d = font
      .getGlyph(glyph.id)
      .path.scale(scaleX, -scaleY)
      .translate(20 + (advance + p.xOffset) * scaleX, 300 - p.yOffset * scaleY)
      .toSVG();
    advance += p.xAdvance;
    return `<path d="${d}"/>`;
  })
  .join("\n");
const stripes = (width, opacity) =>
  Array.from(
    { length: 150 },
    (_, i) =>
      `<rect x="${i * 8}" y="36" width="${width}" height="352" fill="#FFFFFF" fill-opacity="${opacity}"/>`,
  ).join("\n");
writeFileSync(
  "site/ds/wordmark.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="352" viewBox="0 36 1200 352">
<defs><clipPath id="lettering">${outlines}</clipPath></defs>
${stripes(1, 0.07)}
<g clip-path="url(#lettering)">${stripes(1.6, 0.42)}<rect x="56" y="36" width="3" height="90" fill="#C62A3D"/></g>
</svg>`,
);

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.route("**/js/hero-flow.js", (route) => {
    const source = readFileSync("site/js/hero-flow.js", "utf8").replace(
      "gl.drawArrays(gl.POINTS, 0, points);",
      "gl.drawArrays(gl.POINTS, 0, points); window.__vectorFrame = { width: W, points, data: Array.from(data.slice(0, n * 8)) };",
    );
    return route.fulfill({ contentType: "text/javascript", body: source });
  });
  await page.goto("http://127.0.0.1:5173/");
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
  const frame = await page.evaluate(() => window.__vectorFrame);
  if (!frame?.points) throw new Error("No hero drawing data captured");
  const f = (n) => Number(n.toFixed(4));
  const color = (d) =>
    `rgb(${d
      .slice(3, 6)
      .map((n) => Math.round(n * 255))
      .join(" ")})`;
  const points = Array.from({ length: frame.points }, (_, i) =>
    frame.data.slice(i * 8, i * 8 + 8),
  );
  const elements = [];
  for (let i = frame.points * 8; i < frame.data.length; i += 16) {
    const a = frame.data.slice(i, i + 8),
      b = frame.data.slice(i + 8, i + 16);
    elements.push(
      `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${color(a)}" stroke-opacity="${f((a[6] + b[6]) / 2)}" stroke-width="0.6"/>`,
    );
  }
  for (const d of points) {
    const [x, y, size, , , , alpha, mode] = d;
    if (alpha <= 0) continue;
    if (mode === 1) {
      // Concentric vector circles approximate the WebGL Gaussian halo.
      for (let k = 12; k >= 1; k--) {
        const t = k / 12;
        elements.push(
          `<circle cx="${f(x)}" cy="${f(y)}" r="${f((size * t) / 2)}" fill="${color(d)}" fill-opacity="${f((alpha * Math.exp(-5 * t * t)) / 7)}"/>`,
        );
      }
    } else if (mode === 2) {
      elements.push(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size * 0.31)}" fill="none" stroke="${color(d)}" stroke-opacity="${f(alpha)}" stroke-width="0.75"/>`,
      );
    } else {
      elements.push(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size / 2)}" fill="${color(d)}" fill-opacity="${f(alpha)}"/>`,
      );
    }
  }
  writeFileSync(
    "site/ds/sphere.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(frame.width)}" height="560" viewBox="0 0 ${f(frame.width)} 560">\n${elements.join("\n")}\n</svg>`,
  );
  console.log(
    `Exported sphere.svg (${frame.points} particles) and outlined wordmark.svg.`,
  );
} finally {
  await browser.close();
}
