// Leavory — the hero scan: a glass cube holding dark blocks (the code and
// infrastructure). A red laser sweeps through it; when it crosses a
// vulnerable cell, the cell lights up red and a reticle locks on. When the
// sweep ends, the most critical finding stays in focus: fix it first. The
// cursor turns the cube and, over it, drives the laser.
// Plain WebGL2, no dependencies. With reduced motion, or without WebGL2, the
// still image stays in place.
(() => {
  const object = document.querySelector(".hero__object");
  if (!object) return;
  // `?capture` freezes one frame so scripts/capture-hero.mjs can export the
  // still image from the same scene.
  const capture = new URLSearchParams(location.search).has("capture");
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)");
  if (!motionOK.matches && !capture) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero__scene";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    preserveDrawingBuffer: capture,
    powerPreference: "high-performance",
  });
  if (!gl) return;

  /* ---------- Contents ---------- */
  let seed = 5;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // The inside of the cube is an 8×8×8 grid. Blocks of several shapes take
  // whole cells: flat slabs, towers, bars and bricks.
  const CELLS = 8;
  const INNER = 0.86;
  const CELL = (INNER * 2) / CELLS;
  const cellCenter = (i) => -INNER + CELL * (i + 0.5);
  const roll = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const taken = new Set();
  const blocks = [];
  for (let attempt = 0; attempt < 2000 && blocks.length < 34; attempt++) {
    const r = rand();
    const size =
      r < 0.35
        ? [roll(2, 4), 1, roll(2, 4)] // slab
        : r < 0.55
          ? [1, roll(2, 4), 1] // tower
          : r < 0.75
            ? rand() < 0.5
              ? [roll(3, 6), 1, 1]
              : [1, 1, roll(3, 6)] // bar
            : [roll(1, 2), roll(1, 2), roll(1, 2)]; // brick
    const at = size.map((s) => Math.floor(rand() * (CELLS - s + 1)));
    const cells = [];
    for (let x = 0; x < size[0]; x++)
      for (let y = 0; y < size[1]; y++)
        for (let z = 0; z < size[2]; z++)
          cells.push(`${at[0] + x},${at[1] + y},${at[2] + z}`);
    if (cells.some((c) => taken.has(c))) continue;
    cells.forEach((c) => taken.add(c));
    const gap = 0.018;
    blocks.push({
      center: at.map((a, k) => -INNER + CELL * (a + size[k] / 2)),
      half: size.map((s) => (s * CELL) / 2 - gap),
    });
  }

  // Thin vertical rods through free columns, like data running between layers.
  for (let attempt = 0; attempt < 200; attempt++) {
    if (blocks.length >= 44) break;
    const x = roll(0, CELLS - 1);
    const z = roll(0, CELLS - 1);
    const length = roll(3, 6);
    const y0 = roll(0, CELLS - length);
    const cells = [];
    for (let y = y0; y < y0 + length; y++) cells.push(`${x},${y},${z}`);
    if (cells.some((c) => taken.has(c))) continue;
    cells.forEach((c) => taken.add(c));
    blocks.push({
      center: [cellCenter(x), -INNER + CELL * (y0 + length / 2), cellCenter(z)],
      half: [0.007, (length * CELL) / 2, 0.007],
    });
  }

  // Small decoy cells scattered through the free space. Vulnerabilities are
  // the same size and the same dark colour until the laser finds them.
  const FINDING = 0.038; // half size of a vulnerable cell
  const spots = [];
  for (let x = 0; x < CELLS; x++)
    for (let y = 0; y < CELLS; y++)
      for (let z = 0; z < CELLS; z++) {
        // A vulnerability can hide in any cell without a decoy, even inside
        // a block.
        const p = [cellCenter(x), cellCenter(y), cellCenter(z)];
        if (taken.has(`${x},${y},${z}`) || rand() > 0.24) {
          spots.push(p);
          continue;
        }
        const h = 0.022 + rand() * 0.03;
        blocks.push({
          center: p.map((v) => v + (rand() - 0.5) * 0.08),
          half: [h, h, h],
        });
      }
  blocks.forEach((b) => (b.hi = 0));

  /* ---------- Geometry ---------- */
  // Faces with outward normals and counter-clockwise winding: [n, u, v].
  const faces = [
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [0, 1, 0],
      [1, 0, 0],
    ],
  ];
  const box = [];
  for (const [n, u, v] of faces) {
    const corner = (a, b) => [
      n[0] + u[0] * a + v[0] * b,
      n[1] + u[1] * a + v[1] * b,
      n[2] + u[2] * a + v[2] * b,
    ];
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ])
      box.push(...corner(a, b), ...n, (a + 1) / 2, (b + 1) / 2);
  }

  /* ---------- Shaders ---------- */
  const head = `#version 300 es
    precision highp float;
    uniform mat3 uRot;
    uniform vec4 uProj;
    uniform float uDist;
    vec4 project(vec3 p) {
      vec3 v = uRot * p;
      v.z -= uDist;
      return vec4(v.x * uProj.x, v.y * uProj.y, v.z * uProj.z + uProj.w, -v.z);
    }`;
  const fragHead = `#version 300 es
    precision highp float;
    uniform vec2 uViewport;
    uniform vec2 uFade;
    uniform float uScan;
    uniform float uScanAlpha;
    uniform float uTime;
    uniform vec3 uCamera; // object space
    out vec4 outColor;
    const vec3 RED = vec3(0.776, 0.165, 0.239);
    const vec3 HOT = vec3(1.0, 0.45, 0.48);
    const float EXTENT = 2.9;

    // Fade toward the canvas edges so wide effects never end in a hard cut.
    float edgeFade() {
      vec2 uv = gl_FragCoord.xy / uViewport;
      float m = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      return smoothstep(uFade.x, uFade.y, m);
    }

    // The laser sheet at a point q of its plane (premultiplied colour).
    vec4 laser(vec2 q) {
      float boxd = max(abs(q.x), abs(q.y));
      float inside = 1.0 - smoothstep(0.98, 1.02, boxd);
      float outside = (1.0 - smoothstep(1.0, EXTENT * 0.92, boxd)) * (1.0 - inside);
      vec2 g = fract(q / 0.09) - 0.5;
      float dd = length(g);
      float dw = fwidth(dd);
      float dots = 1.0 - smoothstep(0.1 - dw, 0.1 + dw, dd);
      float shimmer = 0.85 + 0.15 * sin(q.x * 9.0 - uTime * 3.0) * sin(q.y * 7.0 + uTime * 2.0);
      float a = inside * (0.14 + dots * 0.42) * shimmer + outside * (0.12 + dots * 0.25);
      a *= uScanAlpha;
      return vec4(mix(RED, HOT, dots * inside * 0.5) * a, a);
    }

    // A surface drawn after the sheet but seen through it gets the sheet on top.
    vec4 throughLaser(vec4 c, vec3 p) {
      float side = (p.y - uScan) * (uCamera.y - uScan);
      vec3 ray = p - uCamera;
      float t = (uScan - uCamera.y) / (abs(ray.y) < 1e-4 ? 1e-4 : ray.y);
      vec4 sheet = laser((uCamera + ray * t).xz) * step(side, 0.0);
      return sheet + c * (1.0 - sheet.a);
    }

    float faceEdge(vec2 uv, out float bevel) {
      vec2 e = min(uv, 1.0 - uv);
      float ed = min(e.x, e.y);
      float px = fwidth(ed);
      bevel = 1.0 - smoothstep(0.0, 0.06, ed);
      return 1.0 - smoothstep(px * 0.7, px * 1.9, ed);
    }`;

  // Outer glass and inner blocks share one shader; uKind picks the look.
  const boxVertex = `${head}
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in vec3 aNormal;
    layout(location = 2) in vec2 aUv;
    layout(location = 3) in vec3 aCenter;
    layout(location = 4) in vec3 aHalf;
    layout(location = 5) in vec3 aState; // red, visibility, highlight
    out vec3 vObj;
    out vec3 vNormal;
    out vec2 vUv;
    out vec3 vState;
    void main() {
      vObj = aCenter + aPos * aHalf;
      vNormal = aNormal;
      vUv = aUv;
      vState = aState;
      gl_Position = project(vObj);
    }`;
  const boxFragment = `${fragHead}
    in vec3 vObj;
    in vec3 vNormal;
    in vec2 vUv;
    in vec3 vState;
    uniform int uKind;   // 0 outer glass, 1 inner block or cell
    uniform float uFront;
    void main() {
      vec3 view = normalize(uCamera - vObj);
      float fresnel = pow(1.0 - abs(dot(vNormal, view)), 3.0);
      float bevel;
      float edge = faceEdge(vUv, bevel);

      // Dot grid in object units, so every surface shares one rhythm.
      vec3 n = abs(vNormal);
      vec2 q = n.x > 0.5 ? vObj.yz : n.y > 0.5 ? vObj.xz : vObj.xy;
      vec2 g = fract(q / 0.07) - 0.5;
      float dd = length(g);
      float dw = fwidth(dd);
      float dots = 1.0 - smoothstep(0.08 - dw, 0.08 + dw, dd);

      float wall = 1.0 - step(0.5, n.y);
      float band = abs(vObj.y - uScan);
      float line = exp(-band * 80.0) * uScanAlpha * wall;
      float spill = exp(-band * 8.0) * uScanAlpha * wall;
      float top = step(0.5, vNormal.y);

      vec4 c;
      // Edges catch more light toward the top of the cube.
      float lit = 0.6 + 0.4 * smoothstep(-1.0, 1.0, vObj.y);
      if (uKind == 0) {
        // Smoked glass: the far walls darken the volume, the near walls
        // only carry a faint sheen and a quiet edge.
        if (uFront > 0.5) {
          float a = 0.01 + fresnel * 0.07 + bevel * 0.035 + dots * 0.025;
          c = vec4(vec3(a), a);
          c = mix(c, vec4(1.0), edge * 0.3 * lit);
        } else {
          float a = dots * 0.035 + bevel * 0.015;
          c = vec4(vec3(a), 0.28 + a);
          c = mix(c, vec4(1.0), edge * 0.08);
        }
      } else {
        // Black glass: near-opaque body, dim edges, faint dots.
        float body = uFront > 0.5 ? 0.66 : 0.5;
        float sheen = 0.015 + fresnel * 0.05 + top * 0.03 + dots * 0.035 + vState.z * 0.07;
        vec4 dark = vec4(vec3(sheen), body + sheen * (1.0 - body));
        dark = mix(dark, vec4(1.0), edge * (uFront > 0.5 ? 0.17 : 0.06) * lit);
        // Found: red glass with hot edges.
        float ra = 0.4 + fresnel * 0.3 + top * 0.1;
        vec4 found = mix(vec4(RED * ra, ra), vec4(HOT, 1.0), edge * 0.95);
        c = mix(dark, found, vState.x);
      }

      // The laser line where the plane meets every wall it crosses.
      vec3 red = mix(RED, HOT, line);
      float ra = min(line * 0.95 + spill * 0.14, 1.0);
      c = vec4(c.rgb * (1.0 - ra) + red * ra, c.a + ra * (1.0 - c.a));
      if (uKind != 0 || uFront > 0.5) c = throughLaser(c, vObj);
      outColor = c;
    }`;

  const lineVertex = `${head}
    layout(location = 0) in vec2 aBase;  // end, side
    layout(location = 1) in vec3 aA;
    layout(location = 2) in vec3 aB;
    layout(location = 3) in vec4 aColor;
    layout(location = 4) in float aWidth;
    uniform vec2 uViewport;
    uniform float uDpr;
    out vec4 vColor;
    out float vSide;
    out float vHalf;
    void main() {
      vec4 a = project(aA);
      vec4 b = project(aB);
      vec2 dir = (b.xy / b.w - a.xy / a.w) * uViewport;
      dir = length(dir) < 1e-4 ? vec2(1.0, 0.0) : normalize(dir);
      vec2 normal = vec2(-dir.y, dir.x);
      vec4 c = mix(a, b, aBase.x);
      float w = aWidth * uDpr + 1.5;
      c.xy += normal * aBase.y * w / uViewport * c.w;
      gl_Position = c;
      vColor = aColor;
      vSide = aBase.y;
      vHalf = w * 0.5;
    }`;
  const lineFragment = `#version 300 es
    precision highp float;
    in vec4 vColor;
    in float vSide;
    in float vHalf;
    out vec4 outColor;
    void main() {
      float cover = clamp(vHalf - abs(vSide) * vHalf - 0.25, 0.0, 1.0);
      float a = vColor.a * cover;
      outColor = vec4(vColor.rgb * a, a);
    }`;

  const fxVertex = `${head}
    layout(location = 0) in vec2 aCorner;
    uniform vec3 uCenter;
    uniform vec3 uAxisU;
    uniform vec3 uAxisV;
    out vec2 vCorner;
    void main() {
      vCorner = aCorner;
      gl_Position = project(uCenter + uAxisU * aCorner.x + uAxisV * aCorner.y);
    }`;
  const fxFragment = `${fragHead}
    in vec2 vCorner;
    uniform int uMode;
    uniform float uAmount;
    void main() {
      vec4 c;
      if (uMode == 0) {
        c = laser(vCorner * EXTENT);
      } else if (uMode == 1) {
        // Glow around a finding.
        float r = length(vCorner);
        float a = exp(-r * r * 5.0) * uAmount;
        vec3 col = mix(RED, HOT, exp(-r * r * 30.0));
        c = vec4(col * a, a * 0.7);
      } else {
        // Floor: red light spilling out from the base of the cube.
        float boxd = max(abs(vCorner.x), abs(vCorner.y)) * 2.4;
        float spill = exp(-max(boxd - 1.0, 0.0) * 3.0) * smoothstep(0.6, 1.0, boxd) * uAmount;
        c = vec4(RED * spill, spill);
      }
      outColor = c * edgeFade();
    }`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const makeProgram = (vs, fs) => {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  };
  let boxes, line, fx;
  try {
    boxes = makeProgram(boxVertex, boxFragment);
    line = makeProgram(lineVertex, lineFragment);
    fx = makeProgram(fxVertex, fxFragment);
  } catch (error) {
    console.warn("Hero scan disabled:", error);
    return;
  }

  /* ---------- Buffers ---------- */
  const buffer = (data, usage = gl.STATIC_DRAW) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    return b;
  };
  const attrib = (loc, size, stride, offset, divisor = 0) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(loc, divisor);
  };

  // Instances: the outer cube, then everything inside it, far to near.
  const MAX_BOXES = 1 + blocks.length + 3;
  const boxData = new Float32Array(MAX_BOXES * 9);
  const boxBuffer = buffer(boxData.byteLength, gl.DYNAMIC_DRAW);
  const boxVao = gl.createVertexArray();
  gl.bindVertexArray(boxVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer(new Float32Array(box)));
  attrib(0, 3, 8, 0);
  attrib(1, 3, 8, 3);
  attrib(2, 2, 8, 6);
  const pointBoxes = (first) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
    attrib(3, 3, 9, first * 9, 1);
    attrib(4, 3, 9, first * 9 + 3, 1);
    attrib(5, 3, 9, first * 9 + 6, 1);
  };
  pointBoxes(0);

  const MAX_LINES = 256;
  const lineData = new Float32Array(MAX_LINES * 11);
  const lineBuffer = buffer(lineData.byteLength, gl.DYNAMIC_DRAW);
  const lineVao = gl.createVertexArray();
  gl.bindVertexArray(lineVao);
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1])),
  );
  attrib(0, 2, 2, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  attrib(1, 3, 11, 0, 1);
  attrib(2, 3, 11, 3, 1);
  attrib(3, 4, 11, 6, 1);
  attrib(4, 1, 11, 10, 1);

  const fxVao = gl.createVertexArray();
  gl.bindVertexArray(fxVao);
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])),
  );
  attrib(0, 2, 2, 0);
  gl.bindVertexArray(null);

  /* ---------- Camera and size ---------- */
  const DIST = 7;
  // World units from the centre to the top edge; the still image frames a
  // little wider so the cube never touches its edges.
  const VIEW = capture ? 2.35 : 2.05;
  const proj = new Float32Array(4);
  const rot = new Float32Array(9); // row-major: object -> view
  const rotGL = new Float32Array(9); // column-major for GLSL
  const fade = capture ? [0.11, 0.2] : [0, 0.1];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let rect = canvas.getBoundingClientRect();
  const resize = () => {
    rect = canvas.getBoundingClientRect();
    dpr = capture ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    width = capture ? 1280 : Math.max(1, Math.round(rect.width * dpr));
    height = capture ? 1280 : Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    const f = DIST / VIEW;
    const near = 0.1;
    const far = 30;
    proj[0] = f * (height / width);
    proj[1] = f;
    proj[2] = (far + near) / (near - far);
    proj[3] = (2 * far * near) / (near - far);
  };

  /* ---------- Pointer ---------- */
  const pointer = { x: 0, y: 0, active: false };
  const onMove = (event) => {
    rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.active = Math.abs(pointer.x) < 1.4 && Math.abs(pointer.y) < 1.4;
  };
  const onLeave = () => (pointer.active = false);
  if (!capture) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "mouse") onLeave();
    });
    window.addEventListener("blur", onLeave);
  }

  /* ---------- Motion helpers ---------- */
  // Critically damped spring: smooth, never overshoots.
  const spring = (s, target, omega, dt) => {
    const f = 1 + 2 * dt * omega;
    const oo = omega * omega;
    const hoo = dt * oo;
    const hhoo = dt * hoo;
    const inv = 1 / (f + hhoo);
    const x = (f * s.x + dt * s.v + hhoo * target) * inv;
    s.v = (s.v + hoo * (target - s.x)) * inv;
    s.x = x;
  };
  const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
  const ease = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const approach = (value, target, rate, dt) =>
    value + (target - value) * (1 - Math.exp(-rate * dt));

  /* ---------- Scan cycle ---------- */
  const EDGE = 1.16; // the laser rests just outside the cube
  const SPEED = 0.62; // units per second
  const yaw = { x: -0.62, v: 0 };
  const pitch = { x: 0.4, v: 0 };
  const scan = { x: EDGE, v: 0 };
  let sweep = EDGE;
  let dir = -1;
  let phase = "sweep";
  let phaseTime = 0;
  let time = 0;
  let findings = [];

  const pickFindings = () => {
    const pool = spots.slice().sort(() => rand() - 0.5);
    const picked = [];
    for (const p of pool) {
      if (picked.length === 3) break;
      if (
        picked.every(
          (q) => dist(p, q) > 0.7 && Math.abs(p[1] - q[1]) > CELL * 0.9,
        )
      )
        picked.push(p);
    }
    findings = picked.map((p, rank) => ({ p, rank, found: -1, vis: 0 }));
  };
  pickFindings();

  const pointerRay = () => {
    // View-space direction through the cursor, then into object space.
    const vx = pointer.x / proj[0];
    const vy = pointer.y / proj[1];
    const len = Math.hypot(vx, vy, 1);
    const d = [vx / len, vy / len, -1 / len];
    return [
      rot[0] * d[0] + rot[3] * d[1] + rot[6] * d[2],
      rot[1] * d[0] + rot[4] * d[1] + rot[7] * d[2],
      rot[2] * d[0] + rot[5] * d[1] + rot[8] * d[2],
    ];
  };
  const rayDistance = (d, p, o) => {
    const c = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    const t = c[0] * d[0] + c[1] * d[1] + c[2] * d[2];
    return Math.hypot(c[0] - d[0] * t, c[1] - d[1] * t, c[2] - d[2] * t);
  };

  const step = (dt) => {
    time += dt;
    phaseTime += dt;

    // Turn toward the cursor; drift gently when it rests elsewhere.
    const nx = pointer.active ? Math.max(-1, Math.min(1, pointer.x)) : 0;
    const ny = pointer.active ? Math.max(-1, Math.min(1, pointer.y)) : 0;
    spring(yaw, -0.62 + nx * 0.45 + Math.sin(time * 0.23) * 0.1, 3.2, dt);
    spring(pitch, 0.4 - ny * 0.18 + Math.sin(time * 0.31) * 0.035, 3.2, dt);

    // Over the cube, the cursor holds the laser; otherwise it sweeps.
    const manual =
      pointer.active && Math.abs(pointer.x) < 0.55 && Math.abs(pointer.y) < 0.6;
    if (manual) {
      sweep = Math.max(-EDGE, Math.min(EDGE, (pointer.y / 0.55) * 1.05));
    } else if (phase === "sweep") {
      sweep = Math.max(-EDGE, Math.min(EDGE, sweep + dir * SPEED * dt));
    }
    const before = scan.x;
    spring(scan, sweep, manual ? 9 : 6, dt);

    if (phase === "sweep") {
      for (const f of findings) {
        const y = f.p[1];
        if (f.found < 0 && (before - y) * (scan.x - y) <= 0) f.found = time;
      }
      const allFound = findings.every((f) => f.found >= 0);
      const lastFound = Math.max(...findings.map((f) => f.found));
      const ended = !manual && Math.abs(scan.x - dir * EDGE) < 0.03;
      if (ended || (allFound && time - lastFound > 1.4)) {
        phase = "hold";
        phaseTime = 0;
      }
    } else if (phase === "hold" && phaseTime > 2.6) {
      phase = "fade";
      phaseTime = 0;
    } else if (phase === "fade" && phaseTime > 0.9) {
      phase = "sweep";
      phaseTime = 0;
      dir = scan.x > 0 ? -1 : 1;
      sweep = scan.x;
      pickFindings();
    }

    for (const f of findings) {
      let vis = f.found >= 0 ? 1 : 0;
      if (phase === "hold" && f.rank > 0) vis = 0.5;
      if (phase === "fade") vis = 0;
      f.vis = approach(f.vis, vis, 9, dt);
    }

    // Blocks brighten slightly under the cursor.
    const cam = [rot[6] * DIST, rot[7] * DIST, rot[8] * DIST];
    const ray = pointer.active ? pointerRay() : null;
    for (const b of blocks) {
      let hi = 0;
      if (ray) {
        const d = rayDistance(ray, b.center, cam) - Math.max(...b.half);
        hi = 1 - clamp01(d / 0.2);
      }
      b.hi = approach(b.hi, hi, 10, dt);
    }
  };

  /* ---------- Draw ---------- */
  const updateRotation = () => {
    const ca = Math.cos(yaw.x);
    const sa = Math.sin(yaw.x);
    const cb = Math.cos(pitch.x);
    const sb = Math.sin(pitch.x);
    rot.set([ca, 0, sa, sb * sa, cb, -sb * ca, -cb * sa, sb, cb * ca]);
    rotGL.set([
      rot[0],
      rot[3],
      rot[6],
      rot[1],
      rot[4],
      rot[7],
      rot[2],
      rot[5],
      rot[8],
    ]);
  };
  const use = (p) => {
    gl.useProgram(p.program);
    const u = p.uniforms;
    gl.uniformMatrix3fv(u.uRot, false, rotGL);
    gl.uniform4fv(u.uProj, proj);
    gl.uniform1f(u.uDist, DIST);
    if (u.uViewport) gl.uniform2f(u.uViewport, width, height);
    if (u.uFade) gl.uniform2f(u.uFade, fade[0], fade[1]);
    if (u.uScan) gl.uniform1f(u.uScan, scan.x);
    if (u.uScanAlpha)
      gl.uniform1f(u.uScanAlpha, 1 - smooth(0.97, 1.12, Math.abs(scan.x)));
    if (u.uTime) gl.uniform1f(u.uTime, time);
    if (u.uCamera)
      gl.uniform3f(u.uCamera, rot[6] * DIST, rot[7] * DIST, rot[8] * DIST);
    return u;
  };

  let lineCount = 0;
  const pushLine = (a, b, alpha, w) => {
    if (lineCount >= MAX_LINES) return;
    lineData.set([...a, ...b, 0.776, 0.165, 0.239, alpha, w], lineCount * 11);
    lineCount++;
  };
  const fxQuad = (u, mode, center, axisU, axisV, amount) => {
    gl.uniform1i(u.uMode, mode);
    gl.uniform3fv(u.uCenter, center);
    gl.uniform3fv(u.uAxisU, axisU);
    gl.uniform3fv(u.uAxisV, axisV);
    gl.uniform1f(u.uAmount, amount);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const inner = [];
  const draw = () => {
    updateRotation();
    const right = [rot[0], rot[1], rot[2]];
    const up = [rot[3], rot[4], rot[5]];
    const depth = (p) => rot[6] * p[0] + rot[7] * p[1] + rot[8] * p[2];

    // Instance data: the outer cube, then everything inside, far to near.
    // Findings look like any other small cell until the laser finds them.
    boxData.set([0, 0, 0, 1, 1, 1, 0, 0, 0], 0);
    inner.length = 0;
    for (const b of blocks) inner.push([b.center, b.half, 0, b.hi]);
    for (const f of findings) {
      const pop =
        f.found >= 0 ? 1 + (1 - ease((time - f.found) / 0.4)) * 0.6 : 1;
      const h = FINDING * pop;
      inner.push([f.p, [h, h, h], f.vis, 0]);
    }
    inner.sort((a, b) => depth(a[0]) - depth(b[0]));
    inner.forEach(([center, half, red, hi], slot) =>
      boxData.set([...center, ...half, red, 0, hi], (1 + slot) * 9),
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, boxData);

    // Reticles around each finding.
    lineCount = 0;
    for (const f of findings) {
      if (f.vis < 0.02) continue;
      const enter = ease((time - f.found) / 0.5);
      let size = (FINDING * 2.2 + 0.04) * (1 + (1 - enter) * 1.6);
      if (phase === "hold" && f.rank === 0)
        size *= 1.3 + Math.sin(time * 5) * 0.06;
      const arm = size * 0.4;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const corner = [0, 1, 2].map(
            (k) => f.p[k] + right[k] * sx * size + up[k] * sy * size,
          );
          const alongX = [0, 1, 2].map((k) => corner[k] - right[k] * sx * arm);
          const alongY = [0, 1, 2].map((k) => corner[k] - up[k] * sy * arm);
          pushLine(corner, alongX, f.vis * enter, 1.4);
          pushLine(corner, alongY, f.vis * enter, 1.4);
        }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData, 0, lineCount * 11);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.CULL_FACE);

    // 1. Floor glow.
    let u = use(fx);
    gl.bindVertexArray(fxVao);
    const low = 1 - smooth(-1.1, -0.2, scan.x);
    fxQuad(u, 2, [0, -1.002, 0], [2.4, 0, 0], [0, 0, 2.4], 0.3 + low * 0.35);

    // 2. Far walls of the glass, then the far faces of everything inside.
    u = use(boxes);
    gl.bindVertexArray(boxVao);
    gl.cullFace(gl.FRONT);
    gl.uniform1f(u.uFront, 0);
    gl.uniform1i(u.uKind, 0);
    pointBoxes(0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, 1);
    gl.uniform1i(u.uKind, 1);
    pointBoxes(1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, inner.length);

    // 3. Laser sheet.
    u = use(fx);
    gl.bindVertexArray(fxVao);
    gl.disable(gl.CULL_FACE);
    fxQuad(u, 0, [0, scan.x, 0], [2.9, 0, 0], [0, 0, 2.9], 1);
    gl.enable(gl.CULL_FACE);

    // 4. Near faces of everything inside, then of the glass.
    u = use(boxes);
    gl.bindVertexArray(boxVao);
    gl.cullFace(gl.BACK);
    gl.uniform1f(u.uFront, 1);
    gl.uniform1i(u.uKind, 1);
    pointBoxes(1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, inner.length);
    gl.uniform1i(u.uKind, 0);
    pointBoxes(0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, 1);
    gl.disable(gl.CULL_FACE);

    // 5. Glows and reticles on top.
    u = use(fx);
    gl.bindVertexArray(fxVao);
    for (const f of findings) {
      if (f.vis < 0.02) continue;
      const r = 0.24;
      fxQuad(
        u,
        1,
        f.p,
        right.map((v) => v * r),
        up.map((v) => v * r),
        f.vis * 0.7,
      );
    }
    u = use(line);
    gl.uniform1f(u.uDpr, dpr);
    gl.bindVertexArray(lineVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lineCount);
    gl.bindVertexArray(null);
  };

  /* ---------- Loop ---------- */
  const STEP = 1 / 120;
  let running = false;
  let visible = false;
  let entered = false;
  let last = 0;
  let carry = 0;
  let shown = false;
  updateRotation();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    carry += dt;
    while (carry >= STEP) {
      step(STEP);
      carry -= STEP;
    }
    draw();
    if (!shown) {
      shown = true;
      object.classList.add("is-live");
    }
    requestAnimationFrame(frame);
  };
  const update = () => {
    const should = visible && entered && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  };

  object.append(canvas);
  resize();

  if (capture) {
    // Mid-sweep, just after two findings have locked on.
    const found = () => findings.filter((x) => x.found >= 0).length;
    for (let t = 0; t < 8 && found() < 2; t += STEP) step(STEP);
    for (let t = 0; t < 0.6; t += STEP) step(STEP);
    draw();
    window.heroCapture = (size) => {
      const crop = 1000;
      const out = document.createElement("canvas");
      out.width = size;
      out.height = size;
      out
        .getContext("2d")
        .drawImage(canvas, 140, 140, crop, crop, 0, 0, size, size);
      return out.toDataURL("image/webp", 0.75);
    };
    return;
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(object);
  document.addEventListener("visibilitychange", update);
  // Start once the hero has entered (after the opening).
  const watchEntry = () => {
    if (!object.classList.contains("is-in")) return;
    entered = true;
    update();
  };
  new MutationObserver(watchEntry).observe(object, {
    attributes: true,
    attributeFilter: ["class"],
  });
  watchEntry();

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    running = false;
    entered = false;
    object.classList.remove("is-live");
    canvas.remove();
  });
})();
