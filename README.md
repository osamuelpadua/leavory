# Leavory

Static landing page in plain HTML, CSS, and JavaScript, with no framework and no build step. Product content comes exclusively from the supplied `Leavory-home.pdf` (see [the content inventory](docs/content-inventory.md)).

Visual direction: editorial, bee-engineering-style layout (light/dark rhythm with 45° chamfered section edges, wide display type, sculptural 3D objects) in a strict red, black and white palette, with the product interface as the protagonist of the hero. The hero is dark, on a faint scan-grid texture, and the product window inside it is dark too (`.app` swaps the ink and white tokens).

## Local development

Requires Node.js 22+.

```sh
npm install        # only needed for tests and formatting
npm run dev        # serves site/ on http://localhost:5173
```

`scripts/serve.mjs` is a dependency-free static server. Any static server pointed at `site/` works the same way.

## Checks

```sh
npm run format:check
npm run test:e2e
```

Browser tests use the locally installed Google Chrome and start the server when needed. They cover:

- navigation and anchors
- personas (mouse, keyboard, and the mobile selector)
- form validation without submission
- reduced motion
- palette compliance
- axe WCAG 2.1 AA at 375, 768, 1024, and 1440px
- horizontal overflow

Screenshots are written to `test-results/screenshots/`.

## Deploy

Upload the contents of `site/` to any static host. No server, environment variables, database, or credentials are required.

## Structure

- `site/index.html`: the opening and all sections, semantic markup, and an inline SVG icon sprite.
- `site/css/styles.css`: design tokens, then base, components, and sections in page order, then motion and breakpoints (1100 / 900 / 760 / 480px).
- `site/js/main.js`: the opening, mobile menu, persona tabs and select, scroll reveal, and the front-end-only form.
- `site/js/hero-scan.js`: the live hero scene, written in plain WebGL2 with no dependencies. A smoked-glass cube holds dark glass blocks, rods and small decoy cells (the code and infrastructure). Vulnerable cells look like any decoy, some hidden inside blocks, until the red laser sweeping through the cube crosses them: then they light up red and get a reticle. When the sweep ends, the most critical finding stays in focus. The cube turns toward the cursor, and with the cursor over the cube the laser follows it. The scene pauses offscreen and in background tabs. With reduced motion, or without WebGL2, the still `obj-scan` image stays in place.
- `scripts/capture-hero.mjs`: exports `site/img/obj-scan-1000.webp` and `obj-scan-640.webp` from the live scene (`/?capture` freezes one frame). Run `node scripts/capture-hero.mjs` after changing the scene so the still image matches.
- `site/fonts/`: Archivo (variable width, used expanded for display), Geist, and IBM Plex Mono (product UI only), all local.
- `site/img/`: the hero still (`obj-scan`, captured from the scene) and four 3D objects generated with Magnific (orbit, sealed capsule, red cell, and the former hero cluster, now unused), background-removed, served locally as WebP with alpha.

## Linear-inspired version

A second version of the page lives in `site/linear/` (served at `/linear/`), with the same content and palette in a design inspired by linear.app: tight display type, quiet dark surfaces, hairline structure, isometric line figures, and the product window as a large screen.

- `site/linear/index.html`: the page. It reuses the classic page's icon sprite and product window markup, and the shared fonts.
- `site/linear/linear.css`: tokens, components, sections and breakpoints for this version.
- `site/linear/linear.js`: mobile menu, scroll reveal, and the front-end-only demo form (it validates the email and never sends anything).
- `site/linear/hero-flow.js`: the hero flow in plain WebGL2. Two bundles of wires feed a sphere of particles (Leavory): the customer's pipelines (Azure DevOps, GitHub, GitLab, Trivy, grouped as “Your pipelines”) and the public sources (OSV, NVD, KEV, EPSS), each entering the steps panel through its own port. Connect and Scan light up the pipeline side, since Trivy runs there and only results and the SBOM travel; Cross-reference feeds the public sources in and sweeps the sphere, revealing the few findings that matter; Fix sends them, red, to “Fix first”. The sphere turns toward the cursor and its particles move out of the cursor's way. It pauses offscreen; with reduced motion it renders a still frame of the Fix step, and without WebGL2 a dotted CSS sphere stands in. The stage spans the grid: its height fits what is left of the first screen, pieces are placed in design units from the left edge, the centre or the right edge, and the script routes the wires and the dotted exit to whatever width results. On the right, a ranked “Fix first” panel lights up at the Fix step.
- `site/linear/linear-lines.js`: Serro-inspired line fields. Hairlines every 12px (CSS) with a few solid bars rising along them, one red, seeded and paused offscreen; static with reduced motion. Used in hard-edged panels beside the hero and across the final call to action.
- Footer: brand, big numbered links and small mono links, over the Leavory wordmark drawn in stripes with one red bar running through the L.
- `tests/linear.spec.ts`: errors and external assets, the step cycle, reduced motion, mobile menu, form, palette, overflow and axe at four widths.

## Opening

The client-required opening plays before the page: “Vulnerability” and “Quality of Service” appear, their brand letters light up in red and fly into “Leavory”, then two chamfered panels part to reveal the hero (~4 s). It plays once per browser session, never when the URL has a section hash, can be skipped with the button, a click or Escape, and shrinks to a short name-only version for reduced motion.

## Palette

| Token        | Value     | Use                                              |
| ------------ | --------- | ------------------------------------------------ |
| `--red`      | `#C62A3D` | Buttons, hero laser, Critical, Fix step, accents |
| `--red-type` | `#D21E38` | Headline emphasis and red labels on white        |
| `--ink`      | `#1E1C1B` | Dark backgrounds and text on light surfaces      |
| `--white`    | `#FFFFFF` | Light backgrounds and text on dark surfaces      |

Every other tone is one of these four with transparency. A test fails if any other color is rendered.

Contrast rules:

- `#D21E38` on `#1E1C1B` is about 3.2:1, so red type on dark is used only at large sizes.
- Small red labels appear only on white.

## Form and links

The demo form is intentionally front-end only. It never sends or stores data and never shows a false success message. Connect a real submission handler before collecting leads.

The footer links to the LinkedIn company page used on the current Leavory site (https://www.linkedin.com/company/leavory-security/).
