import { FireSystem } from "../shared/fire.js";
import { saveSession } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

// ── DOM ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const container = $("canvas-container");
const instrEl = $("instruction");
const introOverlay = $("intro-overlay");
const brainProgress = document.querySelector(".brain-progress-fill");
const brainFire = document.querySelector(".brain-fire-fill");

// ── Init ─────────────────────────────────────────────────
async function initVersion() {
  try {
    const manifest = await (await fetch("manifest.json")).json();
    if (manifest.version) $("app-version").textContent = "v" + manifest.version;
  } catch (e) {
    console.error("Failed to load manifest version:", e);
  }
}
initVersion();
initHaptic();
FireSystem.init();
setBrainFill(0);

// ── Bounds (recomputed on session start and resize) ───────
const BALL_RADIUS = 16; // half of 32px
let bounds = { xMin: 2, xMax: 98, yMin: 2, yMax: 98 };

function updateBounds() {
  const rect = container.getBoundingClientRect();
  const rx = (BALL_RADIUS / rect.width) * 100;
  const ry = (BALL_RADIUS / rect.height) * 100;
  bounds = { xMin: rx, xMax: 100 - rx, yMin: ry, yMax: 100 - ry };
}

window.addEventListener("resize", updateBounds);

// ── Constants ─────────────────────────────────────────────
const PHASE_DURATION = 30000;
const TOTAL_DURATION = PHASE_DURATION * 3;

// ── State ─────────────────────────────────────────────────
let objects = [];
let animationFrame;
let isAnimating = false;
let sessionActive = false;
let ballCount = 7;
let results = { phase1: 0, phase2: 0, phase3: 0 };
let currentTargets = [];
let expectedClicks = 0;
let correctClicks = 0;
let onVerified = null;
let sessionStartTime = 0;
let fillRafId = null;

// ── Timers ───────────────────────────────────────────────
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

// ── Brain fill ────────────────────────────────────────────
function setBrainFill(progress) {
  const inset = Math.round(88 - progress * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(progress, inset);
}

// ── Fill loop (pauses during verification) ────────────────
let fillPausedTotal = 0;
let fillPauseStart = 0;

function fillTick() {
  if (!sessionActive) return;
  const progress = Math.min((Date.now() - sessionStartTime - fillPausedTotal) / TOTAL_DURATION, 1);
  setBrainFill(progress);
  fillRafId = requestAnimationFrame(fillTick);
}

function startFillLoop() {
  sessionStartTime = Date.now();
  fillPausedTotal = 0;
  fillRafId = requestAnimationFrame(fillTick);
}

function pauseFill() {
  fillPauseStart = Date.now();
  if (fillRafId) { cancelAnimationFrame(fillRafId); fillRafId = null; }
}

function resumeFill() {
  fillPausedTotal += Date.now() - fillPauseStart;
  fillRafId = requestAnimationFrame(fillTick);
}

function stopFillLoop() {
  if (fillRafId) { cancelAnimationFrame(fillRafId); fillRafId = null; }
}

// ── Ball picker ───────────────────────────────────────────
$("balls-minus").addEventListener("click", () => {
  triggerHaptic();
  ballCount = Math.max(3, ballCount - 1);
  $("balls-val").textContent = ballCount;
});

$("balls-plus").addEventListener("click", () => {
  triggerHaptic();
  ballCount = Math.min(15, ballCount + 1);
  $("balls-val").textContent = ballCount;
});

// ── Objects ───────────────────────────────────────────────
function initObjects(count) {
  container.querySelectorAll(".ball").forEach((el) => el.remove());
  objects = [];

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "ball";
    container.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;

    const obj = {
      id: i,
      element: el,
      x: bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin),
      y: bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin),
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      baseSpeed: speed,
    };

    el.addEventListener("click", () => handleBallClick(obj));
    objects.push(obj);
  }
}

function animate() {
  if (!isAnimating) return;

  objects.forEach((obj) => {
    obj.x += obj.dx * 0.4;
    obj.y += obj.dy * 0.4;

    if (obj.x <= bounds.xMin) { obj.x = bounds.xMin; obj.dx *= -1; }
    if (obj.x >= bounds.xMax) { obj.x = bounds.xMax; obj.dx *= -1; }
    if (obj.y <= bounds.yMin) { obj.y = bounds.yMin; obj.dy *= -1; }
    if (obj.y >= bounds.yMax) { obj.y = bounds.yMax; obj.dy *= -1; }

    obj.element.style.left = obj.x + "%";
    obj.element.style.top = obj.y + "%";
  });

  animationFrame = requestAnimationFrame(animate);
}

// ── Shine effect ─────────────────────────────────────────
function shineObjects(objs) {
  objs.forEach((obj) => {
    obj.element.classList.remove("shine", "correct", "wrong");
    void obj.element.offsetWidth;
    obj.element.classList.add("shine");
    setTimeout(() => obj.element.classList.remove("shine"), 1000);
  });
}

// ── Click handling (verification) ────────────────────────
function handleBallClick(obj) {
  if (isAnimating || !sessionActive || expectedClicks <= 0) return;

  if (currentTargets.includes(obj)) {
    triggerHaptic();
    obj.element.classList.add("correct");
    currentTargets = currentTargets.filter((t) => t !== obj);
    expectedClicks--;
    correctClicks++;
  } else {
    triggerHapticError();
    obj.element.classList.add("wrong");
    currentTargets.forEach((t) => t.element.classList.add("correct"));
    expectedClicks = 0;
  }

  if (expectedClicks === 0) {
    const finalCorrect = correctClicks;
    schedule(() => {
      objects.forEach((o) => o.element.classList.remove("correct", "wrong"));
      if (onVerified) onVerified(finalCorrect);
    }, 1500);
  }
}

// ── Verification ─────────────────────────────────────────
function startVerification(targets, prompt, callback) {
  isAnimating = false;
  cancelAnimationFrame(animationFrame);
  pauseFill();
  currentTargets = [...targets];
  expectedClicks = targets.length;
  correctClicks = 0;
  instrEl.textContent = prompt;
  onVerified = callback;
}

// ── Pick random targets (no repeats from excluded set) ────
function pickTargets(count, exclude = []) {
  const pool = objects.filter((o) => !exclude.includes(o));
  const result = [];
  const copy = [...pool];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ── Phase 1: Selective attention ─────────────────────────
// Track 1 highlighted ball for 12 s
function runPhase1() {
  isAnimating = true;
  animate();

  const [target] = pickTargets(1);
  schedule(() => shineObjects([target]), 500);
  instrEl.textContent = "Phase 1 / 3 — Track the shining ball";

  schedule(() => {
    startVerification([target], "Tap the ball you tracked", (got) => {
      results.phase1 = got >= 1 ? 1 : 0;
      runPhase2();
    });
  }, 30000);
}

// ── Phase 2: Attention switching ─────────────────────────
// A new ball flashes every 5 s — follow each flash, track the last one
function runPhase2() {
  resumeFill();
  isAnimating = true;
  animate();
  instrEl.textContent = "Phase 2 / 3 — Follow each flash";

  const SWITCH_INTERVAL = 5000;
  const switches = Math.floor(PHASE_DURATION / SWITCH_INTERVAL); // 6
  // Allow repeats but never flash the same ball twice in a row
  const targets = [];
  let last = null;
  for (let i = 0; i < switches; i++) {
    const pool = objects.filter((o) => o !== last);
    last = pool[Math.floor(Math.random() * pool.length)];
    targets.push(last);
  }
  targets.forEach((t, i) => {
    schedule(() => shineObjects([t]), i * SWITCH_INTERVAL);
  });

  schedule(() => {
    startVerification([targets[targets.length - 1]], "Tap the last flashed ball", (got) => {
      results.phase2 = got >= 1 ? 1 : 0;
      runPhase3();
    });
  }, PHASE_DURATION);
}

// ── Phase 3: Divided attention ────────────────────────────
// Track 3 highlighted balls simultaneously for 12 s
function runPhase3() {
  resumeFill();
  isAnimating = true;
  animate();

  const targets = pickTargets(3);
  shineObjects(targets);
  instrEl.textContent = "Phase 3 / 3 — Track all highlighted balls";

  schedule(() => {
    startVerification(targets, "Tap all highlighted balls", (got) => {
      results.phase3 = got;
      endSession();
    });
  }, 30000);
}

// ── End session ───────────────────────────────────────────
function endSession() {
  sessionActive = false;
  isAnimating = false;
  stopFillLoop();
  setBrainFill(1);
  instrEl.textContent = "";

  const score = results.phase1 + results.phase2 + results.phase3;
  const accuracy = Math.round(((results.phase1 + results.phase2 + results.phase3 / 3) / 3) * 100);
  const eb = parseFloat((ballCount * accuracy / 100).toFixed(1));

  $("modal-eb").textContent = eb;
  $("modal-score").textContent = score + " / 5";
  $("modal-balls").textContent = ballCount;
  $("modal-accuracy").textContent = accuracy + "%";
  $("modal-p1").textContent = results.phase1 ? "✓" : "✗";
  $("modal-p2").textContent = results.phase2 ? "✓" : "✗";
  $("modal-p3").textContent = results.phase3 + " / 3";

  saveSession({ balls: ballCount, accuracy, eb, score, phase1: results.phase1, phase2: results.phase2, phase3: results.phase3 });

  $("results-modal").classList.remove("hidden");
}

// ── Start session ─────────────────────────────────────────
function startSession() {
  clearTimers();
  results = { phase1: 0, phase2: 0, phase3: 0 };
  sessionActive = true;

  introOverlay.style.display = "none";
  instrEl.textContent = "";
  $("results-modal").classList.add("hidden");
  updateBounds();

  initObjects(ballCount);
  startFillLoop();
  runPhase1();
}

// ── Return to intro ───────────────────────────────────────
function showIntro() {
  clearTimers();
  stopFillLoop();
  isAnimating = false;
  cancelAnimationFrame(animationFrame);
  sessionActive = false;
  objects.forEach((o) => o.element.classList.remove("correct", "wrong", "shine"));
  instrEl.textContent = "";
  setBrainFill(0);
  introOverlay.style.display = "";
}

// ── Events ────────────────────────────────────────────────
$("start-btn").addEventListener("click", () => {
  triggerHaptic();
  startSession();
});

$("modal-close-btn").addEventListener("click", () => {
  triggerHaptic();
  $("results-modal").classList.add("hidden");
  showIntro();
});

$("stats-btn").addEventListener("click", () => {
  triggerHaptic();
  openHistoryModal();
});

$("close-history-btn").addEventListener("click", () =>
  $("history-modal").classList.add("hidden"),
);
