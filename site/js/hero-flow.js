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
    layout(location = 3) in float aMode;
    uniform vec2 uScale;
    uniform float uPx;
    out vec4 vColor;
    out float vPx;
    out float vMode;
    void main() {
      gl_Position = vec4(aPos.x * uScale.x - 1.0, 1.0 - aPos.y * uScale.y, 0.0, 1.0);
      float px = max(aSize * uPx, 1.0);
      gl_PointSize = px + 1.0;
      vPx = px;
      vColor = aColor;
      vMode = aMode;
    }`;
  const fragment = `#version 300 es
    precision mediump float;
    in vec4 vColor;
    in float vPx;
    in float vMode;
    out vec4 outColor;
    // Modes: 0 a crisp dot, 1 a soft halo, 2 a target, 3 a line.
    void main() {
      float a;
      if (vMode > 2.5) {
        a = vColor.a;
      } else if (vMode > 1.5) {
        // A ring with four ticks on the axes, about 1.5px wide.
        vec2 p = (gl_PointCoord - 0.5) * (vPx + 1.0);
        float r0 = vPx * 0.5;
        float ring = clamp(1.0 - abs(length(p) - r0 * 0.62) / 0.75, 0.0, 1.0);
        float tx = clamp(1.0 - abs(p.y) / 0.75, 0.0, 1.0) *
          step(r0 * 0.8, abs(p.x)) * step(abs(p.x), r0);
        float ty = clamp(1.0 - abs(p.x) / 0.75, 0.0, 1.0) *
          step(r0 * 0.8, abs(p.y)) * step(abs(p.y), r0);
        a = max(ring, max(tx, ty)) * vColor.a;
      } else if (vMode > 0.5) {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        a = exp(-r * r * 5.0) * (1.0 - smoothstep(0.75, 1.0, r)) * vColor.a;
      } else {
        float d = length(gl_PointCoord - 0.5) * (vPx + 1.0);
        a = clamp(vPx * 0.5 - d + 0.5, 0.0, 1.0) * vColor.a;
      }
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
  const R = 248;
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
  // The findings, hidden inside the sphere, mirror the "Fix first" card:
  // its five rows (two Critical, one Secret, two High) and a few minor
  // ones. The Cross-reference sweep finds each with a flash; at Fix the
  // five light up with their rows, Critical the largest and brightest,
  // while the minor ones only blink now and then.
  const RANKED = ["critical", "critical", "secret", "high", "high"];
  const MINOR = 11;
  const LOOK = {
    critical: { dot: 2.4, halo: 46, glow: 0.8, white: false },
    secret: { dot: 2, halo: 34, glow: 0.5, white: true },
    high: { dot: 1.6, halo: 26, glow: 0.4, white: false },
    minor: { dot: 1.1, halo: 14, glow: 0.22, white: false },
  };
  const FLASH_TIME = 1.2;
  const look = [];
  const row = new Int8Array(N).fill(-1);
  const flash = new Float32Array(N); // 1 when found, fading to 0
  const found = new Uint8Array(N);
  const findings = [];
  const mark = (i, kind) => {
    red[i] = 1;
    look[i] = LOOK[kind];
    findings.push(i);
  };
  // Spiral order runs top to bottom: these spots spread the ranked ones
  // over the sphere, clear of the steps bar across its middle, and the
  // sweep finds them in card order.
  const SPOTS = [0.12, 0.26, 0.7, 0.8, 0.9];
  RANKED.forEach((kind, r) => {
    const i = Math.floor(N * SPOTS[r]);
    mark(i, kind);
    row[i] = r;
    shell[i] = 0.5 + rand() * 0.3;
    size[i] = 1.8 + rand() * 0.4;
  });
  for (let k = 0; k < MINOR; k++) {
    let i;
    do i = Math.floor(rand() * N);
    while (red[i]);
    mark(i, "minor");
    shell[i] = 0.45 + rand() * 0.4;
    size[i] = 1.4 + rand() * 0.8;
  }
  const foundAt = new Float32Array(N); // when the sweep found it
  const TARGET_TIME = 1.6; // how long the target stays on a new finding

  // A sparse data network across the sphere: some particles, every finding
  // among them, each linked to its two nearest neighbours. Packets of data
  // run along a few links.
  const NODES = 90;
  const nodes = [...findings];
  while (nodes.length < NODES) {
    const i = Math.floor(rand() * N);
    if (!nodes.includes(i)) nodes.push(i);
  }
  const spot = (i) => [0, 1, 2].map((k) => dir[i * 3 + k] * shell[i]);
  const edges = [];
  const linked = new Set();
  for (const a of nodes) {
    const pa = spot(a);
    const nearest = nodes
      .filter((b) => b !== a)
      .map((b) => [b, Math.hypot(...spot(b).map((v, k) => v - pa[k]))])
      .sort((p, q) => p[1] - q[1])
      .slice(0, 2);
    for (const [b] of nearest) {
      const key = Math.min(a, b) * N + Math.max(a, b);
      if (linked.has(key)) continue;
      linked.add(key);
      edges.push([a, b]);
    }
  }
  const PACKETS = 14;
  const packets = Array.from({ length: PACKETS }, () => ({
    edge: edges[Math.floor(rand() * edges.length)],
    t: rand(),
    speed: 0.35 + rand() * 0.4,
  }));
  // Where each particle lands on screen this frame, for the links.
  const projX = new Float32Array(N);
  const projY = new Float32Array(N);
  const projD = new Float32Array(N);
  const glowNow = new Float32Array(N);

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

  // Background texture: a fine grid of dots that shows in slow, drifting
  // patches, behind everything else.
  const DOT = 10; // grid step, in design units
  const MAX_DOTS = Math.ceil(2400 / DOT) * Math.ceil(560 / DOT);
  const hash = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const MAX =
    N + 2 * findings.length + PACKETS + 2 * edges.length + 200 + MAX_DOTS;
  const data = new Float32Array(MAX * 8);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 32, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 12);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 32, 28);
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
      if (stageIndex === 2) found.fill(0); // a new sweep finds them again
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

    for (const i of findings)
      flash[i] = Math.max(0, flash[i] - dt / FLASH_TIME);

    for (const p of packets) {
      p.t += p.speed * dt;
      if (p.t >= 1) {
        p.t = 0;
        p.edge = edges[Math.floor(rand() * edges.length)];
      }
    }
  };

  const RED = [0.776, 0.165, 0.239];
  const glows = [];
  const targets = [];
  const draw = () => {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const progress = stageTime / STAGE_TIME;
    const band = CY - R + 2 * R * progress; // the scan line, during Scan
    let n = 0;
    const put = (x, y, s, r, g, b, a, mode = 0) => {
      data.set([x, y, s, r, g, b, a, mode], n * 8);
      n++;
    };

    // The dot texture first, so everything else draws over it.
    const drift = time * 0.035;
    for (let y = DOT / 2; y < 560; y += DOT)
      for (let x = DOT / 2; x < W; x += DOT) {
        const v = noise(x / 90 + drift, y / 90 - drift * 0.6);
        const patch = Math.min(1, Math.max(0, (v - 0.52) / 0.22));
        if (patch <= 0.02) continue;
        const edge = Math.min(1, y / 60, (560 - y) / 60);
        // A soft shadow around the sphere: the texture fades out behind it,
        // so only the sphere's own particles show there.
        const r = Math.hypot(x - CX, y - CY) / R;
        const t = Math.min(1, Math.max(0, (r - 0.85) / 0.55));
        const clear = t * t * (3 - 2 * t);
        if (clear <= 0.01) continue;
        put(x, y, 1.4, 1, 1, 1, 0.22 * patch * edge * clear);
      }

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
      projX[i] = px;
      projY[i] = py;
      projD[i] = depth;
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
        const kind = look[i];
        // Found: the sweep line just reached it.
        if (stageIndex === 2 && py < band && !found[i]) {
          found[i] = 1;
          flash[i] = 1;
          foundAt[i] = time;
        }
        // How much it stands out right now, from 0 to 1.
        let glow = flash[i] * flash[i]; // bright at once, then easing out
        let heat = stageIndex === 2 && found[i] ? 0.5 : 0.12;
        if (stageIndex === 3 && row[i] >= 0) {
          // Lights up with its row in the card, then breathes.
          const on = Math.min(
            1,
            Math.max(0, (stageTime - 0.3 - row[i] * 0.18) / 0.35),
          );
          glow = Math.max(
            glow,
            on * (0.85 + 0.15 * Math.sin(time * 3 + phase[i])),
          );
          heat = 0.5 + 0.5 * on;
        } else if (row[i] < 0 && stageIndex >= 2 && found[i]) {
          // Minor: a brief blink every few seconds.
          const blink = Math.max(0, Math.sin(time * 1.7 + phase[i] * 3)) ** 12;
          glow = Math.max(glow, blink);
          heat = Math.max(heat, 0.35 + 0.3 * blink);
        }
        col = kind.white ? [1, 1, 1] : RED;
        // Ranked findings keep their size on the far side of the sphere.
        if (row[i] >= 0) s = size[i] * (0.85 + 0.3 * depth);
        a = Math.max(a * 0.6, heat, glow);
        s *= (1 + heat * 0.6) * (1 + (kind.dot - 1) * glow);
        glowNow[i] = glow;
        if (glow > 0.02) glows.push([px, py, depth, glow, kind]);
        // A target locks onto a finding as the sweep finds it.
        const since = time - foundAt[i];
        if (found[i] && since < TARGET_TIME)
          targets.push([px, py, since, kind, row[i] >= 0]);
      }
      put(px, py, s, col[0], col[1], col[2], a);
    }
    // Halos under the findings that stand out; the ones on the far side of
    // the sphere glow a little less.
    for (const [x, y, depth, glow, kind] of glows) {
      const tint = kind.white ? [1, 1, 1] : RED;
      put(
        x,
        y,
        kind.halo * (0.75 + 0.25 * glow),
        tint[0],
        tint[1],
        tint[2],
        kind.glow * glow * (0.75 + 0.25 * depth),
        1,
      );
    }
    glows.length = 0;
    // Targets: they close in from a little wider, hold, then fade.
    for (const [x, y, since, kind, ranked] of targets) {
      const lock = Math.min(1, since / 0.35);
      const ease = 1 - (1 - lock) ** 3;
      const out = Math.min(1, (TARGET_TIME - since) / 0.4);
      const tint = kind.white ? [1, 1, 1] : RED;
      put(
        x,
        y,
        (ranked ? 26 : 17) * (1 + 0.7 * (1 - ease)),
        tint[0],
        tint[1],
        tint[2],
        (ranked ? 0.9 : 0.5) * Math.min(1, lock * 1.5) * out,
        2,
      );
    }
    targets.length = 0;
    // Data packets along the links.
    for (const p of packets) {
      const [a, b] = p.edge;
      const fade = Math.min(p.t * 5, 1, (1 - p.t) * 5);
      const depth = projD[a] + (projD[b] - projD[a]) * p.t;
      put(
        projX[a] + (projX[b] - projX[a]) * p.t,
        projY[a] + (projY[b] - projY[a]) * p.t,
        1.7,
        1,
        1,
        1,
        (0.25 + 0.6 * depth) * fade,
      );
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

    // The links, hairlines fainter on the far side; an end at a finding
    // that stands out takes its colour.
    const points = n;
    for (const [a, b] of edges) {
      const depth = (projD[a] + projD[b]) / 2;
      const base = 0.03 + 0.13 * depth * depth;
      for (const i of [a, b]) {
        const lit = red[i] && glowNow[i] > 0.05 ? glowNow[i] : 0;
        const tint = lit && !look[i].white ? RED : [1, 1, 1];
        put(projX[i], projY[i], 1, ...tint, base + 0.4 * lit, 3);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 8);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, points, n - points); // under the particles
    gl.drawArrays(gl.POINTS, 0, points);
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
  let paused = false; // the page's pause button (js/main.js)
  let lost = false; // the WebGL context is gone for good
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
    const should = visible && !document.hidden && !paused && !lost;
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
  // Paused, the frame holds still and pending status notes stay as they are.
  document.addEventListener("motionpause", (event) => {
    paused = event.detail.paused;
    if (paused) timers.splice(0).forEach(clearTimeout);
    update();
  });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    running = false;
    timers.forEach(clearTimeout);
    flow.classList.remove("is-live");
  });
})();
