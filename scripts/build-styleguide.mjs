// Builds site/styleguide/index.html: the design system of /linear/, as one
// static page made for importing into Figma with html.to.design. Real
// markup (icons, isotype, figures, product window) is copied from
// site/linear/index.html with every <use> inlined, so the guide always
// shows what the site ships. Usage: node scripts/build-styleguide.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("site/linear/index.html", "utf8");
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
const lockup = (size = 20, color = "") =>
  `<span class="logo" style="font-size:${size}px${color}">${icon("i-mark", Math.round(size * 1.2), ' class="logo__mark"')}<span>Leavory</span></span>`;
const logo = section(
  "01",
  "Logo",
  "A shield cut by three diagonal lines that stop short of a solid right edge, in brand red, next to the wordmark set in the headline type.",
  group(
    "Lockup and isotype",
    [
      tile(
        `<div class="sg-center sg-pad">${lockup(56)}</div>`,
        "Primary lockup",
        "Isotype --red · wordmark --white",
        "Geist 540 · tracking −0.04em",
      ),
      tile(
        `<div class="sg-center sg-pad">${icon("i-mark", 140, ' class="logo__mark" style="width:140px;height:140px"')}</div>`,
        "Isotype",
        "24 × 24 grid · fill --red",
      ),
      tile(
        `<div class="sg-center sg-pad sg-light">${lockup(40, ";color:#1e1c1b").replace('class="logo__mark"', 'class="logo__mark" style="color:#1e1c1b"')}</div>`,
        "On light",
        "Single colour --ink",
      ),
    ],
    3,
  ) +
    group(
      "Sizes and space",
      [
        tile(
          `<div class="sg-row sg-pad">${[16, 20, 24, 32].map((s) => `<div class="sg-stack">${icon("i-mark", s, ' class="logo__mark" style="width:auto;height:auto"')}<span class="sg-cap">${s}px</span></div>`).join("")}</div>`,
          "Minimum size",
          "Isotype 16px · lockup 20px type",
        ),
        tile(
          `<div class="sg-center sg-pad"><div class="sg-clear">${lockup(32)}</div></div>`,
          "Clear space",
          "≥ isotype height on every side",
        ),
        tile(
          `<div class="sg-center sg-pad"><img src="../linear/favicon.svg" width="64" height="64" alt="" /><img src="../linear/favicon.svg" width="32" height="32" alt="" /><img src="../linear/favicon.svg" width="16" height="16" alt="" /></div>`,
          "Favicon",
          "site/linear/favicon.svg · 32px, ink tile r7",
        ),
      ],
      3,
    ) +
    `<p class="sg-note">Don’t stretch, outline, recolour (other than --white or --ink on light) or add effects to the mark.</p>`,
);

/* ---------- 02 Colour ---------- */
const swatch = (bg, name, token, value, dark = true) =>
  `<figure class="sg-swatch"><div class="sg-swatch__chip" style="background:${bg}${dark ? "" : ";box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.14)"}"></div>${spec(name, token, value)}</figure>`;
const alpha = (a, name, token, use) =>
  `<figure class="sg-swatch"><div class="sg-swatch__chip sg-swatch__chip--alpha"><span style="background:rgb(255 255 255 / ${a})"></span></div>${spec(name, token, `#FFFFFF · ${Math.round(a * 1000) / 10}%`, use)}</figure>`;
const colour = section(
  "02",
  "Colour",
  "Four colours and their transparencies, nothing else. A test fails if any other colour is rendered.",
  `<div class="sg-swatches">${[
    swatch("#c62a3d", "Red", "--red", "#C62A3D · buttons, accents, findings"),
    swatch(
      "#d21e38",
      "Red type",
      "--red-type",
      "#D21E38 · large red type only",
    ),
    swatch("#1e1c1b", "Ink", "--ink", "#1E1C1B · background", false),
    swatch("#ffffff", "White", "--white", "#FFFFFF · text, primary button"),
  ].join("")}</div>` +
    group(
      "Transparencies of white, on ink",
      [
        alpha(1, "Text", "--text", "Primary text"),
        alpha(0.68, "Text 2", "--text-2", "Secondary text"),
        alpha(0.54, "Text 3", "--text-3", "Labels, captions"),
        alpha(0.14, "Line 2", "--line-2", "Rules, dividers"),
        alpha(0.08, "Line", "--line", "Hairlines"),
        alpha(0.025, "Surface", "--surface", "Quiet fills"),
      ],
      6,
    ) +
    `<p class="sg-note">Contrast: red type on ink is about 3.2:1, so red is used for large type and shapes only; small text is white or its transparencies.</p>`,
);

/* ---------- 03 Type ---------- */
const typeRow = (sample, name, family, size, weight, lh, track, cls = "") =>
  `<div class="sg-type"><div class="sg-type__sample ${cls}">${sample}</div>${spec(name, `${family} · ${size}`, `Weight ${weight} · line ${lh} · tracking ${track}`)}</div>`;
const type = section(
  "03",
  "Typography",
  "Geist for everything you read, IBM Plex Mono for labels, numbers and data. Headlines can split into two tones: grey, then white.",
  `<div class="sg-fonts">
      <div class="sg-font"><p class="sg-font__big">Aa</p>${spec("Geist", "Variable 100–900 · headlines, UI, body", "site/fonts/geist.woff2")}</div>
      <div class="sg-font sg-font--mono"><p class="sg-font__big">Aa</p>${spec("IBM Plex Mono", "400, 500 · labels, numbers, data", "site/fonts/plex-mono-*.woff2")}</div>
    </div>` +
    `<div class="sg-types">${[
      typeRow(
        '<span style="color:var(--text-3)">Know exactly which vulnerabilities</span> to fix first.',
        "Display / H1",
        "Geist",
        "clamp(36px … 68px)",
        "540",
        "1.02",
        "−0.04em",
        "t-display",
      ),
      typeRow(
        "Your whole estate in one view.",
        "Section display",
        "Geist",
        "clamp(38px … 76px)",
        "540",
        "1.02",
        "−0.04em",
        "t-display",
      ),
      typeRow(
        "From a new CVE to the fix",
        "H2",
        "Geist",
        "clamp(34px … 58px)",
        "540",
        "1.04",
        "−0.04em",
        "t-h2",
      ),
      typeRow(
        'Leavory replaces tracking spreadsheets and scattered alerts. <span style="color:var(--text-3)">A single place where risk, context, and recommendation live together.</span>',
        "Statement",
        "Geist",
        "clamp(28px … 50px)",
        "530",
        "1.1",
        "−0.035em",
        "t-statement",
      ),
      typeRow(
        "Everything your security team needs, without the noise.",
        "H3 / lead heading",
        "Geist",
        "clamp(22px … 28px)",
        "540",
        "1.2",
        "−0.025em",
        "t-h3",
      ),
      typeRow(
        "Projects and DORA metrics",
        "Card title",
        "Geist",
        "20px",
        "540",
        "1.2",
        "−0.025em",
        "t-card",
      ),
      typeRow(
        "Leavory turns the scan results from your Azure DevOps, GitHub, and GitLab pipelines into a short list of what to fix today.",
        "Lede",
        "Geist",
        "clamp(16px … 18px)",
        "400",
        "1.5",
        "0",
        "t-lede",
      ),
      typeRow(
        "Connect once and Leavory maps projects, repositories, and pipelines on its own, in the background.",
        "Body",
        "Geist",
        "15–16px",
        "400",
        "1.5",
        "0",
        "t-body",
      ),
      typeRow(
        "Your pipelines",
        "Label",
        "IBM Plex Mono",
        "11–12px caps",
        "500",
        "1",
        "+0.08em",
        "t-label",
      ),
      typeRow(
        "auth-service",
        "Data",
        "IBM Plex Mono",
        "12px",
        "400",
        "1.4",
        "0",
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
  `<div class="sg-container"><div class="sg-container__inner"><span>Container · --max 1440px</span></div><span class="sg-container__g">Gutter · clamp(20px, 4vw, 64px)</span></div>` +
    `<div class="sg-colsets">${[
      cols(2, "Feature heads, security, header"),
      cols(3, "Capabilities, Azure cells, sources"),
      cols(4, "Roles, timeline"),
      cols(5, "Platform capabilities"),
    ].join("")}</div>` +
    `<table class="sg-table"><thead><tr><th>Breakpoint</th><th>Changes</th></tr></thead><tbody>
      <tr><td>≤ 1100px</td><td>Product window drops its sidebar; Platform, roles and timeline go to 2 columns</td></tr>
      <tr><td>≤ 960px</td><td>Menu becomes a toggle; heads, figures and cells stack to 1 column</td></tr>
      <tr><td>≤ 760px</td><td>Hero flow crops to the sphere; hero line panels and output panel hide</td></tr>
      <tr><td>≤ 560px</td><td>Roles and timeline 1 column; demo form stacks</td></tr>
      <tr><td>≤ 480px</td><td>Product table hides its status column</td></tr>
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
          "--radius · 10px",
          "Buttons, chips, inputs, tiles",
        ),
        tile(
          `<div class="sg-center sg-pad"><div class="sg-radius" style="border-radius:14px;width:180px"></div></div>`,
          "Panel",
          "--radius-lg · 14px",
          "Header bar, cards, product window",
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
          "1px · --line",
        ),
        tile(
          `<div class="sg-center sg-pad"><span class="sg-rule" style="border-top-color:rgb(255 255 255/0.14)"></span></div>`,
          "Rule",
          "1px · --line-2",
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
        "Figma: Background blur 8 · fill white 3–10% gradient",
        "Rim: inner 1px white 14% top, 4% all round",
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
        "--red · blur 36–44px, 30–45%",
        "Active Fix pieces only",
      ),
    ],
    3,
  ) +
    group(
      "Line field",
      [
        tile(
          `<div class="sg-field"><span class="sg-bar" style="left:84px;top:40px;height:90px"></span><span class="sg-bar is-red" style="left:168px;top:120px;height:70px"></span><span class="sg-bar" style="left:288px;top:20px;height:110px"></span><span class="sg-bar" style="left:396px;top:150px;height:60px"></span></div>`,
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
  "Live markup from the site, in their key states.",
  group(
    "Navigation",
    [
      tile(
        `<header class="nav sg-nav"><div class="wrap nav__inner">${`<a class="logo">${icon("i-mark", 24, ' class="logo__mark"')}<span>Leavory</span></a>`}<nav class="nav__links"><a>Product</a><a>Azure DevOps</a><a>Who it’s for</a><a>How it works</a><a>Security</a></nav><a class="pill pill--light nav__cta">Request a demo</a></div></header>`,
        "Header",
        "Full-width bar · 68px · glass on ink · rule --line-2",
        "Links 14px --text-2 → --text on hover",
      ),
    ],
    1,
  ) +
    group(
      "Buttons and links",
      [
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light">Request a demo</a></div>`,
          "Primary",
          "White fill · ink text 14–15px 500",
          "Hover: white 86%",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="pill pill--light" style="height:44px;padding:0 20px;font-size:15px">Request a demo</a></div>`,
          "Primary large",
          "44px · used in the demo form",
        ),
        tile(
          `<div class="sg-center sg-pad"><a class="more">See how it works ${icon("i-arrow", 14)}</a></div>`,
          "Text link",
          "15px --text-2 + arrow",
          "Hover: --text",
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
          `<div class="sg-pad sg-center" style="flex-direction:column;gap:6px"><p class="cta__error">Enter a valid work email.</p><p class="cta__note">A real conversation with an engineer.</p></div>`,
          "Error and note",
          "Red dot + 14px",
          "Note 14px --text-3",
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
          "12.5px --text-2 · ring or red diamond",
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
          "Default · active group · Trivy at Scan (red)",
        ),
        tile(
          `<div class="sg-center sg-pad sg-flow">${note("Step 02 · Scan", "Trivy runs in your pipeline…", false)}</div>`,
          "Live status · running",
          "Glass · spinner · progress bar",
          "Step 10.5px mono · text 13.5px",
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
          "Rows mono 12px · compact severity",
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
          "Glass · 13px 500 caps +0.08em",
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
          "Rule --line-2 · red icon 20px",
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
      "Product window",
      [
        tile(
          `<div class="sg-pad">${app}</div>`,
          "App window",
          "Glass panel · radius 14 · 208 / fluid / 340 columns",
          "Example findings only",
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
  ["i-azure", "Azure DevOps", "Microsoft Azure icons V23"],
  ["i-github", "GitHub", "Simple Icons 16.35"],
  ["i-gitlab", "GitLab", "Simple Icons 16.35"],
  ["i-trivy", "Trivy", "Simple Icons 16.35"],
  ["i-linkedin", "LinkedIn", "Simple Icons 9.21"],
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
      "Capability icons (animated on the site)",
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
          `<div class="sg-center sg-pad"><img src="../figma/sphere.png" alt="" style="width:100%;max-width:560px" /></div>`,
          "Particle sphere",
          "WebGL on the site · still frame here",
        ),
        tile(
          `<div class="sg-pad"><img src="../figma/wordmark.png" alt="" style="width:100%" /></div>`,
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
  "Calm and functional. Everything stops with prefers-reduced-motion.",
  `<table class="sg-table"><thead><tr><th>Pattern</th><th>Timing</th><th>Notes</th></tr></thead><tbody>
    <tr><td>Easing</td><td>cubic-bezier(0.22, 1, 0.36, 1)</td><td>--ease, for entrances and slides</td></tr>
    <tr><td>Scroll reveal</td><td>0.9s fade · 1s rise 18px</td><td>Once per block</td></tr>
    <tr><td>Hero flow</td><td>3.4s per step, looping</td><td>Connect → Scan → Cross-reference → Fix; sphere turns toward the cursor</td></tr>
    <tr><td>Live status</td><td>In 0.4s · 0.9s apart · check 0.6s before the next step</td><td>Spinner, progress bar, then check</td></tr>
    <tr><td>Line-field bars</td><td>3.2–6.6s, rising</td><td>Paused offscreen; one red per field</td></tr>
    <tr><td>Capability icons</td><td>1.8–4.8s loops</td><td>Bars, pulse draw, travelling package, sweep</td></tr>
    <tr><td>Figures</td><td>3.6–6s float, bob, slide</td><td>Only the highlighted piece moves</td></tr>
    <tr><td>Hover</td><td>0.2s colour</td><td>Links and buttons</td></tr>
  </tbody></table>`,
);

/* ---------- Page ---------- */
const cover = `
  <section class="sg-cover">
    <span class="logo sg-cover__logo">${icon("i-mark", 40, ' class="logo__mark" style="width:40px;height:40px"')}<span>Leavory</span></span>
    <h1>Design system</h1>
    <p>UI kit for leavory.com · Linear-inspired version · 2026</p>
    <ol class="sg-toc">${["Logo", "Colour", "Typography", "Grid and layout", "Spacing, radius and lines", "Surfaces and effects", "Components", "Icons and illustrations", "Motion"].map((t, i) => `<li><span>0${i + 1}</span>${t}</li>`).join("")}</ol>
  </section>`;
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1440" />
    <title>Leavory — Design system</title>
    <link rel="icon" type="image/svg+xml" href="../linear/favicon.svg" />
    <link rel="stylesheet" href="../linear/linear.css" />
    <link rel="stylesheet" href="../figma/figma.css" />
    <link rel="stylesheet" href="styleguide.css" />
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
mkdirSync("site/styleguide", { recursive: true });
writeFileSync("site/styleguide/index.html", html);
console.log("wrote site/styleguide/index.html");
