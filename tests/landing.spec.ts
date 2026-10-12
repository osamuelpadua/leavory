import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The landing page.
const URL = "/";

async function revealAll(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 300));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await expect(page.locator("[data-reveal]:not(.is-visible)")).toHaveCount(0);
  await page.waitForTimeout(1100);
}

test.describe("landing page", () => {
  test("renders without runtime errors, broken anchors, or external assets", async ({
    page,
  }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (
        /^https?:/.test(request.url()) &&
        new globalThis.URL(request.url()).hostname !== "127.0.0.1"
      )
        external.push(request.url());
    });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Know exactly which vulnerabilities to fix first.",
    );
    const missingAnchors = await page
      .locator('a[href^="#"]')
      .evaluateAll((anchors) =>
        anchors
          .map((a) => a.getAttribute("href")!)
          .filter(
            (href) =>
              href.length > 1 && !document.getElementById(href.slice(1)),
          ),
      );
    expect(missingAnchors).toEqual([]);
    await revealAll(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test("the hero flow runs live and cycles through the four steps", async ({
    page,
  }) => {
    await page.goto(URL);
    const flow = page.locator(".flow");
    await expect(flow).toHaveClass(/is-live/);
    const active = flow.locator(".flow__steps .is-on");
    await expect(active).toHaveText("Connect");
    await expect(active).toHaveText("Scan", { timeout: 6000 });
  });

  test("with reduced motion the flow is a still frame of the Fix step", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    await expect(page.locator(".flow__steps .is-on")).toHaveText("Fix");
    await expect(page.locator(".flow__out")).toHaveClass(/is-hot/);
    const hidden = await page
      .locator("[data-reveal]")
      .evaluateAll(
        (els) =>
          els.filter((el) => getComputedStyle(el).opacity !== "1").length,
      );
    expect(hidden).toBe(0);
  });

  test("mobile navigation opens, closes with Escape, and closes on selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(URL);
    const toggle = page.getByRole("button", { name: "Open navigation" });
    const menu = page.locator("#mobile-navigation");
    await toggle.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await toggle.click();
    await menu.getByRole("link", { name: "How it works" }).click();
    await expect(menu).toBeHidden();
  });

  test("demo form validates the email and never claims success", async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await page.goto(URL);
    const form = page.locator(".cta__form");
    await form.getByRole("button", { name: "Request a demo" }).click();
    await expect(form.locator(".cta__error")).toBeVisible();
    await form.getByLabel("Work email").fill("dev@example.com");
    await expect(form.locator(".cta__error")).toBeHidden();
    await form.getByRole("button", { name: "Request a demo" }).click();
    await expect(form.locator(".cta__error")).toBeHidden();
    expect(posts).toEqual([]);
  });

  test("only the four brand colors (and their transparencies) are rendered", async ({
    page,
  }) => {
    await page.goto(URL);
    await revealAll(page);
    const offenders = await page.evaluate(() => {
      const allowed = ["30,28,27", "255,255,255", "198,42,61", "210,30,56"];
      const bad = new Set<string>();
      const check = (el: Element, prop: string, value: string) => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return;
        const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
        if (Number(a) === 0) return;
        if (!allowed.includes(`${r},${g},${b}`))
          bad.add(
            `${el.tagName.toLowerCase()}.${el.className} ${prop}: ${value}`,
          );
      };
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("symbol, .sprite")) continue;
        const cs = getComputedStyle(el);
        check(el, "color", cs.color);
        check(el, "background-color", cs.backgroundColor);
        for (const side of ["Top", "Right", "Bottom", "Left"] as const)
          if (parseFloat(cs[`border${side}Width`]) > 0)
            check(el, `border-${side}`, cs[`border${side}Color`]);
        if (el instanceof SVGGeometryElement) {
          if (cs.fill !== "none") check(el, "fill", cs.fill);
          if (cs.stroke !== "none") check(el, "stroke", cs.stroke);
        }
      }
      return [...bad];
    });
    expect(offenders).toEqual([]);
  });

  for (const width of [375, 768, 1024, 1440]) {
    test(`responsive layout and accessibility at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(URL);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `test-results/screenshots/hero-${width}.png`,
      });
      await revealAll(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      await testInfo.attach("accessibility", {
        body: JSON.stringify(audit.violations, null, 2),
        contentType: "application/json",
      });
      await page.screenshot({
        path: `test-results/screenshots/landing-${width}.png`,
        fullPage: true,
      });
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          elements: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      ).toEqual([]);
    });
  }
});
