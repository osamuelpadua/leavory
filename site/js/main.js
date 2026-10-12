// Leavory — interactions. No dependencies.
(() => {
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)");

  /* ---------- Mobile navigation ---------- */
  const toggle = document.querySelector(".nav__toggle");
  const mobileNav = document.getElementById("mobile-navigation");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    toggle
      .querySelector("use")
      .setAttribute("href", open ? "#i-close" : "#i-menu");
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
    .matchMedia("(min-width: 961px)")
    .addEventListener("change", (event) => {
      if (event.matches) setMenu(false);
    });

  /* ---------- Scroll reveal ---------- */
  const revealables = document.querySelectorAll("[data-reveal]");
  if (!motionOK.matches || !("IntersectionObserver" in window)) {
    revealables.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    revealables.forEach((el) => observer.observe(el));
    // A fast scroll can jump past a block between two frames; reveal
    // anything that has already reached the viewport.
    let queued = false;
    const catchUp = () => {
      queued = false;
      for (const el of revealables) {
        if (el.classList.contains("is-visible")) continue;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      }
    };
    window.addEventListener(
      "scroll",
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(catchUp);
      },
      { passive: true },
    );
  }

  /* ---------- Stamps turn with the scroll ---------- */
  const rings = document.querySelectorAll(".stamp__ring");
  if (rings.length && motionOK.matches) {
    let frame = null;
    const turn = () => {
      frame = null;
      const angle = (window.scrollY * 0.12) % 360;
      rings.forEach((ring) => ring.style.setProperty("--turn", `${angle}deg`));
    };
    window.addEventListener(
      "scroll",
      () => {
        if (frame === null) frame = requestAnimationFrame(turn);
      },
      { passive: true },
    );
    turn();
  }

  /* ---------- Demo form: front-end only, nothing is sent ---------- */
  const form = document.querySelector(".cta__form");
  const email = form.querySelector('input[type="email"]');
  const error = form.querySelector(".cta__error");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const valid = email.checkValidity() && email.value.trim() !== "";
    error.hidden = valid;
    email.setAttribute("aria-invalid", String(!valid));
    if (!valid) email.focus();
  });
  email.addEventListener("input", () => {
    if (!error.hidden && email.checkValidity()) {
      error.hidden = true;
      email.removeAttribute("aria-invalid");
    }
  });
})();
