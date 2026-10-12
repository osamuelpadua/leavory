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

  test("an invalid email is marked on the field and linked to its message", async ({
    page,
  }) => {
    await page.goto(URL);
    const email = page.getByLabel("Work email");
    await expect(email).toHaveAttribute("aria-describedby", "demo-error");
    await page
      .locator(".cta__form")
      .getByRole("button", { name: "Request a demo" })
      .click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    expect(
      await email.evaluate((el) => getComputedStyle(el).boxShadow),
    ).toContain("198, 42, 61");
  });

  test("the pause button stops the hero flow and every looping animation", async ({
    page,
  }) => {
    await page.goto(URL);
    const toggle = page.getByRole("button", { name: "Pause animations" });
    const active = page.locator(".flow__steps .is-on");
    await expect(active).toHaveText("Connect");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      await page
        .locator(".cap-icon .bar")
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe("paused");
    // A step lasts 3.4s; paused, the flow stays on Connect well past it.
    await page.waitForTimeout(4500);
    await expect(active).toHaveText("Connect");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(active).toHaveText("Scan", { timeout: 6000 });
  });

  test("with reduced motion there is nothing to pause", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    await expect(page.locator(".motion-toggle")).toBeHidden();
  });

  for (const width of [320, 375, 768]) {
    test(`a demo button is in the first screen at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(URL);
      await expect(page.locator(".nav__cta")).toBeInViewport({ ratio: 1 });
    });
  }

  test("the demo form keeps touch-sized controls when it stacks", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(URL);
    for (const control of [
      page.getByLabel("Work email"),
      page
        .locator(".cta__form")
        .getByRole("button", { name: "Request a demo" }),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThan(300);
    }
  });

  for (const width of [320, 390]) {
    test(`hero status notes stay on screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(URL);
      // The longest text each slot shows during the cycle.
      const longest = {
        a: ["Step 02 · Scan", "Trivy runs in your pipeline…"],
        b: ["Step 01 · Connect", "Connecting Azure DevOps…"],
        c: ["Step 02 · Scan", "Only results leave…"],
      };
      const overflow = await page.evaluate((longest) => {
        const bad: string[] = [];
        for (const [slot, [step, text]] of Object.entries(longest)) {
          const note = document.querySelector<HTMLElement>(
            `.flow__note[data-slot="${slot}"]`,
          )!;
          note.querySelector(".flow__note-step")!.textContent = step;
          note.querySelector(".flow__note-text")!.textContent = text;
          note.style.transition = "none";
          note.classList.add("is-on"); // full size, not the entry scale
          const r = note.getBoundingClientRect();
          if (r.left < 0 || r.right > innerWidth) bad.push(slot);
        }
        return bad;
      }, longest);
      expect(overflow).toEqual([]);
    });
  }

  test("the stamp rings stay centred on their mark as they turn", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    for (const stamp of [".stamp--seal", ".stamp--sources"]) {
      await page.locator(stamp).scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(300);
      const offset = await page.locator(stamp).evaluate((el) => {
        const box = el.getBoundingClientRect();
        const ring = el.querySelector(".stamp__ring text")!;
        const text = ring.getBoundingClientRect();
        return Math.hypot(
          text.left + text.width / 2 - (box.left + box.width / 2),
          text.top + text.height / 2 - (box.top + box.height / 2),
        );
      });
      expect(offset).toBeLessThan(2);
    }
  });

  for (const width of [1280, 1440]) {
    test(`nothing widens the page while scrolling at ${width}px`, async ({
      page,
    }) => {
      // The stamps turn with the scroll: no angle may push the page wider.
      await page.setViewportSize({ width, height: 900 });
      await page.goto(URL);
      const widest = await page.evaluate(async () => {
        let max = 0;
        for (let y = 0; y < document.documentElement.scrollHeight; y += 150) {
          window.scrollTo({ top: y, behavior: "instant" });
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          max = Math.max(max, document.documentElement.scrollWidth);
        }
        return max;
      });
      expect(widest).toBeLessThanOrEqual(width);
    });
  }

  test("the page carries its canonical URL and sharing metadata", async ({
    page,
  }) => {
    await page.goto(URL);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://leavory.com/",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://leavory.com/",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Leavory/,
    );
  });

  test("the design system, the Figma copy and the rationale load cleanly and stay out of search", async ({
    page,
  }) => {
    for (const path of ["/ds/", "/figma/", "/rationale/"]) {
      const errors: string[] = [];
      const failed: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on(
        "response",
        (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`),
      );
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex",
      );
      expect(errors).toEqual([]);
      expect(failed).toEqual([]);
      if (path !== "/figma/") {
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(audit.violations.map((v) => v.id)).toEqual([]);
      }
      page.removeAllListeners("pageerror");
      page.removeAllListeners("response");
    }
  });

  test("the not-found page leads back home", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found.",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    // Styled, and the way back resolves to the site root.
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgb(30, 28, 27)");
    expect(
      await page
        .getByRole("link", { name: "Back to the home page" })
        .evaluate((a: HTMLAnchorElement) => new URL(a.href).pathname),
    ).toBe("/");
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

  for (const width of [320, 375, 768, 1024, 1440]) {
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
