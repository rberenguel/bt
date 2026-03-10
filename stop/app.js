// Stop Signal Task — minimal, visual only
// Arrows as stimuli. Triangle (▲) as stop signal.
// F/← = left, J/→ = right. Inhibit response when ▲ appears.

import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import "./faker.js";

const CONFIG = {
  calibTrials: 5, // go-only warmup to measure baseline RT
  totalTrials: 30,
  stopProb: 0.25, // ~25% stop trials
  ssdInit: 250, // initial stop-signal delay (ms)
  ssdStep: 50,
  ssdMin: 50,
  ssdMax: 800,
  deadlineFallback: 1000,
  fixation: 500,
  feedback: 400,
};

// ── State ────────────────────────────────────────────────
let state = fresh();

function fresh() {
  return {
    phase: "calib", // 'calib' | 'main'
    calibIndex: 0,
    calibRts: [],
    deadline: CONFIG.deadlineFallback,
    running: false,
    trialIndex: 0,
    trials: [],
    ssd: CONFIG.ssdInit,
    results: {
      goCorrect: 0,
      goTotal: 0,
      stopCorrect: 0,
      stopTotal: 0,
      rts: [],
    },
    currentTrial: null,
    responded: false,
    stimStart: 0,
  };
}

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

// ── DOM ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const displayArea = $("display-area");
const idleText = $("idle-text");
const stimulusEl = $("stimulus");
const stopSignal = $("stop-signal");
const calibInfo = $("calib-info");
const statusText = $("status-text");
const btnLeft = $("btn-left");
const btnRight = $("btn-right");
const playBtn = $("play-btn");
const resetBtn = $("reset-btn");
const resultsModal = $("results-modal");
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
FireSystem.init();
setBrainFill(0);

// ── Brain / Fire ─────────────────────────────────────────
function setBrainFill(progress) {
  const inset = Math.round(88 - progress * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(progress, inset);
}

// ── Helpers ──────────────────────────────────────────────
function enable(on) {
  btnLeft.disabled = !on;
  btnRight.disabled = !on;
}

function setBorder(type) {
  displayArea.classList.remove("border-correct", "border-wrong");
  if (type) displayArea.classList.add("border-" + type);
}

function showStimulus(dir) {
  idleText.classList.add("hidden");
  stimulusEl.textContent = dir === "left" ? "←" : "→";
  stimulusEl.classList.remove("hidden");
  stopSignal.classList.add("hidden");
}

function clearDisplay() {
  stimulusEl.classList.add("hidden");
  stopSignal.classList.add("hidden");
}

function updateProgress() {
  setBrainFill(state.trialIndex / CONFIG.totalTrials);
}

function generateTrials() {
  const n = CONFIG.totalTrials;
  const nStop = Math.round(n * CONFIG.stopProb);
  const stopSet = new Set();
  while (stopSet.size < nStop) {
    stopSet.add(Math.floor(Math.random() * n));
  }
  return Array.from({ length: n }, (_, i) => ({
    direction: Math.random() < 0.5 ? "left" : "right",
    isStop: stopSet.has(i),
  }));
}

// ── Calibration ───────────────────────────────────────────
function runCalibTrial() {
  if (state.calibIndex >= CONFIG.calibTrials) {
    finishCalib();
    return;
  }

  state.responded = false;
  calibInfo.textContent = `warming up ${state.calibIndex + 1} / ${CONFIG.calibTrials}`;
  calibInfo.classList.remove("hidden");
  setBorder("");
  clearDisplay();
  enable(false);

  const dir = Math.random() < 0.5 ? "left" : "right";
  state.currentTrial = { direction: dir, isStop: false };

  schedule(() => {
    showStimulus(dir);
    state.stimStart = performance.now();
    enable(true);
    schedule(() => {
      if (!state.responded) respondCalib(null);
    }, CONFIG.deadlineFallback);
  }, CONFIG.fixation);
}

function respondCalib(direction) {
  if (state.responded) return;
  state.responded = true;
  clearTimers();
  enable(false);

  const rt = direction !== null ? performance.now() - state.stimStart : null;
  if (rt !== null && direction === state.currentTrial.direction) {
    state.calibRts.push(rt);
    setBorder("correct");
  } else {
    setBorder("wrong");
  }

  clearDisplay();
  state.calibIndex++;
  schedule(() => {
    setBorder("");
    runCalibTrial();
  }, CONFIG.feedback);
}

function finishCalib() {
  if (state.calibRts.length >= 3) {
    const mean =
      state.calibRts.reduce((a, b) => a + b, 0) / state.calibRts.length;
    const variance =
      state.calibRts.reduce((a, b) => a + (b - mean) ** 2, 0) /
      state.calibRts.length;
    state.deadline =
      2 * Math.max(300, Math.round(mean + 2 * Math.sqrt(variance)));
  } else {
    state.deadline = CONFIG.deadlineFallback;
  }
  state.phase = "main";
  state.trials = generateTrials();
  calibInfo.classList.add("hidden");
  runTrial();
}

// ── Trial logic ──────────────────────────────────────────
function runTrial() {
  if (state.trialIndex >= CONFIG.totalTrials) {
    endSession();
    return;
  }

  const trial = state.trials[state.trialIndex];
  state.currentTrial = trial;
  state.responded = false;
  updateProgress();
  statusText.textContent = "";
  setBorder("");
  clearDisplay();
  enable(false);

  schedule(() => {
    showStimulus(trial.direction);
    state.stimStart = performance.now();
    enable(true);

    if (trial.isStop) {
      schedule(() => stopSignal.classList.remove("hidden"), state.ssd);
    }

    schedule(() => {
      if (!state.responded) respond(null);
    }, state.deadline);
  }, CONFIG.fixation);
}

function respond(direction) {
  if (state.responded) return;
  state.responded = true;
  clearTimers();
  enable(false);

  const rt = direction !== null ? performance.now() - state.stimStart : null;
  const { isStop, direction: correct } = state.currentTrial;

  if (isStop) {
    state.results.stopTotal++;
    if (direction === null) {
      state.results.stopCorrect++;
      state.ssd = Math.min(CONFIG.ssdMax, state.ssd + CONFIG.ssdStep);
      setBorder("correct");
      statusText.textContent = "stopped";
    } else {
      state.ssd = Math.max(CONFIG.ssdMin, state.ssd - CONFIG.ssdStep);
      setBorder("wrong");
      statusText.textContent = "should have stopped";
    }
  } else {
    state.results.goTotal++;
    if (direction === null) {
      setBorder("wrong");
      statusText.textContent = "too slow";
    } else if (direction === correct) {
      state.results.goCorrect++;
      state.results.rts.push(rt);
      setBorder("correct");
      statusText.textContent = "";
    } else {
      setBorder("wrong");
      statusText.textContent = "wrong side";
    }
  }

  clearDisplay();
  state.trialIndex++;
  schedule(() => {
    setBorder("");
    runTrial();
  }, CONFIG.feedback);
}

// ── Session control ──────────────────────────────────────
function dispatch(direction) {
  if (state.phase === "calib") respondCalib(direction);
  else respond(direction);
}

function startSession() {
  state = fresh();
  state.running = true;
  playBtn.disabled = true;
  idleText.classList.add("hidden");
  runCalibTrial();
}

function resetSession() {
  clearTimers();
  state = fresh();
  enable(false);
  clearDisplay();
  idleText.classList.remove("hidden");
  setBorder("");
  calibInfo.classList.add("hidden");
  setBrainFill(0);
  statusText.textContent = "";
  playBtn.disabled = false;
  resultsModal.classList.add("hidden");
}

function endSession() {
  state.running = false;
  enable(false);
  clearDisplay();
  playBtn.disabled = false;

  const r = state.results;
  const pct = (c, t) => (t ? Math.round((c / t) * 100) + "%" : "—");
  const avgRt = r.rts.length
    ? Math.round(r.rts.reduce((a, b) => a + b, 0) / r.rts.length)
    : null;

  $("modal-go-acc").textContent = pct(r.goCorrect, r.goTotal);
  $("modal-stop-acc").textContent = pct(r.stopCorrect, r.stopTotal);
  $("modal-rt").textContent = avgRt !== null ? avgRt + "ms" : "—";
  $("modal-ssd").textContent = state.ssd + "ms";
  $("modal-deadline").textContent = state.deadline + "ms";

  // Persist
  saveSession({
    goAcc: r.goTotal ? Math.round((r.goCorrect / r.goTotal) * 100) : 0,
    stopAcc: r.stopTotal ? Math.round((r.stopCorrect / r.stopTotal) * 100) : 0,
    avgRt: avgRt ?? 0,
    ssd: state.ssd,
  });

  setBrainFill(1);
  resultsModal.classList.remove("hidden");
}

// ── Events ───────────────────────────────────────────────
playBtn.addEventListener("click", startSession);
resetBtn.addEventListener("click", resetSession);
$("modal-close-btn").addEventListener("click", resetSession);
$("stats-btn").addEventListener("click", openHistoryModal);
$("close-history-btn").addEventListener("click", () =>
  $("history-modal").classList.add("hidden"),
);

btnLeft.addEventListener("pointerdown", () => {
  if (!btnLeft.disabled) {
    btnLeft.classList.add("pressed");
    dispatch("left");
  }
});
btnRight.addEventListener("pointerdown", () => {
  if (!btnRight.disabled) {
    btnRight.classList.add("pressed");
    dispatch("right");
  }
});
document.addEventListener("pointerup", () => {
  btnLeft.classList.remove("pressed");
  btnRight.classList.remove("pressed");
});

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (
    (e.key === "f" || e.key === "F" || e.key === "ArrowLeft") &&
    !btnLeft.disabled
  ) {
    btnLeft.classList.add("pressed");
    dispatch("left");
  }
  if (
    (e.key === "j" || e.key === "J" || e.key === "ArrowRight") &&
    !btnRight.disabled
  ) {
    btnRight.classList.add("pressed");
    dispatch("right");
  }
});

document.addEventListener("keyup", () => {
  btnLeft.classList.remove("pressed");
  btnRight.classList.remove("pressed");
});
