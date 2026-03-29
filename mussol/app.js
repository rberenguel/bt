import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import { saveSessionRecord, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { injectFakeHistory } from "./faker.js";
import { FireSystem } from "../shared/fire.js";

// --- Config ---
const SESSION_LENGTH = 10;
const QUESTION_TIME_MS = 30000;
const POST_CORRECT_DELAY_MS = 500;
const POST_INCORRECT_DELAY_MS = 2500;
const FADE_DURATION_MS = 300;

// --- State ---
let allQuestions = [];
let sessionCorrect = 0;
let sessionIncorrect = 0;
let sessionAnswered = 0; // correct + incorrect + timed-out
let currentCorrectIndex = -1;
let inputLocked = false;
let timerTimeout = null;

// --- DOM ---
const elVersion = document.getElementById("app-version");
const elBatteryIcon = document.getElementById("battery-icon");
const elTimerBar = document.getElementById("timer-bar");
const elLoader = document.getElementById("loader");
const elQuestionArea = document.getElementById("question-area");
const elQuestionStem = document.getElementById("question-stem");
const elChoices = document.getElementById("choices-container");
const elQuestionCounter = document.getElementById("question-counter");

// --- Brain fill ---
function updateBrainFill() {
  const ratio = sessionAnswered / SESSION_LENGTH;
  const bottom = 88;
  const top = 8;
  const inset = bottom - ratio * (bottom - top);
  elBatteryIcon.style.setProperty("--progress-inset", `${inset}%`);
  elBatteryIcon.style.setProperty("--fire-inset", `${inset}%`);
  FireSystem.update(ratio, inset);
}

// --- Timer ---
function startTimer() {
  clearTimer();

  elTimerBar.style.transition = "none";
  elTimerBar.style.width = "100%";
  elTimerBar.style.backgroundColor = "var(--color-blue)";
  void elTimerBar.offsetWidth;

  elTimerBar.style.transition = `width ${QUESTION_TIME_MS}ms linear, background-color ${QUESTION_TIME_MS}ms ease-in`;
  elTimerBar.style.width = "0%";
  elTimerBar.style.backgroundColor = "#ef4444";

  timerTimeout = setTimeout(handleTimeout, QUESTION_TIME_MS);
}

function clearTimer() {
  if (timerTimeout) clearTimeout(timerTimeout);
  timerTimeout = null;
  elTimerBar.style.transition = "none";
  elTimerBar.style.width = "0%";
}

function handleTimeout() {
  if (inputLocked) return;
  inputLocked = true;
  sessionIncorrect++;
  sessionAnswered++;
  updateBrainFill();
  updateCounter();
  advanceQuestion(POST_CORRECT_DELAY_MS);
}

// --- Counter ---
function updateCounter() {
  elQuestionCounter.textContent = `${sessionAnswered} / ${SESSION_LENGTH}`;
}

// --- Questions ---
const shuffleArray = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

function displayQuestion() {
  if (sessionAnswered >= SESSION_LENGTH) {
    endSession();
    return;
  }

  inputLocked = false;
  elChoices.innerHTML = "";

  const q = allQuestions[Math.floor(Math.random() * allQuestions.length)];
  const correctAnswer = q.choice[q.answer];
  const incorrect = q.choice.filter((_, i) => i !== q.answer);
  shuffleArray(incorrect);
  const finalChoices = [correctAnswer, ...incorrect.slice(0, 3)];
  shuffleArray(finalChoices);
  currentCorrectIndex = finalChoices.findIndex((c) => c === correctAnswer);

  elQuestionStem.innerHTML = `<span class="item-A">${q.stem[0]}</span> is to <span class="item-B">${q.stem[1]}</span> as`;
  console.log(finalChoices);
  finalChoices.forEach((pair, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "choice-wrapper";
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.dataset.index = index;
    btn.innerHTML = `<span class="choice-prefix">${String.fromCharCode(65 + index)}:</span> <span class="item-C">${pair[0]}</span> is to <span class="item-D">${pair[1]}</span>`;
    wrapper.appendChild(btn);
    wrapper.addEventListener("click", () => handleChoice(index, wrapper));
    elChoices.appendChild(wrapper);
  });

  startTimer();
  updateCounter();
}

function handleChoice(selectedIndex, selectedWrapper) {
  if (inputLocked) return;
  inputLocked = true;
  clearTimer();

  const wrappers = elChoices.querySelectorAll(".choice-wrapper");
  wrappers.forEach((w) => w.classList.add("disabled"));

  if (selectedIndex === currentCorrectIndex) {
    sessionCorrect++;
    sessionAnswered++;
    selectedWrapper.classList.add("correct");
    triggerHaptic();
    updateBrainFill();
    updateCounter();
    advanceQuestion(POST_CORRECT_DELAY_MS);
  } else {
    sessionIncorrect++;
    sessionAnswered++;
    selectedWrapper.classList.add("incorrect");
    triggerHapticError();
    updateBrainFill();
    updateCounter();
    advanceQuestion(POST_INCORRECT_DELAY_MS);
  }
}

function advanceQuestion(delay) {
  const total = Math.max(delay, FADE_DURATION_MS);
  const fadeStart = total - FADE_DURATION_MS;

  setTimeout(() => elQuestionArea.classList.add("fading"), fadeStart);

  setTimeout(() => {
    if (sessionAnswered >= SESSION_LENGTH) {
      elQuestionArea.classList.remove("fading");
      endSession();
      return;
    }
    displayQuestion();
    elQuestionArea.classList.remove("fading");
  }, total);
}

function endSession() {
  clearTimer();
  const total = sessionCorrect + sessionIncorrect;
  const accuracy = total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;

  FireSystem.update(1, 8);
  elBatteryIcon.style.setProperty("--progress-inset", "8%");
  elBatteryIcon.style.setProperty("--fire-inset", "8%");

  document.getElementById("modal-correct").textContent = sessionCorrect;
  document.getElementById("modal-incorrect").textContent = sessionIncorrect;
  document.getElementById("modal-total").textContent = SESSION_LENGTH;
  document.getElementById("modal-acc").textContent = accuracy;

  saveSessionRecord({
    correct: sessionCorrect,
    incorrect: sessionIncorrect,
    accuracy,
  });

  setTimeout(() => {
    document.getElementById("results-modal").classList.remove("hidden");
  }, 300);
}

function startNewSession() {
  sessionCorrect = 0;
  sessionIncorrect = 0;
  sessionAnswered = 0;
  inputLocked = false;
  document.getElementById("results-modal").classList.add("hidden");
  updateBrainFill();
  updateCounter();
  displayQuestion();
}

// --- Data loading ---
const parseMarkdownQuestions = (text) => {
  const questions = [];
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  let current = null;

  lines.forEach((line) => {
    line = line.trim();
    if (line.startsWith("#")) {
      if (current) questions.push(current);
      const stem = line.slice(2).trim();
      const parts = stem.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        current = {
          stem: [parts[0], parts[1]],
          choice: [],
          answer: -1,
          source: "sat",
        };
      }
    } else if (line.startsWith("-") && current) {
      let choiceText = line.slice(2).trim();
      const isCorrect =
        (choiceText.startsWith("*") && choiceText.endsWith("*")) ||
        (choiceText.startsWith("_") && choiceText.endsWith("_"));
      if (isCorrect) choiceText = choiceText.slice(1, -1).trim();
      const parts = choiceText.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        if (isCorrect) current.answer = current.choice.length;
        current.choice.push([parts[0], parts[1]]);
      }
    }
  });

  if (current) questions.push(current);
  return questions;
};

async function loadData() {
  try {
    const resp = await fetch("./data/questions.md");
    if (!resp.ok) throw new Error("Failed to fetch questions.md");
    const text = await resp.text();
    allQuestions = parseMarkdownQuestions(text).filter(
      (q) => q && q.choice.length >= 4,
    );
    console.log(`Loaded ${allQuestions.length} questions.`);
  } catch (e) {
    console.error(e);
    elLoader.textContent = "Could not load questions.";
    return;
  }

  elLoader.style.display = "none";
  const introEl = document.getElementById("intro");
  introEl.classList.add("visible");
}

async function initVersion() {
  try {
    const resp = await fetch("manifest.json");
    const manifest = await resp.json();
    if (manifest.version) {
      elVersion.textContent = "v" + manifest.version;
      const elVI = document.getElementById("app-version-intro");
      if (elVI) elVI.textContent = "v" + manifest.version;
    }
  } catch {
    // ignore
  }
}

// --- Event wiring ---
document.getElementById("play-btn").addEventListener("click", () => {
  triggerHaptic();
  const introEl = document.getElementById("intro");
  introEl.classList.remove("visible");
  elQuestionArea.style.display = "block";
  displayQuestion();
});

document.getElementById("modal-close-btn").addEventListener("click", () => {
  triggerHaptic();
  startNewSession();
});

document.getElementById("stats-btn").addEventListener("click", () => {
  openHistoryModal();
});

document.getElementById("close-history-btn").addEventListener("click", () => {
  triggerHaptic();
  document.getElementById("history-modal").classList.add("hidden");
});

// --- Init ---
async function init() {
  getHistory(); // pre-warm cache
  initHaptic();
  FireSystem.init();
  initVersion();
  updateBrainFill();
  updateCounter();
  await loadData();
}

init();

window.injectFakeHistory = injectFakeHistory;
