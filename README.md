# Leavory

Static landing page in plain HTML, CSS, and JavaScript, with no framework and no build step. Product content comes exclusively from the supplied `Leavory-home.pdf` (see [the content inventory](docs/content-inventory.md)).

Visual direction: dark, quiet surfaces, tight display type and hairline structure, in a strict red, black and white palette. The hero is a live flow that turns pipeline results into a short list of what to fix first.

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

Browser tests (`tests/landing.spec.ts`) use the locally installed Google Chrome and start the server when needed. They cover runtime errors and external assets, anchors, the hero step cycle, reduced motion, the pause button, the mobile menu and the header demo button on small screens, the front-end-only form (validation, invalid state, touch-sized controls when stacked), hero notes staying on screen, canonical and sharing metadata, the design system and Figma pages (clean load, axe, `noindex`), the 404 page, palette compliance, horizontal overflow, and axe WCAG 2.1 AA at 320, 375, 768, 1024 and 1440px. Screenshots are written to `test-results/screenshots/`.

## Deploy

Upload the contents of `site/` to any static host. No server, environment variables, database, or credentials are required. Pushing to `main` publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`).

## Structure

- `site/index.html`: all sections, semantic markup, and an inline SVG icon sprite (UI icons, the official brand marks, the isotype).
- `site/css/styles.css`: tokens, components, sections in page order, motion, and breakpoints (1100 / 960 / 760 / 560 / 480px).
- `site/js/main.js`: mobile menu, the pause button (it sets `html.motion-paused`, which pauses every CSS loop, and tells the hero flow), scroll reveal, the rotating stamps, and the front-end-only demo form.
- `site/js/hero-flow.js`: the hero flow in plain WebGL2. Two bundles of wires feed a sphere of particles (Leavory): the customer's pipelines (Azure DevOps, GitHub, GitLab, Trivy) and the public sources (OSV, NVD, KEV, EPSS), each entering the steps panel through its own port. Connect and Scan light up the pipeline side; Cross-reference feeds the public sources in and sweeps the sphere: each finding it reaches flashes and a target locks onto it. The findings mirror the “Fix first” card (two Critical, one Secret, two High, plus minor ones that only blink); at Fix the five light up with their rows, Critical the largest, and leave, red, for the panel. A sparse network of hairline links, with packets of data running along them, connects points across the sphere. A drifting dot texture sits behind it and a shade hides the left edge. The sphere turns toward the cursor. The stage spans the grid and its height fits what is left of the first screen. It pauses offscreen and with the page's pause button (the button in the stage's corner, required by WCAG 2.2.2); with reduced motion it renders a still frame of the Fix step, and without WebGL2 a dotted CSS sphere stands in.
- `site/js/lines.js`: line fields. Hairlines every 12px (CSS) with a few solid bars rising along them, one red, seeded and paused offscreen; static with reduced motion. Used beside the hero and across the final call to action.
- `site/fonts/`: Geist and IBM Plex Mono, both local.
- `site/404.html`: the not-found page GitHub Pages serves for any missing path (`noindex`); it sets its base to `/leavory/` or `/`, so it works on the GitHub Pages project URL and at a domain root; `scripts/serve.mjs` serves it the same way.

Below 961px the header keeps a compact “Request a demo” button beside the menu toggle. The page declares `https://leavory.com/` as its canonical URL, with Open Graph and Twitter metadata (no share image yet).

## Figma import copy

`site/figma/` (served at `/figma/`) is a frozen, script-free copy of the page at 1440px, for importing into Figma with the html.to.design plugin. The WebGL sphere and the striped wordmark are images, icons are inlined, the flow is pinned at the Fix step, and `figma.css` removes motion, backdrop blur and non-standard font weights. It carries `noindex`, since it duplicates the home page. Regenerate it after changing the page: `node scripts/build-figma.mjs` (then `npm run format`).

## Design system page

`site/styleguide/` (served at `/styleguide/`) documents the design system on one static 1440px page for importing into Figma: logo, colour, typography, grid and breakpoints, spacing, radius and lines, surfaces and effects, components in their states, icons and illustrations, and motion. It carries `noindex`. It is generated from the page markup, so regenerate it after changing the page: `node scripts/build-styleguide.mjs` (then `npm run format`).

## Creative rationale

`site/rationale/` (served at `/rationale/`) presents the work to the client: the problem with the current site, the goal, the decisions (colour, type, lines, motion), the references (torq.io for the hero component, serro.ai for the lines and motion), the hero explained, the concept of the mark, the home page, and the next steps. It is a static page on the same stylesheet, with `noindex`. The screenshots in `site/rationale/img/` are the current leavory.com (from the local mirror in `leavory-old`) and the new hero at the Fix step; retake them if the hero changes.

## Palette

| Token        | Value     | Use                                            |
| ------------ | --------- | ---------------------------------------------- |
| `--red`      | `#C62A3D` | Isotype, buttons accents, Critical, Fix, glows |
| `--red-type` | `#D21E38` | Large red type only                            |
| `--ink`      | `#1E1C1B` | Background                                     |
| `--white`    | `#FFFFFF` | Text and the primary button                    |

Every other tone is one of these four with transparency. A test fails if any other color is rendered. `#D21E38` on `#1E1C1B` is about 3.2:1, so red is used for large type and shapes only.

## Form and links

The demo form is intentionally front-end only. It never sends or stores data and never shows a false success message. Connect a real submission handler before collecting leads.

The footer links to the LinkedIn company page used on the current Leavory site (https://www.linkedin.com/company/leavory-security/).

## Not carried over

The earlier version opened with an intro animation (“Vulnerability” and “Quality of Service” resolving into “Leavory”), noted as a client requirement. This version has no opening yet; it is in the git history if it needs to come back.
