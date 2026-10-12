// Leavory — the hero flow. Connect and Scan happen in the customer's pipeline
// (Trivy runs there; only results and the SBOM travel); Cross-reference
// happens in Leavory, against the public advisories; the few findings that
// matter light up red and leave for "Fix first". The sphere turns toward the
// cursor. Plain WebGL2, no dependencies.
// With reduced motion it renders one still frame of the Fix step.
(() => {
  const flow = document.querySelector(".flow");
  if (!flow) return;
  const stage = flow.querySelector(".flow__stage");
  const canvas = flow.querySelector(".flow__canvas");
  const steps = [...flow.querySelectorAll(".flow__steps span")];
  const out = flow.querySelector(".flow__out");
  const notes = {};
  const leads = {};
  flow
    .querySelectorAll(".flow__note")
    .forEach((el) => (notes[el.dataset.slot] = el));
  flow
    .querySelectorAll(".flow__lead")
    .forEach((el) => (leads[el.dataset.slot] = el));
  const motionOK = window.matchMedia(
    "(prefers-reduced-motion: no-preference)",
  ).matches;

  /* ---------- Steps and their notes ---------- */
  const STAGES = [
    { a: "Mapping your pipelines…", b: "Connecting Azure DevOps…" },
    { a: "Trivy runs in your pipeline…", c: "Only results leave…" },
    { b: "Checking OSV and NVD…", a: "Flagging CISA KEV…" },
    { c: "Ranking by EPSS…", a: "Drafting the fix…" },
  ];
  const STAGE_TIME = 3.4;
  const STEP_NAMES = ["Connect", "Scan", "Cross-reference", "Fix"];
  // Each step shows its tasks as live status: they come in one after the
  // other with a spinner and a progress bar, and turn into a check just
  // before the next step starts.
  const timers = [];
  const at = (ms, fn) => {
    if (ms > 0) timers.push(setTimeout(fn, ms));
    else fn();
  };
  const setStage = (index) => {
    flow.dataset.stage = String(index);
    timers.splice(0).forEach(clearTimeout);
    steps.forEach((el, i) => el.classList.toggle("is-on", i === index));
    out.classList.toggle("is-hot", index === 3);
    for (const slot of ["a", "b", "c"]) {
      notes[slot].classList.remove("is-on", "is-done");
      leads[slot]?.classList.remove("is-on");
    }
    const step = `Step 0${index + 1} · ${STEP_NAMES[index]}`;
    Object.entries(STAGES[index]).forEach(([slot, text], k) => {
      const note = notes[slot];
      const delay = motionOK ? 320 + k * 900 : 0;
      const done = STAGE_TIME * 1000 - 600 + k * 100;
      at(delay, () => {
        note.querySelector(".flow__note-step").textContent = step;
        note.querySelector(".flow__note-text").textContent = text;
        note.style.setProperty("--dur", `${done - delay}ms`);
        note.classList.add("is-on");
        leads[slot]?.classList.add("is-on");
        if (!motionOK) note.classList.add("is-done");
      });
      if (motionOK) at(done, () => note.classList.add("is-done"));
    });
  };

  /* ---------- Wires meet the steps at two ports ---------- */
  // The steps panel's width depends on the font and the screen, so the
  // wires are routed to its left edge once it is laid out: the customer's
  // pipelines enter through one port, the public data through the other.
  const svg = flow.querySelector(".flow__lines");
  const midGroup = flow.querySelector(".flow__mid");
  const exitGroup = flow.querySelector(".flow__exit");
  const firstTile = flow.querySelector(".flow__tile");
  const outEl = flow.querySelector(".flow__out");
  let W = 1200;
  let exitFrom = 812;
  let exitTo = 856;
  const stepsEl = flow.querySelector(".flow__steps");
  const wires = [...flow.querySelectorAll(".flow__wire")];
  const ports = [...flow.querySelectorAll(".flow__port")];
  const PORT_Y = { pipe: 274, adv: 286 };
  let afterRoute = () => {};
  const route = () => {
    const s = stage.getBoundingClientRect();
    if (!s.width || !s.height) return;
    W = (560 * s.width) / s.height;
    svg.setAttribute("viewBox", `0 0 ${W.toFixed(1)} 560`);
    const unit = (px) => ((px - s.left) / s.width) * W;
    const r = stepsEl.getBoundingClientRect();
    const x = unit(r.left);
    const start = unit(firstTile.getBoundingClientRect().right);
    // Leads follow the centre; exit dots run from the steps to the output.
    midGroup.setAttribute(
      "transform",
      `translate(${(W / 2 - 600).toFixed(1)} 0)`,
    );
    exitFrom = unit(r.right) + 6;
    exitTo = unit(outEl.getBoundingClientRect().left) - 6;
    // A dotted run every 12 units, brightening toward the output.
    const n = Math.max(2, Math.floor((exitTo - exitFrom) / 12));
    exitGroup.replaceChildren(
      ...Array.from({ length: n }, (_, k) => {
        const dot = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        dot.setAttribute(
          "cx",
          (exitFrom + ((exitTo - exitFrom) * (k + 0.5)) / n).toFixed(1),
        );
        dot.setAttribute("cy", "280");
        dot.setAttribute("r", "1.6");
        dot.style.opacity = (0.2 + (0.7 * k) / Math.max(1, n - 1)).toFixed(2);
        return dot;
      }),
    );
    for (const wire of wires) {
      const y0 = Number(wire.dataset.y);
      const y1 = PORT_Y[wire.dataset.group];
      wire.setAttribute(
        "d",
        `M${start.toFixed(1)} ${y0} C ${(start + 120).toFixed(1)} ${y0}, ${(x - 120).toFixed(1)} ${y1}, ${x.toFixed(1)} ${y1}`,
      );
    }
    for (const port of ports) {
      port.setAttribute("cx", x.toFixed(1));
      port.setAttribute("cy", PORT_Y[port.dataset.group]);
    }
    afterRoute();
  };
  route();
  new ResizeObserver(route).observe(stepsEl);
  new ResizeObserver(route).observe(stage);
  document.fonts?.ready.then(route);

  /* ---------- WebGL ---------- */
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  if (!gl) {
    setStage(3);
    return;
  }

  const vertex = `#version 300 es
    layout(location = 0) in vec2 aPos;
    layout(location = 1) in float aSize;
    layout(location = 2) in vec4 aColor;
    uniform vec2 uScale;
    uniform float uPx;
    out vec4 vColor;
    out float vPx;
    void main() {
      gl_Position = vec4(aPos.x * uScale.x - 1.0, 1.0 - aPos.y * uScale.y, 0.0, 1.0);
      float px = max(aSize * uPx, 1.0);
      gl_PointSize = px + 1.0;
      vPx = px;
      vColor = aColor;
    }`;
  const fragment = `#version 300 es
    precision mediump float;
    in vec4 vColor;
    in float vPx;
    out vec4 outColor;
    void main() {
      float d = length(gl_PointCoord - 0.5) * (vPx + 1.0);
      float a = clamp(vPx * 0.5 - d + 0.5, 0.0, 1.0) * vColor.a;
      outColor = vec4(vColor.rgb * a, a);
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn("Hero flow disabled:", error);
    setStage(3);
    return;
  }
  gl.useProgram(program);
  const uScale = gl.getUniformLocation(program, "uScale");
  const uPx = gl.getUniformLocation(program, "uPx");

  /* ---------- Particles ---------- */
  let seed = 3;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let CX = 600;
  const CY = 280;
  const R = 205;
  const N = 2200;
  const dir = new Float32Array(N * 3);
  const shell = new Float32Array(N);
  const size = new Float32Array(N);
  const tone = new Float32Array(N);
  const phase = new Float32Array(N);
  const red = new Uint8Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    // Jitter the even spiral so it reads as organic matter, not a lattice.
    const j = 0.09;
    let dx = Math.cos(a) * r + (rand() - 0.5) * j;
    let dy = y + (rand() - 0.5) * j;
    let dz = Math.sin(a) * r + (rand() - 0.5) * j;
    const l = Math.hypot(dx, dy, dz);
    dir.set([dx / l, dy / l, dz / l], i * 3);
    shell[i] = 0.72 + 0.28 * Math.sqrt(rand());
    size[i] = 0.9 + Math.pow(rand(), 3.2) * 4.6;
    tone[i] = 0.35 + 0.65 * rand();
    phase[i] = rand() * Math.PI * 2;
  }
  // The findings that matter: few, small, and hidden inside the sphere.
  for (let k = 0; k < 16; k++) {
    const i = Math.floor(rand() * N);
    red[i] = 1;
    shell[i] = 0.45 + rand() * 0.4;
    size[i] = 1.6 + rand() * 1.2;
  }

  // Wires: sampled from the SVG paths (they share the design units), and
  // again whenever they are re-routed.
  const wirePts = { pipe: [], adv: [] };
  const sample = () => {
    wirePts.pipe = [];
    wirePts.adv = [];
    for (const path of wires) {
      const length = path.getTotalLength();
      wirePts[path.dataset.group].push(
        Array.from({ length: 65 }, (_, k) => {
          const p = path.getPointAtLength((length * k) / 64);
          return [p.x, p.y];
        }),
      );
    }
  };
  sample();
  afterRoute = sample;
  const along = (pts, t) => {
    const f = Math.min(Math.max(t, 0), 1) * (pts.length - 1);
    const k = Math.min(Math.floor(f), pts.length - 2);
    const u = f - k;
    return [
      pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u,
      pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u,
    ];
  };
  const travellers = []; // along the wires
  const leavers = []; // out to "Fix first"

  const MAX = N + 200;
  const data = new Float32Array(MAX * 7);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 28, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 28, 12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* ---------- Size and pointer ---------- */
  let width = 1;
  let height = 1;
  const resize = () => {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    W = (560 * rect.width) / rect.height;
    CX = W / 2;
    gl.uniform2f(uScale, 2 / W, 2 / 560);
    gl.uniform1f(uPx, width / W);
    if (!motionOK) draw();
  };
  const pointer = { x: 0, y: 0, active: false };
  if (motionOK) {
    const onMove = (event) => {
      const rect = stage.getBoundingClientRect();
      const box = flow.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * W;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 560;
      pointer.active =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener(
      "pointerleave",
      () => (pointer.active = false),
    );
    window.addEventListener("blur", () => (pointer.active = false));
  }

  /* ---------- Simulation ---------- */
  let time = 0;
  let stageIndex = motionOK ? 0 : 3;
  let stageTime = motionOK ? 0 : 1.6;
  let yaw = 0;
  let yawV = 0;
  let pitch = 0.18;
  let pitchV = 0;
  let spawnWire = 0;
  let spawnLeave = 0;
  // Critically damped spring toward a target.
  const spring = (x, v, target, omega, dt) => {
    const f = 1 + 2 * dt * omega;
    const hoo = dt * omega * omega;
    const inv = 1 / (f + dt * hoo);
    return [
      (f * x + dt * v + dt * hoo * target) * inv,
      (v + hoo * (target - x)) * inv,
    ];
  };

  const step = (dt) => {
    time += dt;
    stageTime += dt;
    if (stageTime > STAGE_TIME) {
      stageTime = 0;
      stageIndex = (stageIndex + 1) % STAGES.length;
      setStage(stageIndex);
    }

    // Turn: a slow drift, plus a lean toward the cursor.
    const nx = pointer.active
      ? Math.max(-1, Math.min(1, (pointer.x - CX) / 420))
      : 0;
    const ny = pointer.active
      ? Math.max(-1, Math.min(1, (pointer.y - CY) / 280))
      : 0;
    [yaw, yawV] = spring(yaw, yawV, time * 0.16 + nx * 0.7, 2.6, dt);
    [pitch, pitchV] = spring(pitch, pitchV, 0.18 + ny * 0.45, 2.6, dt);

    // Results arrive from the pipelines while connecting and scanning; the
    // advisories feed in while cross-referencing.
    spawnWire += dt * (stageIndex === 3 ? 1.5 : 9);
    while (spawnWire > 1) {
      spawnWire -= 1;
      const group = stageIndex === 2 ? wirePts.adv : wirePts.pipe;
      travellers.push({
        wire: group[Math.floor(rand() * group.length)],
        t: 0,
        speed: 0.5 + rand() * 0.35,
        size: 1.6 + rand() * 1.6,
      });
    }
    for (const p of travellers) p.t += p.speed * dt;
    for (let k = travellers.length - 1; k >= 0; k--)
      if (travellers[k].t >= 1) travellers.splice(k, 1);

    // Fix: the findings leave the sphere for "Fix first".
    if (stageIndex === 3) {
      spawnLeave += dt * 3;
      while (spawnLeave > 1) {
        spawnLeave -= 1;
        leavers.push({
          t: 0,
          y: CY + (rand() - 0.5) * 6,
          size: 2.4 + rand() * 1.4,
        });
      }
    }
    for (const p of leavers) p.t += dt * 0.9;
    while (leavers.length && leavers[0].t >= 1) leavers.shift();
  };

  const RED = [0.776, 0.165, 0.239];
  const draw = () => {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const progress = stageTime / STAGE_TIME;
    const band = CY - R + 2 * R * progress; // the scan line, during Scan
    let n = 0;
    const put = (x, y, s, r, g, b, a) => {
      data.set([x, y, s, r, g, b, a], n * 7);
      n++;
    };

    for (let i = 0; i < N; i++) {
      const d = i * 3;
      // Rotate: yaw around y, then pitch around x.
      const x1 = dir[d] * cy + dir[d + 2] * sy;
      const z1 = -dir[d] * sy + dir[d + 2] * cy;
      const y2 = dir[d + 1] * cp - z1 * sp;
      const z2 = dir[d + 1] * sp + z1 * cp;
      const breathe = 1 + 0.014 * Math.sin(time * 0.9 + phase[i]);
      const k = 4 / (4 - z2 * shell[i]);
      const rr = R * shell[i] * breathe * k;
      const px = CX + x1 * rr;
      const py = CY - y2 * rr;

      const depth = (z2 + 1) / 2;
      let s = size[i] * (0.55 + 0.65 * depth);
      let a = (0.14 + 0.78 * depth) * tone[i];
      let col = [1, 1, 1];

      // Cross-reference: a line sweeps the estate against the advisories.
      if (stageIndex === 2) {
        const g = Math.exp(-(((py - band) / 9) ** 2));
        if (g > 0.01) {
          col = [1 - 0.224 * g, 1 - 0.835 * g, 1 - 0.761 * g];
          a = Math.min(1, a + g * 0.6);
          s *= 1 + g * 0.5;
        }
      }

      if (red[i]) {
        // Barely there until the sweep passes them; then they burn.
        const heat =
          stageIndex === 3
            ? 0.75 + 0.25 * Math.sin(time * 6 + phase[i])
            : stageIndex === 2 && py < band
              ? 0.5
              : 0.12;
        col = RED;
        a = Math.max(a * 0.6, heat);
        s *= 1 + heat * 0.9;
      }
      put(px, py, s, col[0], col[1], col[2], a);
    }

    for (const p of travellers) {
      const [x, y] = along(p.wire, p.t);
      const fade = Math.min(p.t * 6, 1, (1 - p.t) * 5);
      put(x, y, p.size, 1, 1, 1, 0.85 * fade);
    }
    for (const p of leavers) {
      const x = exitFrom + p.t * (exitTo - exitFrom);
      const fade = Math.min(p.t * 5, 1, (1 - p.t) * 4);
      put(x, p.y, p.size, RED[0], RED[1], RED[2], fade);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 7);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);
  };

  /* ---------- Loop ---------- */
  flow.classList.add("is-live");
  setStage(stageIndex);
  resize();
  new ResizeObserver(resize).observe(stage);

  if (!motionOK) {
    draw();
    return;
  }

  const STEP = 1 / 60;
  let running = false;
  let visible = false;
  let last = 0;
  let carry = 0;
  const frame = (now) => {
    if (!running) return;
    carry += Math.min((now - last) / 1000, 0.1);
    last = now;
    while (carry >= STEP) {
      step(STEP);
      carry -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  };
  const update = () => {
    const should = visible && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(flow);
  document.addEventListener("visibilitychange", update);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    running = false;
    timers.forEach(clearTimeout);
    flow.classList.remove("is-live");
  });
})();
