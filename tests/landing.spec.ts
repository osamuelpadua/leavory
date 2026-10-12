import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const INTRO_KEY = "leavory-intro";

// Scroll the whole page so every scroll-revealed block (and lazy image) loads.
async function revealAll(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 50));
    }
    // Let the observer see the last screen before jumping back up.
    await new Promise((r) => setTimeout(r, 300));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await expect(page.locator("[data-reveal]:not(.is-visible)")).toHaveCount(0);
  await page.waitForTimeout(1100);
}

test.describe("page", () => {
  // The opening has its own tests below; here it is treated as already seen.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (key) => sessionStorage.setItem(key, "1"),
      INTRO_KEY,
    );
  });

  test("renders without runtime errors, broken anchors, or external assets", async ({
    page,
  }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (
        /^https?:/.test(request.url()) &&
        new URL(request.url()).hostname !== "127.0.0.1"
      )
        external.push(request.url());
    });
    await page.goto("/");
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

  test("LinkedIn points to the company page and opens safely", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Follow us on LinkedIn" });
    await expect(link).toHaveAttribute(
      "href",
      "https://www.linkedin.com/company/leavory-security/",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("all four personas are usable by mouse and keyboard", async ({
    page,
  }) => {
    await page.goto("/#roles");
    const tabs = page.getByRole("tab");
    const panel = page.getByRole("tabpanel");
    const features = [
      "Image monitoring",
      "AI remediation",
      "Projects and DORA metrics",
      "Dashboard",
    ];
    await expect(tabs).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
      await expect(panel).toContainText(features[i]);
    }
    await tabs.nth(3).press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(0).press("ArrowDown");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(panel).toContainText("AI remediation");
    await tabs.nth(1).press("ArrowUp");
    await expect(tabs.nth(0)).toBeFocused();
    await tabs.nth(0).press("End");
    await expect(tabs.nth(3)).toBeFocused();
    await tabs.nth(3).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
  });

  test("mobile navigation closes with Escape and selection, and role selector changes content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open navigation" });
    await toggle.click();
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(nav).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(nav).toBeHidden();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await nav.getByRole("link", { name: "Product", exact: true }).click();
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/#product$/);
    const select = page.getByRole("combobox", { name: "Choose your role" });
    for (let i = 0; i < 4; i++) {
      await select.selectOption(String(i));
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
    await expect(page.getByRole("tabpanel")).toContainText(
      "evidence ready for the next audit",
    );
  });

  test("demo validates email and platform without sending or claiming success", async ({
    page,
  }) => {
    await page.goto("/#demo");
    const submit = page.getByRole("button", { name: "Request a demo" });
    const email = page.getByRole("textbox", { name: "Work email" });
    await submit.click();
    expect(
      await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing),
    ).toBe(true);
    await email.fill("invalid-email");
    await submit.click();
    expect(
      await email.evaluate((el: HTMLInputElement) => el.validity.typeMismatch),
    ).toBe(true);
    await page.getByRole("radio", { name: "GitLab", exact: true }).check();
    await expect(
      page.getByRole("radio", { name: "GitLab", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Azure DevOps", exact: true }),
    ).not.toBeChecked();
    const submittedRequests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr", "document"].includes(request.resourceType()))
        submittedRequests.push(request.url());
    });
    await email.fill("engineer@example.com");
    await submit.click();
    await expect(email).toHaveValue("engineer@example.com");
    expect(submittedRequests).toEqual([]);
    // Only the opening flag is stored; nothing from the form.
    expect(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: Object.keys(sessionStorage),
      })),
    ).toEqual({ local: 0, session: [INTRO_KEY] });
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("with reduced motion every section is visible without scrolling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const hidden = await page
      .locator("[data-reveal], [data-enter]")
      .evaluateAll(
        (els) =>
          els.filter((el) => getComputedStyle(el).opacity !== "1").length,
      );
    expect(hidden).toBe(0);
  });

  test("the hero scan runs live, and stays a still image with reduced motion", async ({
    page,
  }) => {
    await page.goto("/");
    const object = page.locator(".hero__object");
    await expect(object).toHaveClass(/is-live/);
    await expect(object.locator("canvas.hero__scene")).toHaveCount(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(object.locator("canvas")).toHaveCount(0);
    await expect(object.locator("img")).toBeVisible();
  });

  test("only the four brand colors (and their transparencies) are rendered", async ({
    page,
  }) => {
    await page.goto("/");
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
    test(`no text sits on the 3D objects or the hero ribbon at ${width}px`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const hits = await page.evaluate(() => {
        // The inner 70% of each object box approximates its opaque area.
        const decor = [...document.querySelectorAll(".obj img")].map((img) => {
          const r = img.getBoundingClientRect();
          const k = 0.15;
          return {
            l: r.left + r.width * k,
            r: r.right - r.width * k,
            t: r.top + r.height * k,
            b: r.bottom - r.height * k,
          };
        });
        const out: string[] = [];
        for (const el of document.querySelectorAll("main *, footer *")) {
          if (el.closest(".app, .outline-type")) continue;
          const own = [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent!.trim(),
          );
          if (!own) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) {
            if (
              decor.some(
                (d) =>
                  r.left < d.r &&
                  r.right > d.l &&
                  r.top < d.b &&
                  r.bottom > d.t,
              )
            )
              out.push(el.textContent!.trim().slice(0, 40));
            for (let x = r.left + 2; x < r.right; x += 12) {
              const y = r.top + r.height / 2;
              if (
                document
                  .elementsFromPoint(x, y)
                  .some((s) => s.closest(".hero__ribbon"))
              ) {
                out.push(`ribbon: ${el.textContent!.trim().slice(0, 40)}`);
                break;
              }
            }
          }
        }
        return [...new Set(out)];
      });
      expect(hits).toEqual([]);
    });

    test(`responsive layout and accessibility at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
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

test.describe("opening", () => {
  const intro = (page: Page) => page.locator("#intro");

  test("plays on the first visit, then removes itself and unlocks scrolling", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/has-intro/);
    await expect(
      page.getByRole("button", { name: "Skip intro" }),
    ).toBeVisible();
    await expect(page.locator(".intro__word--v")).toHaveText("Vulnerability");
    await expect(page.locator(".intro__word--q")).toHaveText(
      "Quality of Service",
    );
    await expect(intro(page)).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator("html")).not.toHaveClass(/has-intro/);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).not.toBe("hidden");
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), INTRO_KEY),
    ).toBe("1");
  });

  test("Skip intro ends it right away", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0, { timeout: 1500 });
  });

  test("Escape ends it right away", async ({ page }) => {
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(intro(page)).toHaveCount(0, { timeout: 1500 });
  });

  test("does not play again in the same session", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(intro(page)).toHaveCount(0, { timeout: 1500 });
    await page.reload();
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/has-intro/);
  });

  test("does not play when the link points to a section", async ({ page }) => {
    await page.goto("/#demo");
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator("#demo")).toBeInViewport();
  });

  test("with reduced motion shows only the name, briefly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".intro__stage")).toHaveClass(/is-static/);
    await expect(intro(page)).toHaveCount(0, { timeout: 2500 });
  });

  test("keeps focusable controls outside aria-hidden content", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include("#intro")
      .withRules(["aria-hidden-focus", "button-name"])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
});
