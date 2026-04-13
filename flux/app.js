import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";

// ── Word corpus ───────────────────────────────────────────
const CATEGORY_PAIRS = [
  {
    id: "living-nonliving",
    leftLabel: "Living",
    rightLabel: "Non-living",
    left: [
      "wolf",
      "fern",
      "moss",
      "coral",
      "moth",
      "oak",
      "crow",
      "wasp",
      "lynx",
      "sage",
      "toad",
      "eel",
      "gull",
      "carp",
      "bear",
      "fox",
      "rose",
      "bee",
      "hawk",
      "deer",
    ],
    right: [
      "flint",
      "quartz",
      "ember",
      "frost",
      "slate",
      "chalk",
      "steam",
      "cinder",
      "bronze",
      "shale",
      "cobalt",
      "sulfur",
      "obsidian",
      "ash",
      "clay",
      "iron",
      "stone",
      "ice",
      "sand",
      "coal",
    ],
  },
  {
    id: "animal-plant",
    leftLabel: "Animal",
    rightLabel: "Plant",
    left: [
      "wolf",
      "crane",
      "moth",
      "salmon",
      "wasp",
      "lynx",
      "crow",
      "toad",
      "mink",
      "wren",
      "hawk",
      "deer",
      "bear",
      "fox",
      "owl",
      "bat",
      "bee",
      "eel",
      "trout",
      "carp",
    ],
    right: [
      "fern",
      "moss",
      "oak",
      "sage",
      "reed",
      "willow",
      "cedar",
      "birch",
      "thyme",
      "nettle",
      "rose",
      "ivy",
      "pine",
      "fir",
      "elm",
      "ash",
      "bay",
      "mint",
      "basil",
      "olive",
    ],
  },
  {
    id: "edible-toxic",
    leftLabel: "Edible",
    rightLabel: "Toxic",
    left: [
      "rice",
      "bread",
      "wheat",
      "corn",
      "oat",
      "rye",
      "bean",
      "apple",
      "honey",
      "milk",
      "grape",
      "fig",
      "olive",
      "garlic",
      "onion",
      "mushroom",
      "potato",
      "carrot",
      "walnut",
      "egg",
    ],
    right: [
      "arsenic",
      "cyanide",
      "mercury",
      "asbestos",
      "radon",
      "bleach",
      "lead",
      "venom",
      "hemlock",
      "methanol",
      "chlorine",
      "ammonia",
      "plutonium",
      "anthrax",
      "ricin",
      "thallium",
      "polonium",
      "strychnine",
      "cadmium",
      "dioxin",
    ],
  },
  {
    id: "natural-synthetic",
    leftLabel: "Natural",
    rightLabel: "Synthetic",
    left: [
      "granite",
      "amber",
      "ivory",
      "silk",
      "wool",
      "coral",
      "bone",
      "flint",
      "cedar",
      "basalt",
      "quartz",
      "clay",
      "peat",
      "charcoal",
      "marble",
      "linen",
      "cotton",
      "leather",
      "wax",
      "obsidian",
    ],
    right: [
      "nylon",
      "kevlar",
      "acrylic",
      "polyester",
      "neoprene",
      "teflon",
      "rayon",
      "spandex",
      "vinyl",
      "silicone",
      "mylar",
      "cellophane",
      "styrene",
      "plexiglass",
      "lycra",
      "bakelite",
      "epoxy",
      "fiberglass",
      "polystyrene",
      "formica",
    ],
  },
  {
    id: "process-artifact",
    leftLabel: "Process",
    rightLabel: "Artifact",
    left: [
      "daemon",
      "worker",
      "thread",
      "handler",
      "broker",
      "proxy",
      "router",
      "crawler",
      "watcher",
      "monitor",
      "listener",
      "poller",
      "scanner",
      "sender",
      "loader",
      "runner",
      "parser",
      "sweeper",
      "reaper",
      "emitter",
    ],
    right: [
      "blob",
      "log",
      "hash",
      "index",
      "config",
      "token",
      "trace",
      "shard",
      "record",
      "metric",
      "chunk",
      "schema",
      "digest",
      "buffer",
      "cert",
      "flag",
      "archive",
      "doc",
      "spec",
      "ledger",
    ],
  },
  {
    id: "concrete-abstract",
    leftLabel: "Concrete",
    rightLabel: "Abstract",
    left: [
      "hammer",
      "stone",
      "bridge",
      "ladder",
      "wheel",
      "rope",
      "barrel",
      "anvil",
      "lens",
      "needle",
      "spring",
      "wedge",
      "lever",
      "bolt",
      "chain",
      "hook",
      "ring",
      "gear",
      "plank",
      "brick",
    ],
    right: [
      "truth",
      "logic",
      "time",
      "freedom",
      "justice",
      "chaos",
      "entropy",
      "reason",
      "faith",
      "doubt",
      "pride",
      "grief",
      "hope",
      "fear",
      "duty",
      "grace",
      "will",
      "fate",
      "void",
      "flux",
    ],
  },
];

const COLORS = [
  { id: "neutral", css: "#e2e8f0" },
  { id: "amber", css: "#f59e0b" },
  { id: "cyan", css: "#22d3ee" },
];

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  baselineTrials: 10,
  pmTrials: 30,
  fixation: 500,
  feedback: 350,
  deadlineFallback: 1600,
  kDeadlineInit: 3.5, // generous start — narrows on correct streaks
  kDeadlineMin: 2.0,
  kDeadlineStep: 0.15, // tighten per correct non-target trial
  kDeadlineRelax: 0.3, // loosen per miss or wrong
};

// Level: targetRate only; rule type is set by generateRules
const LEVEL_CONFIG = [
  { targetRate: 0.15 }, // 1 — focal
  { targetRate: 0.15 }, // 2 — non-focal color
  { targetRate: 0.15 }, // 3 — 1 focal + 1 color
  { targetRate: 0.12 }, // 4 — 2 color
  { targetRate: 0.1 }, // 5 — 1 focal + 2 color
];

// ── State ─────────────────────────────────────────────────
let state = fresh();

function fresh() {
  return {
    phase: "idle",
    categoryPair: null,
    baselineIndex: 0,
    baselineRts: [],
    baselineMean: CONFIG.deadlineFallback,
    deadline: CONFIG.deadlineFallback,
    level: 1,
    rules: [],
    intentionIndex: 0,
    trials: [],
    trialIndex: 0,
    currentTrial: null,
    responded: false,
    stimStart: 0,
    kDeadline: CONFIG.kDeadlineInit,
    pmHits: 0,
    pmTargetTotal: 0,
    falseAlarms: 0,
    nonTargetTotal: 0,
    allMisses: 0,
    pmBlockRts: [],
  };
}

// ── Timers ────────────────────────────────────────────────
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
const brainProgress = document.querySelector(".brain-progress-fill");
const brainFire = document.querySelector(".brain-fire-fill");

// ── Brain/fire ────────────────────────────────────────────
function setBrainFill(progress) {
  const inset = Math.round(88 - progress * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(progress, inset);
}

function updateProgress() {
  const total = CONFIG.baselineTrials + CONFIG.pmTrials;
  let done = 0;
  if (state.phase === "baseline") done = state.baselineIndex;
  else if (state.phase === "pm")
    done = CONFIG.baselineTrials + state.trialIndex;
  else if (state.phase === "done") done = total;
  setBrainFill(done / total);
}

// ── Category pair helpers ─────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function selectCategoryPair(history) {
  const lastId =
    history.length > 0 ? history[history.length - 1].metrics.pairId : null;
  const candidates = CATEGORY_PAIRS.filter((p) => p.id !== lastId);
  return pick(candidates.length > 0 ? candidates : CATEGORY_PAIRS);
}

function applyZoneLabels(pair) {
  $("zone-left-label").textContent = pair.leftLabel;
  $("zone-right-label").textContent = pair.rightLabel;
}

// ── Rule generation ───────────────────────────────────────
function generateRules(level, pair) {
  const allWords = [...pair.left, ...pair.right];

  const focalRule = () => {
    const word = pick(allWords);
    return { type: "focal", word, text: `Tap center if you see "${word}"` };
  };
  const colorRule = (colorId) => ({
    type: "color",
    colorId,
    text: `Tap center if anything is ${colorId}`,
  });

  switch (level) {
    case 1:
      return [focalRule()];
    case 2:
      return [colorRule(pick(["amber", "cyan"]))];
    case 3:
      return [focalRule(), colorRule(pick(["amber", "cyan"]))];
    case 4:
      return [colorRule("amber"), colorRule("cyan")];
    case 5:
      return [focalRule(), colorRule("amber"), colorRule("cyan")];
    default:
      return [focalRule()];
  }
}

// ── Stimulus helpers ──────────────────────────────────────
function matchesRule(rule, stim) {
  if (rule.type === "focal") return stim.word === rule.word;
  if (rule.type === "color") return stim.colorId === rule.colorId;
  return false;
}

function stimIsTarget(rules, stim) {
  return rules.some((r) => matchesRule(r, stim));
}

function randomStim(pair) {
  const side = Math.random() < 0.5 ? "left" : "right";
  return { word: pick(pair[side]), side, colorId: pick(COLORS).id };
}

function generateStim(rules, forTarget, pair) {
  for (let i = 0; i < 50; i++) {
    const s = randomStim(pair);
    if (stimIsTarget(rules, s) === forTarget) return s;
  }
  // Fallback
  if (forTarget) {
    const rule = rules[0];
    if (rule.type === "focal") {
      const side = pair.left.includes(rule.word) ? "left" : "right";
      return { word: rule.word, side, colorId: "neutral" };
    }
    return { word: pick(pair.left), side: "left", colorId: rule.colorId };
  }
  // Non-target fallback: neutral word that matches no rule
  for (const word of [...pair.left, ...pair.right]) {
    const side = pair.left.includes(word) ? "left" : "right";
    const s = { word, side, colorId: "neutral" };
    if (!stimIsTarget(rules, s)) return s;
  }
  return { word: pair.left[0], side: "left", colorId: "neutral" };
}

function generatePmTrials(rules, level, pair) {
  const total = CONFIG.pmTrials;
  const targetCount = Math.max(
    3,
    Math.round(total * LEVEL_CONFIG[level - 1].targetRate),
  );

  const usable = Array.from({ length: total - 4 }, (_, i) => i + 2);
  const segSize = Math.floor(usable.length / targetCount);
  const targetSet = new Set();
  for (let i = 0; i < targetCount; i++) {
    const start = i * segSize;
    const end = Math.min(start + segSize, usable.length);
    targetSet.add(usable[start + Math.floor(Math.random() * (end - start))]);
  }

  return Array.from({ length: total }, (_, i) => {
    const isTgt = targetSet.has(i);
    return { isTarget: isTgt, stim: generateStim(rules, isTgt, pair) };
  });
}

// ── Display helpers ───────────────────────────────────────
function showStim(stim) {
  const el = $("stimulus-word");
  const color = COLORS.find((c) => c.id === stim.colorId);
  el.textContent = stim.word;
  el.style.color = color.css;
  el.classList.remove("hidden");
  $("idle-text").classList.add("hidden");
}

function clearStim() {
  $("stimulus-word").classList.add("hidden");
}

function startDeadlineBar(ms) {
  const bar = $("deadline-bar");
  const wrap = $("deadline-bar-wrap");
  wrap.classList.remove("hidden");
  bar.style.transition = "none";
  bar.style.width = "100%";
  bar.style.backgroundColor = "var(--color-accent)";
  void bar.offsetWidth;
  bar.style.transition = `width ${ms}ms linear, background-color ${ms * 0.5}ms ${ms * 0.5}ms ease-in`;
  bar.style.width = "0%";
  bar.style.backgroundColor = "var(--color-red)";
}

function stopDeadlineBar() {
  $("deadline-bar").style.transition = "none";
  $("deadline-bar-wrap").classList.add("hidden");
}

function enableZones(left, center, right) {
  $("zone-left").disabled = !left;
  $("zone-center").disabled = !center;
  $("zone-right").disabled = !right;
}

function setBorder(type) {
  const da = $("display-area");
  da.classList.remove("border-correct", "border-wrong");
  if (type) da.classList.add("border-" + type);
}

// ── Session preload ───────────────────────────────────────
function preloadSession() {
  $("play-btn").disabled = true;
  getHistory().then((history) => {
    state.categoryPair = selectCategoryPair(history);
    state.level = computeNextLevel(history);
    applyZoneLabels(state.categoryPair);
    updateIdleRule(state.categoryPair);
    $("play-btn").disabled = false;
  });
}

function updateIdleRule(pair) {
  $("idle-text").innerHTML =
    `<p class="rule-main">${pair.leftLabel} ←&nbsp;&nbsp;&nbsp;→ ${pair.rightLabel}</p>` +
    `<p class="sub">Classify each word left or right.</p>` +
    `<p class="sub">After warmup, you lock in a secret trigger.<br>When it appears — tap center instead.</p>`;
}

function computeNextLevel(history) {
  if (history.length === 0) return 1;
  const last = history[history.length - 1];
  const level = last.metrics.level || 1;
  const hit = last.metrics.pmHitRate;
  const fa = last.metrics.falseAlarmRate;
  if (hit >= 80 && fa < 20) return Math.min(5, level + 1);
  if (hit < 40) return Math.max(1, level - 1);
  return level;
}

// ── Baseline ──────────────────────────────────────────────
function startBaseline() {
  state.phase = "baseline";
  appContainer.classList.add("playing");
  runBaselineTrial();
}

function runBaselineTrial() {
  if (state.baselineIndex >= CONFIG.baselineTrials) {
    finishBaseline();
    return;
  }

  state.responded = false;
  setBorder(null);
  clearStim();
  stopDeadlineBar();
  enableZones(false, false, false);
  $("phase-label").textContent =
    `warming up — ${state.baselineIndex + 1} / ${CONFIG.baselineTrials}`;
  $("phase-label").classList.remove("hidden");
  $("status-text").textContent = "";
  updateProgress();

  const stim = randomStim(state.categoryPair);
  state.currentTrial = { stim, isTarget: false };

  schedule(() => {
    showStim(stim);
    state.stimStart = performance.now();
    startDeadlineBar(CONFIG.deadlineFallback);
    enableZones(true, false, true);

    schedule(() => {
      if (!state.responded) respondBaseline(null);
    }, CONFIG.deadlineFallback);
  }, CONFIG.fixation);
}

function respondBaseline(zone) {
  if (state.responded) return;
  state.responded = true;
  clearTimers();
  enableZones(false, false, false);
  stopDeadlineBar();
  clearStim();

  const rt = zone !== null ? performance.now() - state.stimStart : null;

  if (rt !== null && zone === state.currentTrial.stim.side) {
    state.baselineRts.push(rt);
    setBorder("correct");
    triggerHaptic();
  } else {
    setBorder("wrong");
    if (zone !== null) triggerHapticError();
  }

  state.baselineIndex++;
  schedule(() => {
    setBorder(null);
    runBaselineTrial();
  }, CONFIG.feedback);
}

function finishBaseline() {
  const rts = state.baselineRts;
  if (rts.length >= 3) {
    const mean = rts.reduce((a, b) => a + b, 0) / rts.length;
    const variance = rts.reduce((a, b) => a + (b - mean) ** 2, 0) / rts.length;
    const sd = Math.sqrt(variance);
    state.baselineMean = Math.round(mean);
    state.deadline = Math.max(600, Math.round(mean + state.kDeadline * sd));
  } else {
    state.baselineMean = CONFIG.deadlineFallback;
    state.deadline = CONFIG.deadlineFallback;
  }

  $("phase-label").classList.add("hidden");
  setBorder(null);
  enableZones(false, false, false);

  state.rules = generateRules(state.level, state.categoryPair);
  startIntention();
}

// ── Intention screen ──────────────────────────────────────
function startIntention() {
  state.phase = "intention";
  state.intentionIndex = 0;
  showIntentionRule();
}

function showIntentionRule() {
  const rule = state.rules[state.intentionIndex];
  const total = state.rules.length;
  $("intention-rules").innerHTML =
    `<div class="intention-rule">${rule.text}</div>`;
  $("intention-progress").textContent =
    total > 1 ? `Rule ${state.intentionIndex + 1} of ${total}` : "";
  $("intention-confirm-btn").textContent =
    state.intentionIndex < total - 1 ? "Got it →" : "Start";
  $("intention-modal").classList.remove("hidden");
}

// ── PM block ──────────────────────────────────────────────
function startPmBlock() {
  state.phase = "pm";
  state.trialIndex = 0;
  state.trials = generatePmTrials(state.rules, state.level, state.categoryPair);
  $("intention-modal").classList.add("hidden");
  runPmTrial();
}

function runPmTrial() {
  if (state.trialIndex >= CONFIG.pmTrials) {
    endSession();
    return;
  }

  state.responded = false;
  setBorder(null);
  clearStim();
  stopDeadlineBar();
  enableZones(false, false, false);
  $("status-text").textContent = "";
  updateProgress();

  const trial = state.trials[state.trialIndex];
  state.currentTrial = trial;

  schedule(() => {
    showStim(trial.stim);
    state.stimStart = performance.now();
    startDeadlineBar(state.deadline);
    enableZones(true, true, true);

    schedule(() => {
      if (!state.responded) respondPm(null);
    }, state.deadline);
  }, CONFIG.fixation);
}

function respondPm(zone) {
  if (state.responded) return;
  state.responded = true;
  clearTimers();
  enableZones(false, false, false);
  stopDeadlineBar();
  clearStim();

  const rt = zone !== null ? performance.now() - state.stimStart : null;
  const { stim, isTarget } = state.currentTrial;
  const correctZone = isTarget ? "center" : stim.side;

  if (isTarget) {
    state.pmTargetTotal++;
    if (zone === "center") {
      state.pmHits++;
      setBorder("correct");
      triggerHaptic();
    } else if (zone === null) {
      state.allMisses++;
      setBorder("wrong");
      $("status-text").textContent = "missed it";
    } else {
      setBorder("wrong");
      triggerHapticError();
      $("status-text").textContent = "should be center";
    }
  } else {
    state.nonTargetTotal++;
    if (zone === "center") {
      state.falseAlarms++;
      setBorder("wrong");
      triggerHapticError();
      $("status-text").textContent = "false alarm";
      const zc = $("zone-center");
      zc.classList.add("flash-wrong");
      setTimeout(() => zc.classList.remove("flash-wrong"), 300);
    } else if (zone === null) {
      state.allMisses++;
      setBorder("wrong");
      $("status-text").textContent = "too slow";
    } else if (zone === correctZone) {
      if (rt !== null) state.pmBlockRts.push(rt);
      setBorder("correct");
      triggerHaptic();
    } else {
      setBorder("wrong");
      triggerHapticError();
      $("status-text").textContent = "wrong side";
    }
  }

  // Adapt deadline: tighten on clean non-target hits, relax on misses/errors
  if (!isTarget && zone === correctZone) {
    state.kDeadline = Math.max(
      CONFIG.kDeadlineMin,
      state.kDeadline - CONFIG.kDeadlineStep,
    );
  } else if (zone === null || (zone !== null && zone !== correctZone)) {
    state.kDeadline = Math.min(
      CONFIG.kDeadlineInit,
      state.kDeadline + CONFIG.kDeadlineRelax,
    );
  }
  const rts = state.baselineRts;
  if (rts.length >= 3) {
    const mean = state.baselineMean;
    const variance = rts.reduce((a, b) => a + (b - mean) ** 2, 0) / rts.length;
    state.deadline = Math.max(
      600,
      Math.round(mean + state.kDeadline * Math.sqrt(variance)),
    );
  }

  state.trialIndex++;
  schedule(() => {
    setBorder(null);
    runPmTrial();
  }, CONFIG.feedback);
}

// ── Session end ───────────────────────────────────────────
function endSession() {
  state.phase = "done";
  enableZones(false, false, false);
  setBrainFill(1);
  $("play-btn").disabled = false;

  const pmHitRate =
    state.pmTargetTotal > 0
      ? Math.round((state.pmHits / state.pmTargetTotal) * 100)
      : 0;
  const falseAlarmRate =
    state.nonTargetTotal > 0
      ? Math.round((state.falseAlarms / state.nonTargetTotal) * 100)
      : 0;
  const missRate = Math.round((state.allMisses / CONFIG.pmTrials) * 100);
  const pmMeanRt =
    state.pmBlockRts.length > 0
      ? state.pmBlockRts.reduce((a, b) => a + b, 0) / state.pmBlockRts.length
      : state.baselineMean;
  const rtCost = Math.round(pmMeanRt - state.baselineMean);

  $("modal-targets").textContent = `${state.pmHits} / ${state.pmTargetTotal}`;
  $("modal-hit-rate").textContent = pmHitRate + "%";
  $("modal-fa-rate").textContent = falseAlarmRate + "%";
  $("modal-miss-rate").textContent = missRate + "%";
  $("modal-rt-cost").textContent = (rtCost >= 0 ? "+" : "") + rtCost + " ms";
  $("modal-level").textContent = state.level;
  $("modal-pair").textContent =
    state.categoryPair.leftLabel + " / " + state.categoryPair.rightLabel;
  $("modal-deadline").textContent = state.deadline + " ms";

  saveSession({
    pmHitRate,
    falseAlarmRate,
    missRate,
    rtCost,
    level: state.level,
    intentions: state.rules.length,
    pairId: state.categoryPair.id,
  });

  $("results-modal").classList.remove("hidden");
}

// ── Reset ─────────────────────────────────────────────────
function resetSession() {
  clearTimers();
  $("intention-modal").classList.add("hidden");
  $("results-modal").classList.add("hidden");
  state = fresh();
  setBrainFill(0);
  enableZones(false, false, false);
  clearStim();
  stopDeadlineBar();
  setBorder(null);
  $("idle-text").classList.remove("hidden");
  $("phase-label").classList.add("hidden");
  $("status-text").textContent = "";
  appContainer.classList.remove("playing");
  preloadSession(); // picks next pair, updates idle text, re-enables play
}

// ── Zone events ───────────────────────────────────────────
function handleZoneTap(zone) {
  if (state.phase === "baseline") respondBaseline(zone);
  else if (state.phase === "pm") respondPm(zone);
}

function bindZone(id, zone) {
  const el = $(id);
  el.addEventListener("click", (e) => {
    if (el.disabled) return;
    e.preventDefault();
    el.classList.add("pressed");
    triggerHaptic();
    handleZoneTap(zone);
  });
}

bindZone("zone-left", "left");
bindZone("zone-center", "center");
bindZone("zone-right", "right");

document.addEventListener("pointerup", () => {
  ["zone-left", "zone-center", "zone-right"].forEach((id) =>
    $(id).classList.remove("pressed"),
  );
});

// ── Keyboard support ──────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "f" || e.key === "F" || e.key === "ArrowLeft") {
    if (!$("zone-left").disabled) handleZoneTap("left");
  } else if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    if (!$("zone-center").disabled) handleZoneTap("center");
  } else if (e.key === "j" || e.key === "J" || e.key === "ArrowRight") {
    if (!$("zone-right").disabled) handleZoneTap("right");
  }
});

// ── Controls ──────────────────────────────────────────────
$("play-btn").addEventListener("click", (e) => {
  e.preventDefault();
  if ($("play-btn").disabled) return;
  triggerHaptic();
  $("play-btn").disabled = true;
  startBaseline();
});

$("reset-btn").addEventListener("click", (e) => {
  e.preventDefault();
  triggerHaptic();
  resetSession();
});

$("intention-confirm-btn").addEventListener("click", (e) => {
  e.preventDefault();
  triggerHaptic();
  state.intentionIndex++;
  if (state.intentionIndex < state.rules.length) {
    showIntentionRule();
  } else {
    startPmBlock();
  }
});

$("modal-close-btn").addEventListener("click", (e) => {
  e.preventDefault();
  triggerHaptic();
  resetSession();
});

$("stats-btn").addEventListener("click", () => {
  triggerHaptic();
  openHistoryModal();
});

$("close-history-btn").addEventListener("click", () => {
  triggerHaptic();
  $("history-modal").classList.add("hidden");
});

// ── Init ──────────────────────────────────────────────────
async function initVersion() {
  try {
    const manifest = await (await fetch("manifest.json")).json();
    if (manifest.version) $("app-version").textContent = "v" + manifest.version;
  } catch (_) {}
}

initVersion();
initHaptic();
FireSystem.init();
setBrainFill(0);
preloadSession();
