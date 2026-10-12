// Leavory — interactions. No dependencies.
(() => {
  const root = document.documentElement;
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)");

  /* ---------- Page entrance (runs after the opening, or right away) ---------- */
  let started = false;
  const startPage = () => {
    if (started) return;
    started = true;
    document
      .querySelectorAll("[data-enter]")
      .forEach((el) => el.classList.add("is-in"));

    const revealables = document.querySelectorAll("[data-reveal]");
    if (!motionOK.matches || !("IntersectionObserver" in window)) {
      revealables.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    // Stagger siblings that enter together.
    document.querySelectorAll(".cards, .modules, .steps").forEach((group) => {
      [...group.children].forEach((child, i) =>
        child.style.setProperty("--delay", `${i * 0.08}s`),
      );
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    revealables.forEach((el) => observer.observe(el));
  };

  /* ---------- Opening: Vulnerability meets Quality of Service ---------- */
  // The brand letters live inside the two words: l·e·a in "Vulnerability"
  // and v·o·r·y in "Quality of Service".
  const intro = document.getElementById("intro");
  const playIntro = () => {
    const stage = intro.querySelector(".intro__stage");
    const wordV = intro.querySelector(".intro__word--v");
    const wordQ = intro.querySelector(".intro__word--q");
    const brand = intro.querySelector(".intro__brand");
    const caption = intro.querySelector(".intro__caption");
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let done = false;

    const split = (el, keys = []) => {
      el.textContent = "";
      return [...el.dataset.word].map((char, i) => {
        const span = document.createElement("span");
        span.textContent = char === " " ? " " : char;
        if (keys.includes(i)) span.className = "is-key";
        el.append(span);
        return span;
      });
    };
    const v = split(wordV, [2, 4, 6]);
    const q = split(wordQ, [6, 8, 13, 14]);
    const targets = split(brand);
    // Source letter for each brand letter, in order: L e a v o r y.
    const sources = [v[2], v[4], v[6], q[14], q[8], q[13], q[6]];

    try {
      sessionStorage.setItem("leavory-intro", "1");
    } catch {
      /* private mode: the opening simply plays again next time */
    }

    const finish = (fast = false) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      intro.classList.add("is-leaving");
      window.removeEventListener("keydown", onKey);
      // The hero starts entering while the panels part.
      startPage();
      setTimeout(
        () => {
          intro.remove();
          root.classList.remove("has-intro");
        },
        fast ? 450 : 800,
      );
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish(true);
    };
    window.addEventListener("keydown", onKey);
    intro.addEventListener("click", () => finish(true));

    if (!motionOK.matches) {
      stage.classList.add("is-static");
      at(1200, () => finish(true));
      return;
    }

    at(150, () => wordV.classList.add("is-in"));
    at(650, () => wordQ.classList.add("is-in"));
    at(1350, () => stage.classList.add("is-lit"));
    at(1950, () => {
      // Fly each lit letter from its word into the brand name.
      const layer = document.createElement("div");
      layer.className = "intro__fly";
      intro.append(layer);
      const fly = targets.map((target, i) => {
        const from = sources[i].getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const span = document.createElement("span");
        span.textContent = target.textContent;
        span.style.left = `${to.left}px`;
        span.style.top = `${to.top}px`;
        span.style.fontSize = getComputedStyle(brand).fontSize;
        const scale = from.height / to.height;
        span.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
        layer.append(span);
        return span;
      });
      wordV.classList.add("is-out");
      wordQ.classList.add("is-out");
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          fly.forEach((span) => (span.style.transform = "none")),
        ),
      );
    });
    at(2750, () => caption.classList.add("is-in"));
    at(3500, () => finish());
  };

  if (intro && root.classList.contains("has-intro")) {
    if (document.fonts && document.fonts.ready) {
      // Measure letters only once the display font is in place.
      Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 600)),
      ]).then(playIntro);
    } else {
      playIntro();
    }
  } else {
    intro?.remove();
    startPage();
  }

  /* ---------- Mobile navigation ---------- */
  const toggle = document.querySelector(".header__toggle");
  const mobileNav = document.getElementById("mobile-navigation");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    mobileNav.hidden = !open;
  };
  toggle.addEventListener("click", () =>
    setMenu(toggle.getAttribute("aria-expanded") !== "true"),
  );
  mobileNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobileNav.hidden) {
      setMenu(false);
      toggle.focus();
    }
  });
  window
    .matchMedia("(min-width: 1101px)")
    .addEventListener("change", (event) => {
      if (event.matches) setMenu(false);
    });

  /* ---------- Roles: tabs + mobile select ---------- */
  const tabs = [...document.querySelectorAll('.roles__tabs [role="tab"]')];
  const select = document.getElementById("role-select");
  const activate = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden =
        !selected;
    });
    select.value = String(index);
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activate(i));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const next = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowDown: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        ArrowUp: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      activate(next, true);
    });
  });
  select.addEventListener("change", () => activate(Number(select.value)));

  /* ---------- Demo form: front-end only, nothing is sent ---------- */
  document.querySelector(".demo__form").addEventListener("submit", (event) => {
    event.preventDefault();
  });
})();
