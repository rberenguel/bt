import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";

let scoreTarget = 10; // updated from history on load
getHistory().then((h) => {
  if (h.length) scoreTarget = Math.max(...h.map((s) => s.metrics.score)) + 1;
});

// ── Config ───────────────────────────────────────────────
const CONFIG = {
  sessionTime: 120, // seconds
  shapesPerRound: 6,
  wobbleAmplitude: 0.6,
  feedbackMs: 500,
  maxShapeGenAttempts: 200,
  ambient: 0.75,
  diffuse: 0.25,
};

// ── 3-D math ──────────────────────────────────────────────
function mulMM(a, b) {
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}
function mulMV(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
const ID3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// Rodrigues rotation around arbitrary unit axis
function rotAxisAngle(axis, angle) {
  const [x, y, z] = axis;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

// All 24 orientations via BFS
const ROT24 = (() => {
  const Rx90 = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];
  const Ry90 = [
    [0, 0, 1],
    [0, 1, 0],
    [-1, 0, 0],
  ];
  const Rz90 = [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ];
  const seen = new Map();
  const key = (m) => m.flat().join(",");
  const q = [ID3];
  seen.set(key(ID3), ID3);
  while (q.length) {
    const m = q.shift();
    for (const g of [Rx90, Ry90, Rz90]) {
      const n = mulMM(m, g);
      const k = key(n);
      if (!seen.has(k)) {
        seen.set(k, n);
        q.push(n);
      }
    }
  }
  return [...seen.values()];
})();

// Initial tilt: rx(π/4) * rz(π/4)  — same as original rx * rz
const BASE_TILT = mulMM(
  rotAxisAngle([1, 0, 0], Math.PI * 0.25),
  rotAxisAngle([0, 0, 1], Math.PI * 0.25),
);

// ── Shape canonicalization ────────────────────────────────
function applyRot(m, positions) {
  return positions.map((v) => mulMV(m, v));
}
function canonicalize(positions) {
  const mx = Math.min(...positions.map((p) => p[0]));
  const my = Math.min(...positions.map((p) => p[1]));
  const mz = Math.min(...positions.map((p) => p[2]));
  const t = positions.map(([x, y, z]) => [x - mx, y - my, z - mz]);
  t.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return t.map((p) => p.join(",")).join("|");
}
function shapeKey(positions) {
  return ROT24.map((m) => canonicalize(applyRot(m, positions))).sort()[0];
}

// ── Shape generation (faithful port of original C++) ──────
// Direction bits: 1=z(001), 2=y(010), 4=x(100)
// Blocks at 2-unit grid; l = 2 + (i&1) + rand(0,1) per segment
function tryGenerateShape() {
  const rb = () => (Math.random() < 0.5 ? 0 : 1);
  let center = [0, 0, 0];
  let direction = 2; // start on y-axis
  let side = 1;
  const blocks = [];
  const set = new Set();

  for (let i = 0; i < 4; i++) {
    const d = [
      2 * side * (direction >> 2),
      2 * side * ((direction >> 1) & 1),
      2 * side * (direction & 1),
    ];
    const l = 2 + (i & 1) + rb();
    for (let j = 0; j < l; j++) {
      const k = center.join(",");
      if (set.has(k)) return null; // self-intersection → reject
      set.add(k);
      blocks.push([...center]);
      center = [center[0] + d[0], center[1] + d[1], center[2] + d[2]];
    }
    // Always turn to a different perpendicular axis
    switch (direction) {
      case 1:
        direction = rb() ? 2 : 4;
        break;
      case 2:
        direction = rb() ? 1 : 4;
        break;
      case 4:
        direction = rb() ? 1 : 2;
        break;
    }
    if (rb()) side = -side;
  }
  return blocks;
}
function generateShape() {
  let s;
  do {
    s = tryGenerateShape();
  } while (!s);
  return s;
}

function centroid(positions) {
  const n = positions.length;
  return positions.reduce(
    ([ax, ay, az], [x, y, z]) => [ax + x / n, ay + y / n, az + z / n],
    [0, 0, 0],
  );
}
function shapeRadius(positions) {
  const c = centroid(positions);
  return (
    Math.max(
      ...positions.map((p) =>
        Math.sqrt((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2),
      ),
    ) + 1.5
  ); // +1.5 accounts for cube half-diagonal
}

// ── Wobble (3 independent sin-waves around random 3D axes) ─
function randomUnitVec() {
  let x, y, z, d;
  do {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
    z = Math.random() * 2 - 1;
    d = x * x + y * y + z * z;
  } while (d > 1 || d < 1e-6);
  const n = Math.sqrt(d);
  return [x / n, y / n, z / n];
}
function makeWobble(amplitude = CONFIG.wobbleAmplitude) {
  const waves = Array.from({ length: 3 }, () => ({
    amp: 0.5 + (0.5 + Math.random() * 0.5) * amplitude,
    dir: randomUnitVec(),
    phase: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 2.5,
  }));
  return { waves, t: 0 };
}
function wobbleMatrix(wb) {
  return wb.waves.reduce((m, w) => {
    const angle = w.amp * Math.sin(0.5 * w.speed * wb.t + w.phase);
    return mulMM(m, rotAxisAngle(w.dir, angle));
  }, ID3);
}

// ── Round shape generation ─────────────────────────────────
function generateRoundShapes(n) {
  const usedKeys = new Set();
  const allPositions = [];

  for (let i = 0; i < n - 1; i++) {
    let pos, key;
    let attempts = 0;
    do {
      pos = generateShape();
      key = shapeKey(pos);
      attempts++;
    } while (usedKeys.has(key) && attempts < CONFIG.maxShapeGenAttempts);
    usedKeys.add(key);
    allPositions.push(pos);
  }

  // Duplicate one with a different base rotation
  const matchBase = Math.floor(Math.random() * (n - 1));
  let matchRot;
  do {
    matchRot = ROT24[Math.floor(Math.random() * ROT24.length)];
  } while (JSON.stringify(matchRot) === JSON.stringify(ID3));

  const matchPos = applyRot(matchRot, allPositions[matchBase]);
  const insertAt = (matchBase + 1 + Math.floor(Math.random() * (n - 1))) % n;
  allPositions.splice(insertAt, 0, matchPos);

  return {
    positions: allPositions,
    matchPair: [matchBase < insertAt ? matchBase : matchBase + 1, insertAt],
  };
}

// ── Rendering ─────────────────────────────────────────────
// Same hues as C++ GeneratedColors (vh/vm/vl ratios preserved),
// scaled to sRGB display equivalent of C++'s linear 0.51 → ~0xcc
// vh=0xcc(204), vm=0x66(102), vl=0
const COLORS = [
  "#cc0000", // red
  "#00cc00", // green
  "#0000cc", // blue
  "#cc00cc", // magenta
  "#cc6600", // orange
  "#cc0066", // rose
  "#6600cc", // violet
];

// Cube face definitions (half-size = 1, center at origin)
const CUBE_FACES = [
  {
    n: [0, 1, 0],
    v: [
      [-1, 1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
  }, // top
  {
    n: [0, -1, 0],
    v: [
      [-1, -1, 1],
      [1, -1, 1],
      [1, -1, -1],
      [-1, -1, -1],
    ],
  }, // bottom
  {
    n: [0, 0, 1],
    v: [
      [1, -1, 1],
      [-1, -1, 1],
      [-1, 1, 1],
      [1, 1, 1],
    ],
  }, // front
  {
    n: [0, 0, -1],
    v: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
  }, // back
  {
    n: [-1, 0, 0],
    v: [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ],
  }, // left
  {
    n: [1, 0, 0],
    v: [
      [1, -1, 1],
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
    ],
  }, // right
];

const LIGHT = (() => {
  const l = [0.6, 1, 0.8];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();

function shadeHex(hex, b) {
  b = Math.max(0, Math.min(1, b));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const bv = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * b)},${Math.round(g * b)},${Math.round(bv * b)})`;
}

function renderShape(canvas, shape, rotMat) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const { positions, color, centroid: ctr, radius } = shape;
  // Fixed scale computed from shape radius — doesn't change with rotation
  const scale = (Math.min(w, h) * 0.5) / radius;
  const CDIST = 24; // camera z distance in "scale" units

  const posSet = new Set(positions.map((p) => p.join(",")));
  const faces = [];

  for (const [ix, iy, iz] of positions) {
    for (const { n, v } of CUBE_FACES) {
      // Cull interior faces (neighbor exists 2 units away in normal direction)
      const adj = [ix + n[0] * 2, iy + n[1] * 2, iz + n[2] * 2];
      if (posSet.has(adj.join(","))) continue;

      // Transform normal
      const rn = mulMV(rotMat, n);
      if (rn[2] <= 0) continue; // back-face cull

      // Transform vertices (center - centroid, then rotate)
      const rv = v.map(([dx, dy, dz]) => {
        const wx = ix + dx - ctr[0],
          wy = iy + dy - ctr[1],
          wz = iz + dz - ctr[2];
        return mulMV(rotMat, [wx, wy, wz]);
      });

      const cz = rv.reduce((s, p) => s + p[2], 0) / 4;
      const bright =
        CONFIG.ambient +
        CONFIG.diffuse *
          Math.max(0, rn[0] * LIGHT[0] + rn[1] * LIGHT[1] + rn[2] * LIGHT[2]);
      faces.push({ rv, cz, bright });
    }
  }

  faces.sort((a, b) => a.cz - b.cz);

  const cx = w / 2,
    cy = h / 2;
  for (const { rv, bright } of faces) {
    // Perspective projection
    const pts = rv.map(([x, y, z]) => {
      const pz = CDIST - z; // distance from camera
      const ps = (scale * CDIST) / pz;
      return [cx + x * ps, cy - y * ps];
    });
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = shadeHex(color, bright);
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ── State ─────────────────────────────────────────────────
let state = fresh();
function fresh() {
  return {
    running: false,
    score: 0,
    attempts: 0,
    shapes: [],
    matchPair: [],
    selected: [],
    phase: "idle",
    roundStart: 0,
    cells: [],
    timeLeft: CONFIG.sessionTime,
  };
}

let timers = [];
const schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
};
const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

// ── DOM ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const appContainer = document.querySelector(".app-container");
const shapeGrid = $("shape-grid");
const idleOverlay = $("idle-overlay");
const timerBar = $("timer-bar");
const scoreEl = $("score-display");
const playBtn = $("play-btn");
const resultsModal = $("results-modal");
const brainProgress = document.querySelector(".brain-progress-fill");
const brainFire = document.querySelector(".brain-fire-fill");

(async () => {
  try {
    const m = await (await fetch("manifest.json")).json();
    if (m.version) $("app-version").textContent = "v" + m.version;
  } catch {}
})();
initHaptic();
FireSystem.init();
setBrainFill(0);

function setBrainFill(p) {
  const inset = Math.round(88 - p * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(p, inset);
}

// ── Animation loop ────────────────────────────────────────
let lastTs = 0;
function animate(ts) {
  requestAnimationFrame(animate);
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;
  if (state.phase !== "playing" && state.phase !== "feedback") return;

  // Tick timer
  if (state.phase === "playing") {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const frac = state.timeLeft / CONFIG.sessionTime;
    timerBar.style.transform = `scaleX(${frac})`;
    timerBar.classList.toggle("urgent", frac < 0.2);
    if (state.timeLeft <= 0) {
      endSession();
      return;
    }
  }

  for (let i = 0; i < state.shapes.length; i++) {
    const sh = state.shapes[i];
    sh.wobble.t += dt;
    const wm = wobbleMatrix(sh.wobble);
    const rot = mulMM(sh.baseRot, wm);
    const cv = state.cells[i]?.querySelector("canvas");
    if (cv) renderShape(cv, sh, rot);
  }
}
requestAnimationFrame((ts) => {
  lastTs = ts;
  animate(ts);
});

// ── Game logic ────────────────────────────────────────────
function buildGrid() {
  shapeGrid.innerHTML = "";
  state.cells = [];
  const n = CONFIG.shapesPerRound;
  shapeGrid.style.gridTemplateRows = `repeat(${n / 2}, 1fr)`;
  for (let i = 0; i < n; i++) {
    const cell = document.createElement("div");
    cell.className = "shape-cell";
    const cv = document.createElement("canvas");
    cell.appendChild(cv);
    cell.addEventListener("click", () => onCellClick(i));
    shapeGrid.appendChild(cell);
    state.cells.push(cell);
  }
}

function startRound() {
  state.phase = "playing";
  state.selected = [];
  state.roundStart = performance.now();
  clearCellStates();

  const { positions, matchPair } = generateRoundShapes(CONFIG.shapesPerRound);
  state.matchPair = matchPair;

  const shuffled = [...COLORS].sort(() => Math.random() - 0.5);

  state.shapes = positions.map((pos, i) => {
    const c = centroid(pos);
    return {
      positions: pos,
      color: shuffled[i % shuffled.length],
      centroid: c,
      radius: shapeRadius(pos),
      baseRot: mulMM(
        BASE_TILT,
        ROT24[Math.floor(Math.random() * ROT24.length)],
      ),
      wobble: makeWobble(),
    };
  });
}

function clearCellStates() {
  for (const c of state.cells)
    c.classList.remove("selected", "correct", "wrong");
}

function onCellClick(idx) {
  if (state.phase !== "playing") return;
  if (state.selected.includes(idx)) {
    triggerHaptic();
    state.selected = state.selected.filter((i) => i !== idx);
    state.cells[idx].classList.remove("selected");
    return;
  }
  if (state.selected.length >= 2) return;
  triggerHaptic();
  state.selected.push(idx);
  state.cells[idx].classList.add("selected");
  if (state.selected.length === 2) evaluateSelection();
}

function evaluateSelection() {
  state.phase = "feedback";
  state.attempts++;
  const [a, b] = state.selected;
  const [ma, mb] = state.matchPair;
  const ok = (a === ma && b === mb) || (a === mb && b === ma);
  const elapsed = (performance.now() - state.roundStart) / 1000;
  if (ok) {
    state.score++;
    scoreEl.textContent = state.score;
    setBrainFill(Math.min(1, state.score / state.target));
    shapeGrid.classList.add("fading");
    schedule(() => {
      startRound();
      shapeGrid.classList.remove("fading");
    }, 350);
  } else {
    triggerHapticError();
    for (const i of state.selected) state.cells[i].classList.add("wrong");
    schedule(() => {
      clearCellStates();
      state.selected = [];
      state.phase = "playing";
    }, CONFIG.feedbackMs);
  }
}

function startSession() {
  state = fresh();
  state.target = scoreTarget;
  state.running = true;
  appContainer.classList.add("playing");
  idleOverlay.classList.add("hidden");
  timerBar.style.transform = "scaleX(1)";
  timerBar.classList.remove("urgent");
  scoreEl.textContent = "0";
  buildGrid();
  setBrainFill(0);
  startRound();
}

function resetSession() {
  clearTimers();
  state = fresh();
  shapeGrid.innerHTML = "";
  idleOverlay.classList.remove("hidden");
  appContainer.classList.remove("playing");
  timerBar.style.transform = "scaleX(1)";
  timerBar.classList.remove("urgent");
  scoreEl.textContent = "";
  setBrainFill(0);
  playBtn.disabled = false;
  resultsModal.classList.add("hidden");
}

function endSession() {
  if (state.phase === "idle") return; // guard double-call
  state.running = false;
  state.phase = "idle";
  clearTimers();
  appContainer.classList.remove("playing");
  const acc = state.attempts
    ? Math.round((state.score / state.attempts) * 100)
    : 0;
  $("modal-score").textContent = state.score;
  $("modal-accuracy").textContent = acc + "%";
  $("modal-avgtime").textContent = "2:00";
  saveSession({ score: state.score, accuracy: acc });
  if (state.score >= scoreTarget) scoreTarget = state.score + 1;
  resultsModal.classList.remove("hidden");
  playBtn.disabled = false;
}

// ── Events ────────────────────────────────────────────────
playBtn.addEventListener("click", () => {
  triggerHaptic();
  startSession();
});
$("modal-close-btn").addEventListener("click", () => {
  triggerHaptic();
  resetSession();
});
$("stats-btn").addEventListener("click", () => {
  triggerHaptic();
  openHistoryModal();
});
$("close-history-btn").addEventListener("click", () =>
  $("history-modal").classList.add("hidden"),
);
