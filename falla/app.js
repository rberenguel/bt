import { FireSystem } from "../shared/fire.js";
import { saveSession } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

const ROUNDS = 10;
const COLS = 6;

// Level → { maxRows, time (seconds) }
const LEVELS = [
  { maxRows: 5, time: 60 },
  { maxRows: 5, time: 57 },
  { maxRows: 6, time: 57 },
  { maxRows: 6, time: 55 },
  { maxRows: 7, time: 55 },
  { maxRows: 7, time: 54 },
  { maxRows: 8, time: 54 },
  { maxRows: 9, time: 54 },
];
const MAX_LEVEL = LEVELS.length;

const SEG_CLASSES = [
  "h h0", "h h1", "h h2", "h h3", "h h4", "h h5",
  "v v0", "v v1", "v v2", "v v3", "v v4", "v v5",
];

const $ = (id) => document.getElementById(id);

let state = null;
let cellElements = [];
let boardGen = 0; // cellElements[r][c] → node-wrapper element

// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudio();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {}
}

// ── Pattern filter ────────────────────────────────────────────
// Both forbidden variants are self-invariant under 90° CSS rotation,
// so one check per logical state covers all four displayed orientations.
const FORBIDDEN_A = [1, 2, 3, 4, 6, 8, 9, 11];
const FORBIDDEN_B = [0, 2, 3, 5, 7, 8, 9, 10];

function isNotAllowed(segs) {
  const bad = FORBIDDEN_A.every(i => segs[i]) || FORBIDDEN_B.every(i => segs[i]);
  if (bad) console.log("[falla] pruned forbidden pattern", segs.map(Number).join(""));
  return bad;
}

// ── Data generation ───────────────────────────────────────────
function generateRowData(isAnomalyRow, anomalyCol) {
  let seg = Array(12).fill(false);
  let count = 4 + Math.floor(Math.random() * 4);
  while (seg.filter(Boolean).length < count) {
    seg[Math.floor(Math.random() * 12)] = true;
  }
  while (isNotAllowed(seg)) {
    seg[Math.floor(Math.random() * 12)] = !seg[Math.floor(Math.random() * 12)];
  }

  const sequence = [[...seg]];
  let lastToggle = -1;

  for (let c = 1; c < COLS; c++) {
    let next, t;
    do {
      do { t = Math.floor(Math.random() * 12); } while (t === lastToggle);
      next = [...sequence[c - 1]];
      next[t] = !next[t];
    } while (isNotAllowed(next));
    sequence.push(next);
    lastToggle = t;
  }

  if (isAnomalyRow) {
    const base = sequence[anomalyCol - 1];
    let anomaly, z, w;
    do {
      do { z = Math.floor(Math.random() * 12); } while (z === lastToggle);
      do { w = Math.floor(Math.random() * 12); } while (w === z);
      anomaly = [...base];
      anomaly[z] = !anomaly[z];
      anomaly[w] = !anomaly[w];
    } while (isNotAllowed(anomaly));
    sequence[anomalyCol] = anomaly;
  }

  return sequence.map((s) => ({
    segments: s,
    rotation: Math.floor(Math.random() * 4) * 90,
  }));
}

// ── Brain fill ────────────────────────────────────────────────
const brainProgress = document.querySelector(".brain-progress-fill");
const brainFire = document.querySelector(".brain-fire-fill");

function setBrainFill(p) {
  const inset = Math.round(88 - p * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(p, inset);
}

// ── Timer ─────────────────────────────────────────────────────
function startTimer(seconds) {
  const bar = $("timer-bar");
  const end = performance.now() + seconds * 1000;
  state.timerEnd = end;

  function tick() {
    const rem = Math.max(0, state.timerEnd - performance.now());
    const frac = rem / (seconds * 1000);
    bar.style.transform = `scaleX(${frac})`;
    bar.classList.toggle("urgent", frac < 0.25);
    if (rem <= 0) {
      onTimeout();
      return;
    }
    state.timerRaf = requestAnimationFrame(tick);
  }
  state.timerRaf = requestAnimationFrame(tick);
}

function stopTimer() {
  if (state.timerRaf) {
    cancelAnimationFrame(state.timerRaf);
    state.timerRaf = null;
  }
  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");
}

// ── Board ─────────────────────────────────────────────────────
function buildBoard(level) {
  boardGen++;
  const board = $("game-board");
  board.innerHTML = "";
  cellElements = [];

  const { maxRows } = LEVELS[level - 1];
  const gameArea = $("game-area");
  const nodeSize = Math.min(gameArea.clientWidth * 0.13, 38);
  const rowH = nodeSize + 10 + 12;
  const fitRows = Math.max(3, Math.round(gameArea.clientHeight / rowH));
  const rows = Math.min(maxRows, fitRows);

  const anomalyR = Math.floor(Math.random() * rows);
  const anomalyC = 1 + Math.floor(Math.random() * (COLS - 2));
  state.anomalyCoords = { r: anomalyR, c: anomalyC };

  const gen = boardGen;
  let remaining = rows * COLS;

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    const rowData = generateRowData(r === anomalyR, anomalyC);
    cellElements[r] = [];

    for (let c = 0; c < COLS; c++) {
      const { segments, rotation } = rowData[c];
      const wrapper = document.createElement("div");
      wrapper.className = "node-wrapper";

      const shape = document.createElement("div");
      shape.className = "shape-container";
      const spins = [-180, -90, 90, 180];
      const spin = spins[Math.floor(Math.random() * spins.length)];
      shape.style.transform = `rotate(${rotation + spin}deg)`;

      const domSegs = [];
      for (let s = 0; s < 12; s++) {
        const seg = document.createElement("div");
        seg.className = `segment ${SEG_CLASSES[s]}`;
        shape.appendChild(seg);
        domSegs.push(seg);
      }

      wrapper.appendChild(shape);
      rowEl.appendChild(wrapper);
      cellElements[r][c] = wrapper;

      const cr = r, cc = c;
      wrapper.addEventListener("click", () => {
        triggerHaptic();
        handleTap(wrapper, cr, cc);
      });

      shape.addEventListener("transitionend", () => {
        if (boardGen !== gen) return;
        remaining--;
        if (remaining === 0) {
          requestAnimationFrame(() => {
            if (boardGen !== gen) return;
            board.querySelectorAll(".segment.active").forEach(el => el.classList.add("glowing"));
          });
        }
      }, { once: true });

      setTimeout(() => {
        shape.style.transform = `rotate(${rotation}deg)`;
        for (let s = 0; s < 12; s++) {
          if (segments[s]) domSegs[s].classList.add("active");
        }
      }, r * 35 + c * 25);
    }
    board.appendChild(rowEl);
  }
}

// ── Game flow ─────────────────────────────────────────────────
function handleTap(wrapper, r, c) {
  if (state.phase !== "playing") return;

  const { r: ar, c: ac } = state.anomalyCoords;
  if (r === ar && c === ac) {
    state.phase = "revealing";
    stopTimer();
    playSound("success");
    wrapper.classList.add("success");
    state.score++;
    state.level = Math.min(MAX_LEVEL, state.level + 1);
    setBrainFill(state.score / ROUNDS);
    $("score-display").textContent = state.score;
    setTimeout(nextRound, 1000);
  } else {
    triggerHapticError();
    playSound("error");
    wrapper.classList.add("error");
    setTimeout(() => wrapper.classList.remove("error"), 300);
  }
}

function onTimeout() {
  if (state.phase !== "playing") return;
  state.phase = "revealing";
  stopTimer();
  triggerHapticError();
  playSound("error");
  state.level = Math.max(1, state.level - 1);

  const { r, c } = state.anomalyCoords;
  if (cellElements[r]?.[c]) cellElements[r][c].classList.add("success");

  setTimeout(nextRound, 1500);
}

function nextRound() {
  state.roundIdx++;
  if (state.roundIdx >= ROUNDS) {
    endSession();
  } else {
    startRound();
  }
}

function startRound() {
  state.phase = "playing";
  const { time } = LEVELS[state.level - 1];
  $("q-counter").textContent = `${state.roundIdx + 1} / ${ROUNDS}`;
  $("score-display").textContent = state.score;
  buildBoard(state.level);
  startTimer(time);
}

function startSession() {
  state = {
    phase: "playing",
    roundIdx: 0,
    level: 1,
    score: 0,
    timerRaf: null,
    timerEnd: 0,
    anomalyCoords: { r: -1, c: -1 },
  };
  $("results-modal").classList.add("hidden");
  setBrainFill(0);
  startRound();
}

function endSession() {
  state.phase = "idle";
  stopTimer();

  const accuracy = Math.round((state.score / ROUNDS) * 100);

  $("modal-score").textContent = `${state.score} / ${ROUNDS}`;
  $("modal-accuracy").textContent = accuracy + "%";
  $("modal-level").textContent = state.level;

  saveSession({ score: state.score, accuracy, finalLevel: state.level });

  $("results-modal").classList.remove("hidden");
}

// ── Init ──────────────────────────────────────────────────────
initHaptic();
FireSystem.init();
setBrainFill(0);

(async () => {
  try {
    const m = await (await fetch("manifest.json")).json();
    if (m.version) $("app-version").textContent = "v" + m.version;
  } catch {}
})();

$("stats-btn").addEventListener("click", () => {
  triggerHaptic();
  openHistoryModal();
});

$("close-history-btn").addEventListener("click", () => {
  triggerHaptic();
  $("history-modal").classList.add("hidden");
});

$("modal-close-btn").addEventListener("click", () => {
  triggerHaptic();
  startSession();
});

$("btn-close-help").addEventListener("click", () => {
  triggerHaptic();
  $("help-modal").classList.add("hidden");
  startSession();
});

$("help-modal").classList.remove("hidden");
