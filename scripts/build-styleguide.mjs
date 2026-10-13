// Builds site/ds/index.html: the design system of the landing page, as one
// static page made for importing into Figma with html.to.design. Real
// markup (icons, isotype, figures, product window) is copied from
// site/index.html with every <use> inlined, so the guide always
// shows what the site ships. Usage: node scripts/build-styleguide.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { outlineStamps } from "./outline-stamps.mjs";

const src = readFileSync("site/index.html", "utf8");
const pick = (re, label) => {
  const m = src.match(re);
  if (!m) throw new Error(`not found: ${label}`);
  return m[0];
};
const all = (re) => [...src.matchAll(re)].map((m) => m[0]);

/* ---------- Inline the sprite ---------- */
const symbols = new Map(
  [...src.matchAll(/<symbol id="([\w-]+)"([^>]*)>([\s\S]*?)<\/symbol>/g)].map(
    ([, id, attrs, body]) => [
      id,
      { viewBox: (attrs.match(/viewBox="([^"]+)"/) || [])[1], body },
    ],
  ),
);
let uid = 0;
let fieldBars = 0;
const inline = (html) =>
  html.replace(
    /(<svg\b[^>]*>)(\s*)<use href="#([\w-]+)"\s*\/>/g,
    (m, open, ws, id) => {
      const s = symbols.get(id);
      if (!s) throw new Error(`symbol ${id}`);
      // Ids inside a symbol (masks) must stay unique per copy.
      const n = ++uid;
      const body = s.body
        .replace(/id="([\w-]+)"/g, `id="$1-${n}"`)
        .replace(/url\(#([\w-]+)\)/g, `url(#$1-${n})`);
      const tag =
        /viewBox=/.test(open) || !s.viewBox
          ? open
          : open.replace("<svg", `<svg viewBox="${s.viewBox}"`);
      return tag + ws + body;
    },
  );
const icon = (id, size = 24, attrs = "") =>
  inline(
    `<svg width="${size}" height="${size}" aria-hidden="true"${attrs}><use href="#${id}" /></svg>`,
  );

/* ---------- Real markup from the site ---------- */
const figs = all(/<svg\s+class="iso"[\s\S]*?<\/svg>/g);
const steps = all(/<svg\s+class="iso iso--step"[\s\S]*?<\/svg>/g);
const caps = all(/<svg\s+class="cap-icon"[\s\S]*?<\/svg>/g);
const app = inline(pick(/<figure\s+class="app"[\s\S]*?<\/figure>/, "app"));
if (figs.length !== 3 || steps.length !== 4 || caps.length !== 5)
  throw new Error(`figures ${figs.length}/${steps.length}/${caps.length}`);

const stampEl = inline(
  pick(
    /<div class="stamp stamp--sources"[\s\S]*?<svg class="stamp__mark">[\s\S]*?<\/svg>\s*<\/div>/,
    "stamp",
  ),
).replace(" stamp--sources", "");

/* ---------- Doc helpers ---------- */
const section = (no, title, lede, body) => `
  <section class="sg-section" aria-labelledby="sg-${no}">
    <header class="sg-head">
      <p class="sg-no">${no}</p>
      <h2 id="sg-${no}">${title}</h2>
      ${lede ? `<p class="sg-lede">${lede}</p>` : ""}
    </header>
    ${body}
  </section>`;
const spec = (name, ...lines) =>
  `<p class="sg-spec"><b>${name}</b>${lines.map((l) => `<span>${l}</span>`).join("")}</p>`;
const tile = (content, name, ...lines) =>
  `<figure class="sg-tile"><div class="sg-stage">${content}</div>${spec(name, ...lines)}</figure>`;
const group = (title, items, cols = 3) =>
  `<div class="sg-group"><h3 class="sg-group__title">${title}</h3><div class="sg-grid" style="--cols:${cols}">${items.join("")}</div></div>`;

/* ---------- 01 Logo ---------- */
// The header proportion, scaled: mark 1.2× the type size, gap 0.4×.
const lockup = (size = 20, color = "") => {
  const m = Math.round(size * 1.2);
  return `<span class="logo" style="font-size:${size}px;gap:${Math.round(size * 0.4)}px${color}">${icon("i-mark", m, ` class="logo__mark" style="width:auto;height:${m}px${color}"`)}<span>Leavory</span></span>`;
};
const logo = section(
  "01",
  "Logo",
  "A shield cut through by three diagonal lines, in brand red, next to the wordmark set in the headline type.",
  group(
    "Lockup and isotype",
    [
      tile(
        `<div class="sg-center sg-pad">${lockup(38)}</div>`,
        "Primary lockup",
        "Isotype Brand/Red · wordmark Neutral/White",
        "Geist Medium · letter spacing −4%",
      ),
      tile(
        `<div class="sg-center sg-pad">${icon("i-mark", 80, ' class="logo__mark" style="width:auto;height:80px"')}</div>`,
        "Isotype",
        "Shield 18 × 21.5 · fill Brand/Red",
      ),
      tile(
        `<div class="sg-center sg-pad sg-light">${lockup(40, ";color:#1e1c1b")}</div>`,
        "On light",
        "Single colour Neutral/Ink",
      ),
    ],
    3,
  ) +
    group(
      "Sizes and space",
      [
        tile(
          `<div class="sg-row sg-pad">${[16, 20, 24, 32].map((s) => `<div class="sg-stack">${icon("i-mark", s, ` class="logo__mark" style="width:auto;height:${s}px"`)}<span class="sg-cap">${s}px</span></div>`).join("")}</div>`,
          "Minimum size",
          "Isotype 16px · lockup 20px type",
        ),
        tile(
          `<div class="sg-center sg-pad"><div class="sg-clear">${lockup(32)}</div></div>`,
          "Clear space",
          "≥ isotype height on every side",
        ),
        tile(
          `<div class="sg-center sg-pad"><img src="../favicon.svg" width="64" height="64" alt="" /><img src="../favicon.svg" width="32" height="32" alt="" /><img src="../favicon.svg" width="16" height="16" alt="" /></div>`,
          "Favicon",
          "32 × 32 · Ink tile, radius 7",
        ),
      ],
      3,
    ) +
    `<p class="sg-note">Don’t stretch, outline, recolour (other than White, or Ink on light backgrounds) or add effects to the mark.</p>`,
);

/* ---------- 02 Colour ---------- */
const swatch = (bg, name, token, value, dark = true) =>
  `<figure class="sg-swatch"><div class="sg-swatch__chip" style="background:${bg}${dark ? "" : ";box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.14)"}"></div>${spec(name, token, value)}</figure>`;
const alpha = (a, name, token, use) =>
  `<figure class="sg-swatch"><div class="sg-swatch__chip sg-swatch__chip--alpha"><span style="background:rgb(255 255 255 / ${a})"></span></div>${spec(name, token, `#FFFFFF · ${Math.round(a * 1000) / 10}%`, use)}</figure>`;
const colour = section(
  "02",
  "Colour",
  "Four colours and their transparencies, nothing else. Every surface, line and text tone is one of these.",
  `<div class="sg-swatches">${[
    swatch(
      "#c62a3d",
      "Red",
      "Brand/Red",
      "#C62A3D · buttons, accents, findings",
    ),
    swatch(
      "#d21e38",
      "Red type",
      "Brand/Red Type",
      "#D21E38 · large red type only",
    ),
    swatch("#1e1c1b", "Ink", "Neutral/Ink", "#1E1C1B · background", false),
    swatch(
      "#ffffff",
      "White",
      "Neutral/White",
      "#FFFFFF · text, primary button",
    ),
  ].join("")}</div>` +
    group(
      "Transparencies of white, on ink",
      [
        alpha(1, "Text", "White/100", "Primary text"),
        alpha(0.68, "Text secondary", "White/68", "Secondary text"),
        alpha(0.54, "Text tertiary", "White/54", "Labels, captions"),
        alpha(0.14, "Rule", "White/14", "Rules, dividers"),
        alpha(0.08, "Hairline", "White/8", "Hairlines"),
      ],
      5,
    ) +
    `<p class="sg-note">Contrast: red type on ink is about 3.2:1, so red is used for large type and shapes only; small text is white or its transparencies.</p>`,
);

/* ---------- 03 Type ---------- */
// Text styles, specified the way a design tool shows them.
const typeRow = (sample, name, font, desktop, mobile, track, cls = "") =>
  `<div class="sg-type"><div class="sg-type__sample ${cls}">${sample}</div>${spec(name, `${font} · ${desktop}`, `Letter spacing ${track}${mobile ? ` · Mobile ${mobile}` : ""}`)}</div>`;
const type = section(
  "03",
  "Typography",
  "Geist for everything you read, IBM Plex Mono for labels, numbers and data. Large headlines can split into two tones: grey, then white.",
  `<div class="sg-fonts">
      <div class="sg-font"><p class="sg-font__big">Aa</p>${spec("Geist", "Regular · Medium · Semibold", "Headlines, interface, body")}</div>
      <div class="sg-font sg-font--mono"><p class="sg-font__big">Aa</p>${spec("IBM Plex Mono", "Regular · Medium", "Labels, numbers, data")}</div>
    </div>` +
    `<div class="sg-types">${[
      typeRow(
        '<span style="color:rgb(255 255 255 / 0.54)">Know exactly which vulnerabilities</span> to fix first.',
        "Display / XL",
        "Geist Medium",
        "68 / 70",
        "36 / 38",
        "−4%",
        "t-display",
      ),
      typeRow(
        "Your whole estate in one view.",
        "Display / L",
        "Geist Medium",
        "76 / 78",
        "38 / 40",
        "−4%",
        "t-display",
      ),
      typeRow(
        "From a new CVE to the fix",
        "Heading / H2",
        "Geist Medium",
        "58 / 60",
        "34 / 36",
        "−4%",
        "t-h2",
      ),
      typeRow(
        'Leavory replaces tracking spreadsheets and scattered alerts. <span style="color:rgb(255 255 255 / 0.54)">A single place where risk, context, and recommendation live together.</span>',
        "Heading / Statement",
        "Geist Medium",
        "50 / 55",
        "28 / 31",
        "−3.5%",
        "t-statement",
      ),
      typeRow(
        "Everything your security team needs, without the noise.",
        "Heading / H3",
        "Geist Medium",
        "28 / 34",
        "22 / 26",
        "−2.5%",
        "t-h3",
      ),
      typeRow(
        "Projects and DORA metrics",
        "Heading / Card",
        "Geist Medium",
        "20 / 24",
        "",
        "−2.5%",
        "t-card",
      ),
      typeRow(
        "Leavory turns the scan results from your Azure DevOps, GitHub, and GitLab pipelines into a short list of what to fix today.",
        "Body / Lede",
        "Geist Regular",
        "18 / 27",
        "16 / 24",
        "0%",
        "t-lede",
      ),
      typeRow(
        "Connect once and Leavory maps projects, repositories, and pipelines on its own, in the background.",
        "Body / Default",
        "Geist Regular",
        "15 / 22",
        "",
        "0%",
        "t-body",
      ),
      typeRow(
        "Your pipelines",
        "Label / Caps",
        "IBM Plex Mono Medium",
        "12 / 12 · Uppercase",
        "11 / 11",
        "8%",
        "t-label",
      ),
      typeRow(
        "auth-service",
        "Data / Mono",
        "IBM Plex Mono Regular",
        "12 / 17",
        "",
        "0%",
        "t-data",
      ),
    ].join("")}</div>`,
);

/* ---------- 04 Grid ---------- */
const cols = (n, label) =>
  `<div class="sg-cols"><div class="sg-cols__bar" style="--n:${n}">${Array.from({ length: n }, () => "<span></span>").join("")}</div>${spec(label, `${n} columns`)}</div>`;
const grid = section(
  "04",
  "Grid and layout",
  "Content sits on a centred container, 1440px at most, with fluid side gutters.",
  `<div class="sg-container"><div class="sg-container__inner"><span>Max content width · 1440</span></div><span class="sg-container__g">Margins · Desktop 64 · Tablet 32 · Mobile 20</span></div>` +
    `<div class="sg-colsets">${[
      cols(2, "Feature heads, security, header"),
      cols(3, "Capabilities, Azure cells, sources"),
      cols(4, "Roles, timeline"),
      cols(5, "Platform capabilities"),
    ].join("")}</div>` +
    `<table class="sg-table"><thead><tr><th>Breakpoint</th><th>Changes</th></tr></thead><tbody>
      <tr><td>≤ 1100px</td><td>Product window drops its sidebar; Platform, roles and timeline go to 2 columns</td></tr>
      <tr><td>≤ 960px</td><td>Links move into a menu beside a compact demo button; heads, figures and cells stack to 1 column</td></tr>
      <tr><td>≤ 760px</td><td>Hero flow crops to the sphere; hero line panels and output panel hide; status notes shift left</td></tr>
      <tr><td>≤ 560px</td><td>Roles and timeline 1 column; demo form stacks</td></tr>
      <tr><td>≤ 480px</td><td>Header demo button tightens; product table hides its status column</td></tr>
    </tbody></table>`,
);

/* ---------- 05 Space, radius, lines ---------- */
const space = section(
  "05",
  "Spacing, radius and lines",
  "",
  `<div class="sg-spaces">${[4, 8, 12, 16, 24, 32, 48, 56, 64, 80, 96, 120, 160]
    .map(
      (s) =>
        `<div class="sg-space"><span style="width:${s}px"></span><b>${s}</b></div>`,
    )
    .join("")}</div>` +
    group(
      "Radius",
      [
        tile(
          `<div class="sg-center sg-pad"><div class="sg-radius" style="border-radius:10px"></div></div>`,
          "Control",
          "Radius/Control · 10",
          "Buttons, chips, inputs, tiles",
        ),
        tile(
          `<div class="sg-center sg-pad"><div class="sg-radius" style="border-radius:14px;width:180px"></div></div>`,
          "Panel",
          "Radius/Panel · 14",
          "Cells, product window, boundary frame",
        ),
        tile(
          `<div class="sg-center sg-pad"><div class="sg-radius" style="border-radius:5px;width:64px;height:28px"></div></div>`,
          "Badge",
          "5px",
          "Severity badges",
        ),
      ],
      3,
    ) +
    group(
      "Lines",
      [
        tile(
          `<div class="sg-center sg-pad"><span class="sg-rule" style="border-top-color:rgb(255 255 255/0.08)"></span></div>`,
          "Hairline",
          "1px · White/8",
        ),
        tile(
          `<div class="sg-center sg-pad"><span class="sg-rule" style="border-top-color:rgb(255 255 255/0.14)"></span></div>`,
          "Rule",
          "1px · White/14",
        ),
        tile(
          `<div class="sg-center sg-pad"><span class="sg-rule" style="border-top:1px dashed rgb(255 255 255/0.24)"></span></div>`,
          "Boundary",
          "1px dashed · white 24%",
        ),
      ],
      3,
    ),
);

/* ---------- 06 Surfaces ---------- */
const surfaces = section(
  "06",
  "Surfaces and effects",
  "",
  group(
    "Surfaces",
    [
      tile(
        `<div class="sg-pad sg-center"><div class="sg-glass">Liquid glass</div></div>`,
        "Liquid glass",
        "Background blur 8 · fill White 3–10% linear",
        "Stroke inside 1px White/4 · top highlight White/14",
      ),
      tile(
        `<div class="sg-pad sg-center"><div class="sg-tonal">Tonal</div></div>`,
        "Tonal shape",
        "Gradient white 10% → 3% on ink",
        "Inner highlight 1px white 10%",
      ),
      tile(
        `<div class="sg-pad sg-center"><div class="sg-glow"></div></div>`,
        "Red glow",
        "Drop shadow Brand/Red 30–45% · blur 36–44",
        "Active Fix pieces only",
      ),
    ],
    3,
  ) +
    group(
      "Line field",
      [
        tile(
          readFileSync("site/ds/line-field.svg", "utf8")
            .replace("<svg ", '<svg class="sg-field-vector" ')
            // Bars rise through the field like the site's; the negative delay
            // starts each one where the static drawing places it.
            .replace(
              /<rect x="([\d.]+)" y="(\d+)" width="2" height="(\d+)"/g,
              (m, x, y, h) => {
                const dur = [4.4, 3.6, 5.8, 6.4][fieldBars++ % 4];
                const delay = (((220 - y) / (220 + Number(h))) * dur).toFixed(
                  2,
                );
                return `<rect class="sg-field-bar" style="--y:${y}px;--h:${h}px;--dur:${dur}s;--delay:-${delay}s" x="${x}" y="${y}" width="2" height="${h}"`;
              },
            ),
          "Line field",
          "Hairlines every 12px · white 5.5%",
          "Bars 2px, 48–120px, white 32% · one red per field · rise 3.2–6.6s",
        ),
      ],
      1,
    ),
);

/* ---------- 07 Components ---------- */
const sev = (k, t) => `<span class="sev sev--${k}">${t}</span>`;
const note = (step, text, done) =>
  `<div class="flow__note is-on${done ? " is-done" : ""}"><span class="flow__spin"></span><span class="flow__note-body"><span class="flow__note-step">${step}</span><span class="flow__note-text">${text}</span></span><span class="flow__note-bar"></span></div>`;
const components = section(
  "07",
  "Components",
  "Core components and their states.",
  group(
    "Navigation",
    [
      tile(
        `<header class="nav sg-nav"><div class="wrap nav__inner">${`<a class="logo">${icon("i-mark", 24, ' class="logo__mark"')}<span>Leavory</span></a>`}<nav class="nav__links" aria-label="Header sample"><a>Product</a><a>Azure DevOps</a><a>Who it’s for</a><a>How it works</a><a>Security</a></nav><a class="pill pill--light nav__cta">Request a demo</a></div></header>`,
        "Header · Desktop",
        "Full-width bar · height 68 · glass · bottom rule White/14",
        "Links Body 14 · White/68, active White",
      ),
      tile(
        `<div class="sg-pad"><header class="nav sg-nav sg-nav--mobile"><div class="wrap nav__inner"><a class="logo">${icon("i-mark", 24, ' class="logo__mark"')}<span>Leavory</span></a><a class="pill pill--light nav__cta">Request a demo</a><span class="nav__toggle">${icon("i-menu", 18)}</span></div></header></div>`,
        "Header · ≤ 960px",
        "Logo · compact demo button · menu toggle 38, gap 8",
        "≤ 480px the button tightens to padding 11, type 13",
      ),
    ],
    1,
  ) +
    group(
      "Buttons and links",
      [
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light">Request a demo</a></div>`,
          "Primary · Default",
          "Fill White · label Ink, Geist Medium 14",
          "Height 34 · radius 10",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light" style="background-color:rgb(255 255 255 / 0.86)">Request a demo</a></div>`,
          "Primary · Hover",
          "Fill White/86",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light" style="background-color:rgb(255 255 255 / 0.78)">Request a demo</a></div>`,
          "Primary · Pressed",
          "Fill White/78",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light" style="outline:2px solid #fff;outline-offset:3px">Request a demo</a></div>`,
          "Focus visible · every control",
          "Outline 2px White · offset 3",
          "Chips and inputs: offset 2",
        ),
        tile(
          `<div class="sg-center sg-pad"><span class="nav__toggle" style="display:grid">${icon("i-menu", 18)}</span><span class="motion-toggle">${icon("i-pause", 16)}</span><span class="motion-toggle">${icon("i-play", 16)}</span></div>`,
          "Icon buttons",
          "Glass · radius 10 · menu 38 · pause 36",
          "Pause / play: pressed state swaps the icon",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light" style="height:44px;padding:0 20px;font-size:15px">Request a demo</a></div>`,
          "Primary · Large",
          "Height 44 · Geist Medium 15",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="more">See how it works ${icon("i-arrow", 14)}</a></div>`,
          "Text link · Default",
          "Body 15 · White/68 + arrow",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="more" style="color:#fff">See how it works ${icon("i-arrow", 14)}</a></div>`,
          "Text link · Hover",
          "White",
        ),
        tile(
          `<div class="sg-center sg-pad"><nav class="nav__links" style="display:flex"><a>Product</a><a style="color:#fff">How it works</a></nav></div>`,
          "Nav link · Default / Hover",
          "Body 14 · White/68 → White",
        ),
      ],
      3,
    ) +
    group(
      "Form",
      [
        tile(
          `<div class="sg-center sg-pad" style="gap:8px"><label class="chip"><input type="radio" checked />${icon("i-azure", 16)}<span>Azure DevOps</span></label><label class="chip"><input type="radio" />${icon("i-github", 16)}<span>GitHub</span></label><label class="chip"><input type="radio" />${icon("i-gitlab", 16)}<span>GitLab</span></label></div>`,
          "Platform chips",
          "36px · glass · selected: white 16%",
        ),
        tile(
          `<div class="sg-pad"><div class="cta__row"><input type="email" placeholder="you@yourcompany.com" /><button class="pill pill--light">Request a demo</button></div></div>`,
          "Email + submit",
          "44px · glass input",
        ),
        tile(
          `<div class="sg-pad"><div class="cta__row"><input type="email" value="dev@" aria-label="Work email" aria-invalid="true" /><button class="pill pill--light">Request a demo</button></div><p class="cta__error">Enter a valid work email.</p><p class="cta__note">A real conversation with an engineer.</p></div>`,
          "Email · Invalid",
          "Rim 1px Brand/Red 90% · message: red dot + 14px",
          "Linked with aria-describedby · note 14 · White/54",
        ),
      ],
      3,
    ) +
    group(
      "Badges and status",
      [
        tile(
          `<div class="sg-center sg-pad" style="gap:10px">${sev("critical", "Critical")}${sev("secret", "Secret")}${sev("high", "High")}${sev("medium", "Medium")}</div>`,
          "Severity",
          "22px · 11.5px 600 · radius 5",
          "Critical red · Secret white · High red outline · Medium white outline",
        ),
        tile(
          `<div class="sg-center sg-pad" style="gap:18px"><span class="status">New</span><span class="status status--ai">AI analyzed</span></div>`,
          "Status",
          "12.5 · White/68 · ring or red diamond",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow">${sev("critical", "Critical").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}${sev("secret", "Secret").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}${sev("high", "High").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}</div>`,
          "Severity, compact",
          "Used in the Fix first panel",
        ),
      ],
      3,
    ) +
    group(
      "Hero flow",
      [
        tile(
          `<div class="sg-center sg-pad sg-flow" style="gap:10px"><span class="flow__tile">${icon("i-azure", 20)}</span><span class="flow__tile is-active">${icon("i-github", 20)}</span><span class="flow__tile is-trivy is-hot">${icon("i-trivy", 20)}</span><span class="flow__tile">OSV</span></div>`,
          "Source tile",
          "46px · tonal · radius 10",
          "Default · Active · Highlight",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow">${note("Step 02 · Scan", "Trivy runs in your pipeline…", false)}</div>`,
          "Live status · running",
          "Glass · spinner · progress bar",
          "Step Plex Mono 10.5 · text Geist Medium 13.5",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow">${note("Step 04 · Fix", "Drafting the fix…", true)}</div>`,
          "Live status · done",
          "Spinner turns into a check",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow"><div class="flow__out is-hot"><p class="flow__out-title">Fix first</p><ol class="flow__out-list"><li style="--i:0">${sev("critical", "Critical").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}auth-service</li><li style="--i:1">${sev("secret", "Secret").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}infra-terraform</li><li style="--i:2">${sev("high", "High").replace("sev ", "flow__sev ").replace("sev--", "flow__sev--")}checkout-web</li></ol></div></div>`,
          "Fix first panel",
          "Glass · red rim at Fix",
          "Rows Plex Mono 12 · compact severity",
        ),
      ],
      3,
    ) +
    group(
      "Steps",
      [
        tile(
          `<div class="sg-center sg-pad sg-flow"><div class="flow__steps"><span>Connect</span><span>Scan</span><span class="is-on">Cross-reference</span><span>Fix</span></div></div>`,
          "Steps",
          "Glass · Geist Medium 13 · uppercase · 8%",
          "Active: white; Fix active: red + glow",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow"><div class="flow__steps"><span>Connect</span><span>Scan</span><span>Cross-reference</span><span class="is-on">Fix</span></div></div>`,
          "Steps · Fix",
          "Fix step active",
        ),
      ],
      2,
    ) +
    group(
      "Cards",
      [
        tile(
          `<div class="sg-pad"><ol class="cells" style="margin:0;grid-template-columns:1fr"><li><span class="mono">01</span><h3>Mirrors your organization</h3><p>Projects, repositories, and pipelines are discovered in the hierarchy you already use. Nothing to recreate or tag by hand.</p></li></ol></div>`,
          "Numbered cell",
          "Glass panel · radius 14 · padding 28",
        ),
        tile(
          `<div class="sg-pad"><ul class="roles__grid" style="margin:0;grid-template-columns:1fr"><li>${icon("i-shield", 20)}<h3>Security teams</h3><p>Stop triaging thousands of CVEs. See only what hits your packages and is being exploited.</p></li></ul></div>`,
          "Role",
          "Rule White/14 · icon 20 Brand/Red",
        ),
        tile(
          `<div class="sg-pad"><ul class="caps__grid" style="grid-template-columns:1fr"><li style="padding:8px 0">${caps[0]}<h3>Dashboard</h3><p>Know in one screen whether you are safer than last week.</p></li></ul></div>`,
          "Capability",
          "Line icon 96×72 · title 20px",
        ),
        tile(
          `<div class="sg-pad"><ol class="timeline" style="margin:0;grid-template-columns:1fr"><li><span class="mono">03</span><h3>Cross-reference</h3><p>Every component is correlated against OSV, NVD, GitHub Advisories, CVE.org, CISA KEV, and EPSS.</p></li></ol></div>`,
          "Timeline step",
          "Rule + white dot",
        ),
        tile(
          `<div class="sg-pad"><ol class="timeline" style="margin:0;grid-template-columns:1fr"><li class="is-fix"><span class="mono">04</span><h3>Fix</h3><p>Findings ranked by active exploitation (CISA KEV) and exploitation probability (EPSS).</p></li></ol></div>`,
          "Timeline step · Fix",
          "Red rule + glowing red dot",
        ),
        tile(
          `<div class="sg-pad"><div class="boundary"><div class="boundary__org"><span class="mono">Your organization</span><div class="boundary__box"><span>Your pipeline</span><strong>Trivy · SAST · Sonar · Secret scanning</strong></div></div><span class="boundary__arrow"></span><div class="boundary__box is-out"><span>Leavory receives</span><strong>Results · SBOM · Scan artifacts</strong></div></div></div>`,
          "Boundary diagram",
          "Dashed org frame · red output",
        ),
      ],
      3,
    ) +
    group(
      "Stamp",
      [
        tile(
          `<div class="sg-center sg-pad">${stampEl}</div>`,
          "Stamp",
          "Liquid glass disc · isotype + ring text, Plex Mono Medium 14 · uppercase · 12%",
          "Ring turns with the page scroll",
        ),
        tile(
          `<div class="sg-center sg-pad" style="flex-direction:column;align-items:flex-start;gap:12px"><p class="t-body">Security — seal on the corner of the diagram</p><p class="t-body">Sources — signature beside the integrations</p></div>`,
          "Placement",
          "Two uses per page at most",
        ),
      ],
      2,
    ) +
    group(
      "Product window",
      [
        tile(
          `<div class="sg-pad">${app}</div>`,
          "App window",
          "Glass panel · radius 14 · columns 208 / fill / 340",
          "Sample data",
        ),
      ],
      1,
    ),
);

/* ---------- 08 Icons and illustrations ---------- */
const uiIcons = [
  "i-arrow",
  "i-menu",
  "i-close",
  "i-pause",
  "i-play",
  "i-search",
  "i-mail",
  "i-shield",
  "i-code",
  "i-layers",
  "i-chart",
  "i-branch",
  "i-spark",
  "i-grid",
  "i-pipe",
  "i-box",
  "i-pulse",
];
const brands = [
  ["i-azure", "Azure DevOps", "Official mark · single colour"],
  ["i-github", "GitHub", "Official mark · single colour"],
  ["i-gitlab", "GitLab", "Official mark · single colour"],
  ["i-trivy", "Trivy", "Official mark · single colour"],
  ["i-linkedin", "LinkedIn", "Official mark · single colour"],
];
const icons = section(
  "08",
  "Icons and illustrations",
  "UI icons are 24px line icons at 1.6–1.8 stroke; brand marks are the official ones, in a single colour.",
  `<div class="sg-icons">${uiIcons.map((id) => `<figure>${icon(id, 24)}<figcaption>${id.slice(2)}</figcaption></figure>`).join("")}</div>` +
    group(
      "Brand marks",
      brands.map(([id, name, source]) =>
        tile(
          `<div class="sg-center sg-pad">${icon(id, 40)}</div>`,
          name,
          source,
        ),
      ),
      5,
    ) +
    group(
      "Capability icons (animated)",
      caps.map((svg, i) =>
        tile(
          `<div class="sg-center sg-pad">${svg}</div>`,
          [
            "Dashboard",
            "Projects and DORA",
            "Repository health",
            "Pipelines",
            "Images in production",
          ][i],
          "96×72 · white 50% + one red accent",
        ),
      ),
      5,
    ) +
    group(
      "Isometric figures",
      figs.map((svg, i) =>
        tile(
          `<div class="sg-center sg-pad sg-iso">${svg}</div>`,
          ["Automatic discovery", "AI that explains", "Up-to-date base"][i],
          "Tonal shapes · light from top left",
        ),
      ),
      3,
    ) +
    group(
      "Step figures",
      steps.map((svg, i) =>
        tile(
          `<div class="sg-center sg-pad sg-iso">${svg}</div>`,
          ["01 Connect", "02 Scan", "03 Cross-reference", "04 Fix"][i],
          "Same system, smaller",
        ),
      ),
      4,
    ) +
    group(
      "Hero sphere and wordmark",
      [
        tile(
          `<div class="sg-center sg-pad"><img src="../ds/sphere.svg" alt="" style="width:100%;max-width:560px" /></div>`,
          "Particle sphere",
          "Hero animation · key frame",
        ),
        tile(
          `<div class="sg-pad sg-wordmark">${readFileSync("site/ds/wordmark.svg", "utf8").replace('<rect x="56"', '<rect class="footer__mark-bar" x="56"')}</div>`,
          "Striped wordmark",
          "Footer · stripes every 8px, white 42%",
        ),
      ],
      2,
    ),
);

/* ---------- 09 Motion ---------- */
const motion = section(
  "09",
  "Motion",
  "Prototype notes. Calm and functional; with reduced motion turned on, every loop stops and the hero shows its last frame. Otherwise the pause button in the hero stops every loop on demand.",
  `<table class="sg-table"><thead><tr><th>Pattern</th><th>Timing</th><th>Notes</th></tr></thead><tbody>
    <tr><td>Easing</td><td>cubic-bezier(0.22, 1, 0.36, 1)</td><td>Ease out, for entrances and slides</td></tr>
    <tr><td>Scroll reveal</td><td>0.9s fade · 1s rise 18px</td><td>Once per block</td></tr>
    <tr><td>Hero flow</td><td>3.4s per step, looping</td><td>Connect → Scan → Cross-reference → Fix; sphere turns toward the cursor</td></tr>
    <tr><td>Live status</td><td>In 0.4s · 0.9s apart · check 0.6s before the next step</td><td>Spinner, progress bar, then check</td></tr>
    <tr><td>Line-field bars</td><td>3.2–6.6s, rising</td><td>One red bar per field</td></tr>
    <tr><td>Capability icons</td><td>1.8–4.8s loops</td><td>Bars, pulse draw, travelling package, sweep</td></tr>
    <tr><td>Figures</td><td>3.6–6s float, bob, slide</td><td>Only the highlighted piece moves</td></tr>
    <tr><td>Pause control</td><td>Instant</td><td>Button in the hero corner pauses the flow and every CSS loop; hidden with reduced motion</td></tr>
  </tbody></table>`,
);

/* ---------- Page ---------- */
const cover = `
  <section class="sg-cover">
    <span class="logo sg-cover__logo">${icon("i-mark", 40, ' class="logo__mark" style="width:auto;height:40px"')}<span>Leavory</span></span>
    <h1>Design system</h1>
    <p>UI Kit · v1.0 · October 2026</p>
    <div class="sg-tocs"><div><p class="sg-toc__title">Foundations</p><ol class="sg-toc">${["Logo", "Colour", "Typography", "Grid and layout", "Spacing, radius and lines", "Surfaces and effects"].map((t, i) => `<li><span>0${i + 1}</span>${t}</li>`).join("")}</ol></div><div><p class="sg-toc__title">Components</p><ol class="sg-toc">${["Components", "Icons and illustrations", "Motion"].map((t, i) => `<li><span>0${i + 7}</span>${t}</li>`).join("")}</ol></div></div>
  </section>`;
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1440" />
    <meta name="robots" content="noindex" />
    <title>Leavory — Design system</title>
    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
    <link rel="stylesheet" href="../css/styles.css" />
    <link rel="stylesheet" href="../ds/import.css" />
    <link rel="stylesheet" href="../ds/styleguide.css" />
  </head>
  <body class="sg">
    <main>
      ${cover}
      ${logo}
      ${colour}
      ${type}
      ${grid}
      ${space}
      ${surfaces}
      ${components}
      ${icons}
      ${motion}
    </main>
  </body>
</html>
`;
if (/<use\b|<script|<canvas/.test(html))
  throw new Error("leftover <use>, <script> or <canvas>");
mkdirSync("site/ds", { recursive: true });
writeFileSync("site/ds/index.html", html);
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
    await new Promise((resolve) => setTimeout(resolve, 100));
}
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`${base}/ds/`);
  await outlineStamps(page);
  writeFileSync("site/ds/index.html", await page.content());
} finally {
  await browser.close();
  server?.kill();
}
console.log("wrote site/ds/index.html");
