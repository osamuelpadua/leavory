// Leavory — line fields. Each `.lines` element is a field of vertical
// hairlines (drawn in CSS); this script adds a few short bars that drift
// down along them, one of them red. Bars sit only inside the zones given in
// `data-zones` (fractions of the width, e.g. "0-0.26,0.74-1"), so they never
// cross the copy. Seeded, so the field looks the same on every visit.
(() => {
  const motionOK = window.matchMedia(
    "(prefers-reduced-motion: no-preference)",
  ).matches;
  const STEP = 12; // must match the hairline spacing in css/styles.css

  document.querySelectorAll(".lines[data-bars]").forEach((field, n) => {
    let seed = 41 + n * 17;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const zones = (field.dataset.zones || "0-1")
      .split(",")
      .map((z) => z.split("-").map(Number));
    const count = Number(field.dataset.bars);
    const bars = Array.from({ length: count }, (_, i) => {
      const bar = document.createElement("span");
      bar.className = "lines__bar" + (i === 1 ? " is-red" : "");
      const [a, b] = zones[i % zones.length];
      bar.dataset.at = String(a + (b - a) * rand());
      bar.style.setProperty("--h", `${Math.round(48 + rand() * 72)}px`);
      bar.style.setProperty("--dur", `${(3.2 + rand() * 3.4).toFixed(2)}s`);
      bar.style.setProperty("--delay", `${(-rand() * 7).toFixed(2)}s`);
      bar.style.setProperty("--rest", `${Math.round(rand() * 70)}%`);
      field.append(bar);
      return bar;
    });

    // Snap each bar onto a hairline, and let it travel the field's height.
    const place = () => {
      const width = field.clientWidth;
      field.style.setProperty("--travel", `${field.clientHeight}px`);
      for (const bar of bars) {
        const x = Math.round((Number(bar.dataset.at) * width) / STEP) * STEP;
        bar.style.left = `${Math.min(x, width - STEP)}px`;
      }
    };
    place();
    new ResizeObserver(place).observe(field);

    if (!motionOK) {
      field.classList.add("is-still");
      return;
    }
    new IntersectionObserver(([entry]) => {
      field.classList.toggle("is-paused", !entry.isIntersecting);
    }).observe(field);
  });
})();
