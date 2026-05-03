import { FireSystem } from "../shared/fire.js";
import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import { makeStorage } from "../shared/storage.js";
import { makeHistoryUI } from "../shared/history.js";

const SESSION_MS = 90_000;
const WORD_LENGTHS = [5, 6];
const POOL_SIZE = 7;
const MIN_SOLUTIONS = 6;
const MAX_ANSWER = 6;
const TILE_GAP = 8;

const storage = makeStorage("graner_history");
const { open: openHistory } = makeHistoryUI({
  getHistory: () => storage.getHistory(),
  metricDefs: [
    { key: "words", label: "Words", unit: "", invertColor: false },
    { key: "possible", label: "Possible", unit: "", invertColor: false },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

// ── State ──────────────────────────────────────────────────
let dict = {};
let poolTiles = []; // [{ id, char }]
let answerIds = []; // tile ids in answer zone, in order
let solutions = new Set();
let found = new Set();
let sessionTimer = null;
let sessionActive = false;
let animating = false;

const $ = (id) => document.getElementById(id);

const elBattery = $("battery-icon");
const elTimerBar = $("timer-bar");
const elPool = $("zone-pool");
const elAnswer = $("zone-answer");
const elFoundWords = $("found-words");
const elWordCount = $("word-count");
const elClearBtn = $("btn-clear");

// ── Brain fill ─────────────────────────────────────────────
function updateBrainFill() {
  const ratio =
    solutions.size > 0 ? Math.min(1, found.size / solutions.size) : 0;
  const inset = 88 - ratio * 80;
  elBattery.style.setProperty("--progress-inset", `${inset}%`);
  elBattery.style.setProperty("--fire-inset", `${inset}%`);
  FireSystem.update(ratio, inset);
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
  elTimerBar.style.transition = "none";
  elTimerBar.style.width = "100%";
  elTimerBar.style.backgroundColor = "var(--color-blue)";
  void elTimerBar.offsetWidth;
  elTimerBar.style.transition = `width ${SESSION_MS}ms linear, background-color ${SESSION_MS}ms ease-in`;
  elTimerBar.style.width = "0%";
  elTimerBar.style.backgroundColor = "#ef4444";
  sessionTimer = setTimeout(endSession, SESSION_MS);
}

function stopTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = null;
  elTimerBar.style.transition = "none";
}

// ── Solver ─────────────────────────────────────────────────
function getCombos(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...getCombos(tail, k - 1).map((c) => [head, ...c]),
    ...getCombos(tail, k),
  ];
}

function solve(chars) {
  const sols = new Set();
  for (const k of WORD_LENGTHS) {
    for (const combo of getCombos(chars, k)) {
      const key = [...combo].sort().join("");
      dict[key]?.forEach((w) => sols.add(w));
    }
  }
  return sols;
}

// ── Pool generation ────────────────────────────────────────
function generatePool() {
  const extras = POOL_SIZE - 5; // letters added to the 5-letter base
  const baseKeys = Object.keys(dict).filter((k) => k.length === 5);
  const vowels = ["a", "e", "i", "o", "u"];
  const alpha = "eariotnslcudpmhgbfywkvxzjq";
  let best = { chars: null, sols: new Set() };

  for (let i = 0; i < 300; i++) {
    const chars = baseKeys[Math.floor(Math.random() * baseKeys.length)].split("");
    const vowelCount = chars.filter((c) => vowels.includes(c)).length;
    const wantVowels = Math.min(extras, Math.max(0, 2 - vowelCount));
    for (let j = 0; j < wantVowels; j++)
      chars.push(vowels[Math.floor(Math.random() * 5)]);
    for (let j = wantVowels; j < extras; j++)
      chars.push(alpha[Math.floor(Math.random() * alpha.length)]);

    const sols = solve(chars);
    if (sols.size >= MIN_SOLUTIONS) return { chars, sols };
    if (sols.size > best.sols.size) best = { chars: [...chars], sols };
  }
  return best;
}

// ── Tile calibration ───────────────────────────────────────
function calibrateTiles() {
  if (!poolTiles.length) return;
  const poolWidth = elPool.getBoundingClientRect().width;
  if (!poolWidth) return;
  const cols = POOL_SIZE;
  const size = Math.floor((poolWidth - (cols - 1) * TILE_GAP) / cols);
  document.documentElement.style.setProperty("--tile-size", size + "px");
}

// ── Render ─────────────────────────────────────────────────
function renderPool() {
  elPool.innerHTML = "";
  poolTiles.forEach((tile) => {
    const used = answerIds.includes(tile.id);
    const btn = document.createElement("button");
    btn.className = "tile" + (used ? " tile-used" : "");
    btn.textContent = tile.char.toUpperCase();
    btn.dataset.id = tile.id;
    if (!used) btn.addEventListener("click", () => handlePoolTap(tile.id));
    elPool.appendChild(btn);
  });
}

function renderAnswer() {
  elAnswer.innerHTML = "";
  if (answerIds.length === 0) {
    const hint = document.createElement("span");
    hint.className = "answer-hint";
    hint.textContent = "tap letters to build a word";
    elAnswer.appendChild(hint);
  } else {
    answerIds.forEach((id) => {
      const tile = poolTiles.find((t) => t.id === id);
      const btn = document.createElement("button");
      btn.className = "tile tile-answer";
      btn.textContent = tile.char.toUpperCase();
      btn.dataset.id = id;
      btn.addEventListener("click", () => handleAnswerTap(id));
      elAnswer.appendChild(btn);
    });
  }
}

function renderWordCount() {
  elWordCount.textContent = `${found.size} / ${solutions.size}`;
}

// ── Interaction ────────────────────────────────────────────
function handlePoolTap(id) {
  if (!sessionActive || animating) return;
  if (answerIds.includes(id) || answerIds.length >= MAX_ANSWER) return;
  triggerHaptic();
  answerIds.push(id);
  renderPool();
  renderAnswer();

  if (WORD_LENGTHS.includes(answerIds.length)) {
    const word = answerIds
      .map((tid) => poolTiles.find((t) => t.id === tid).char)
      .join("")
      .toLowerCase();
    if (found.has(word)) {
      const hasLonger = [...solutions].some(
        (s) => s.length > word.length && s.startsWith(word)
      );
      if (hasLonger) return;
      flashAnswer("already");
    } else if (solutions.has(word)) {
      found.add(word);
      addFoundWord(word);
      renderWordCount();
      updateBrainFill();
      flashAnswer("correct");
    }
  }
}

function handleAnswerTap(id) {
  if (!sessionActive || animating) return;
  triggerHaptic();
  answerIds = answerIds.filter((x) => x !== id);
  renderPool();
  renderAnswer();
}

function handleClear() {
  if (!sessionActive || animating) return;
  triggerHaptic();
  answerIds = [];
  renderPool();
  renderAnswer();
}


function flashAnswer(type) {
  animating = true;
  elAnswer.classList.add("flash-" + type);

  setTimeout(() => {
    elAnswer.classList.remove("flash-correct", "flash-wrong", "flash-already");
    answerIds = [];
    animating = false;
    renderPool();
    renderAnswer();
  }, 450);
}

function addFoundWord(word) {
  const tag = document.createElement("div");
  tag.className = "word-tag";
  tag.textContent = word.toUpperCase();
  elFoundWords.prepend(tag);
}

// ── Session lifecycle ──────────────────────────────────────
function buildAndStartSession() {
  found.clear();
  answerIds = [];
  animating = false;
  elFoundWords.innerHTML = "";

  const { chars, sols } = generatePool();
  solutions = sols;
  poolTiles = chars.map((c, i) => ({ id: "t" + i, char: c }));
  poolTiles.sort(() => Math.random() - 0.5);

  renderPool();
  renderAnswer();
  renderWordCount();
  updateBrainFill();
  requestAnimationFrame(calibrateTiles);

  sessionActive = true;
  startTimer();
}

function endSession() {
  sessionActive = false;
  stopTimer();
  animating = false;

  $("modal-words").textContent = found.size;
  $("modal-possible").textContent = solutions.size;
  $("modal-pct").textContent =
    solutions.size > 0 ? Math.round((found.size / solutions.size) * 100) : 0;

  const missed = [...solutions].filter((w) => !found.has(w)).sort();
  const missedContainer = $("modal-missed");
  missedContainer.innerHTML = "";
  if (missed.length > 0) {
    missed.forEach((w) => {
      const tag = document.createElement("a");
      tag.className = "missed-word-tag";
      tag.textContent = w.toUpperCase();
      tag.href = `https://en.wiktionary.org/wiki/${encodeURIComponent(w.toLowerCase())}`;
      tag.target = "_blank";
      tag.rel = "noopener noreferrer";
      missedContainer.appendChild(tag);
    });
    $("modal-missed-section").classList.remove("hidden");
  } else {
    $("modal-missed-section").classList.add("hidden");
  }

  storage.save({
    timestamp: Date.now(),
    dateStr: new Date().toISOString().split("T")[0],
    metrics: { words: found.size, possible: solutions.size },
  });

  setTimeout(() => {
    $("results-modal").classList.remove("hidden");
  }, 300);
}

// ── Init ───────────────────────────────────────────────────
async function initVersion() {
  try {
    const m = await fetch("manifest.json").then((r) => r.json());
    if (m.version) {
      $("app-version").textContent = "v" + m.version;
      const vi = $("app-version-intro");
      if (vi) vi.textContent = "v" + m.version;
    }
  } catch {}
}

async function init() {
  initHaptic();
  FireSystem.init();
  initVersion();
  updateBrainFill();

  try {
    dict = await fetch("dict/dictionary.json").then((r) => r.json());
  } catch {
    document.body.innerHTML =
      '<p style="padding:2rem;color:#ef4444">Error: could not load dictionary.</p>';
    return;
  }

  $("intro").classList.add("visible");
}

window.addEventListener("resize", calibrateTiles);

// ── Events ─────────────────────────────────────────────────
$("play-btn").addEventListener("click", () => {
  triggerHaptic();
  $("intro").classList.remove("visible");
  $("game-area").style.display = "flex";
  buildAndStartSession();
});

elClearBtn.addEventListener("click", handleClear);

$("modal-play-again").addEventListener("click", () => {
  triggerHaptic();
  $("results-modal").classList.add("hidden");
  buildAndStartSession();
});

$("stats-btn").addEventListener("click", () => {
  openHistory();
});

$("close-history-btn").addEventListener("click", () => {
  triggerHaptic();
  $("history-modal").classList.add("hidden");
});

init();
