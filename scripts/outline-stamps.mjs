import { openSync } from "fontkit";

// Preserve browser text-on-path placement, but export actual glyph curves.
export async function outlineStamps(page) {
  await page.evaluate(() => document.fonts.ready);
  const font = openSync("site/fonts/plex-mono-500.woff2");
  const rings = await page.evaluate(() =>
    [...document.querySelectorAll(".stamp__ring text")].map((text) => {
      const style = getComputedStyle(text);
      const content = text.textContent
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
      return {
        size: parseFloat(style.fontSize),
        fill: style.fill,
        glyphs: [...content].map((char, i) => {
          const p = text.getStartPositionOfChar(i);
          return { char, x: p.x, y: p.y, angle: text.getRotationOfChar(i) };
        }),
      };
    }),
  );
  const paths = rings.map((ring) => ({
    fill: ring.fill,
    paths: ring.glyphs.map(({ char, x, y, angle }) => ({
      d: font.glyphForCodePoint(char.codePointAt(0)).path.toSVG(),
      transform: `translate(${x} ${y}) rotate(${angle}) scale(${ring.size / font.unitsPerEm} ${-ring.size / font.unitsPerEm})`,
    })),
  }));
  await page.evaluate((rings) => {
    document.querySelectorAll(".stamp__ring text").forEach((text, i) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("fill", rings[i].fill);
      group.setAttribute("data-name", "Stamp / Outlined circular lettering");
      for (const glyph of rings[i].paths) {
        if (!glyph.d) continue;
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", glyph.d);
        path.setAttribute("transform", glyph.transform);
        group.append(path);
      }
      text.replaceWith(group);
    });
  }, paths);
  return rings.length;
}
