import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import { saveSessionRecord, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { injectFakeHistory } from "./faker.js";
import { FireSystem } from "../shared/fire.js";

// --- State ---
const MAX_ROUNDS = 50;

let gameState = "idle"; // 'idle', 'playing', 'paused', 'ended'
let currentDigit = null;
let previousDigit = null;
let intervalMs = 3000;
let currentTickMs = 3000;
let fastestInterval = 3000;

let streak = 0;
let correct = 0;
let total = 0;

let hasAnsweredCurrent = true;
let timerId = null;

let keyBuffer = "";
let keyTimeout = null;

// --- DOM Elements ---
const elBatteryIcon = document.getElementById("battery-icon");
const elProgress = document.getElementById("progress-bar");
const elDisplayArea = document.getElementById("display-area");
const elIdleText = document.getElementById("idle-text");
const elDigit = document.getElementById("digit");
const elStatus = document.getElementById("status-text");
const elNumpad = document.getElementById("numpad");
const elVersion = document.getElementById("app-version");
const elModalCloseBtn = document.getElementById("modal-close-btn");

let numpadButtons = [];
let btnPlay = null;

// --- Icons ---
const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const pauseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
const resetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;

// --- Core Logic ---
function processDigitInput(digit) {
  if (gameState !== "playing") return;

  keyBuffer += digit;

  if (keyTimeout) clearTimeout(keyTimeout);

  const expectedSum = previousDigit !== null ? previousDigit + currentDigit : 0;

  if (
    keyBuffer.length === 2 ||
    (keyBuffer !== "1" && keyBuffer.length === 1) ||
    (expectedSum < 10 && keyBuffer.length === 1)
  ) {
    const val = parseInt(keyBuffer, 10);
    handleInput(val);
    keyBuffer = "";
  } else {
    keyTimeout = setTimeout(() => {
      const val = parseInt(keyBuffer, 10);
      if (!isNaN(val)) handleInput(val);
      keyBuffer = "";
    }, 5000);
  }
}

function initNumpad() {
  const layout = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "reset",
    "0",
    "play",
  ];

  layout.forEach((key) => {
    if (key === "play") {
      btnPlay = document.createElement("button");
      btnPlay.className = "numpad-btn play-btn";
      btnPlay.innerHTML = playIcon;

      btnPlay.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btnPlay.classList.add("pressed");
        togglePlayState();
      });
      const clearPlay = () => btnPlay.classList.remove("pressed");
      btnPlay.addEventListener("pointerup", clearPlay);
      btnPlay.addEventListener("pointercancel", clearPlay);
      btnPlay.addEventListener("pointerout", clearPlay);

      elNumpad.appendChild(btnPlay);
    } else if (key === "reset") {
      const btnReset = document.createElement("button");
      btnReset.className = "numpad-btn reset-btn";
      btnReset.innerHTML = resetIcon;

      btnReset.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btnReset.classList.add("pressed");
        resetGame();
      });
      const clearReset = () => btnReset.classList.remove("pressed");
      btnReset.addEventListener("pointerup", clearReset);
      btnReset.addEventListener("pointercancel", clearReset);
      btnReset.addEventListener("pointerout", clearReset);

      elNumpad.appendChild(btnReset);
    } else {
      const btn = document.createElement("button");
      btn.className = "numpad-btn";
      btn.innerText = key;

      btn.addEventListener("pointerdown", (e) => {
        if (btn.disabled) return;
        e.preventDefault();
        btn.classList.add("pressed");
        triggerHaptic();
        processDigitInput(key);
      });
      const clearBtn = () => btn.classList.remove("pressed");
      btn.addEventListener("pointerup", clearBtn);
      btn.addEventListener("pointercancel", clearBtn);
      btn.addEventListener("pointerout", clearBtn);

      btn.disabled = true;
      numpadButtons.push(btn);
      elNumpad.appendChild(btn);
    }
  });

  elModalCloseBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    closeModal();
  });
}

function handleTick() {
  if (keyTimeout) {
    clearTimeout(keyTimeout);
    keyTimeout = null;
  }
  keyBuffer = "";

  if (!hasAnsweredCurrent && previousDigit !== null) {
    handleError("miss");
    if (gameState === "ended") return;
  } else {
    updateFeedback("none");
  }

  previousDigit = currentDigit;
  currentDigit = Math.floor(Math.random() * 9) + 1;

  hasAnsweredCurrent = previousDigit === null;

  // NEW: Add a 10% + 150ms physical buffer for 2-digit answers
  if (previousDigit !== null && previousDigit + currentDigit >= 10) {
    currentTickMs = Math.round(intervalMs * 1.1) + 150;
  } else {
    currentTickMs = intervalMs;
  }

  updateUI();
  updateBatteryIcon();
  startProgressBar();

  timerId = setTimeout(handleTick, currentTickMs);
}

function handleInput(val) {
  if (gameState !== "playing" || hasAnsweredCurrent || previousDigit === null)
    return;

  const expectedSum = previousDigit + currentDigit;

  if (val === expectedSum) {
    correct++;
    total++;
    updateFeedback("correct");

    streak++;
    updateGlow();
    if (streak > 0 && streak % 3 === 0) {
      intervalMs = Math.max(500, Math.round(intervalMs * 0.85));
      fastestInterval = Math.min(fastestInterval, intervalMs);
    }

    if (total >= MAX_ROUNDS) {
      endGame();
    }
  } else {
    handleError("wrong");
  }

  hasAnsweredCurrent = true;
  updateUI();
  updateBatteryIcon();
}

// --- Core Logic ---
function handleError(type) {
  total++;
  streak = 0;
  updateGlow();
  updateFeedback(type);
  intervalMs = Math.min(5000, Math.round(intervalMs * 1.05));

  if (total >= MAX_ROUNDS) {
    endGame();
  }
}

function endGame() {
  gameState = "ended";
  clearTimeout(timerId);
  stopProgressBar();

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  document.getElementById("modal-correct").innerText = correct;
  document.getElementById("modal-total").innerText = total;
  document.getElementById("modal-acc").innerText = accuracy;
  document.getElementById("modal-best").innerText = (
    fastestInterval / 1000
  ).toFixed(2);

  // Slight delay before throwing up the modal to let the user see the final answer pop
  setTimeout(() => {
    saveSessionRecord({
      accuracy: accuracy,
      finalPace: parseFloat((intervalMs / 1000).toFixed(2)),
      bestPace: parseFloat((fastestInterval / 1000).toFixed(2)),
    });

    document.getElementById("results-modal").classList.remove("hidden");
  }, 500);
}

function closeModal() {
  document.getElementById("results-modal").classList.add("hidden");
  resetGame();
}

// --- UI Updates ---
function updateBatteryIcon() {
  if (!elBatteryIcon) return;

  const progressRatio = total / MAX_ROUNDS;

  // Calculate insets matching nb's logic exactly
  const bottom = 88;
  const top = 8;

  // Overall progress gradient
  const progressInset = bottom - progressRatio * (bottom - top);
  elBatteryIcon.style.setProperty("--progress-inset", `${progressInset}%`);
  elBatteryIcon.style.setProperty("--fire-inset", `${progressInset}%`);

  // Update fire particles
  FireSystem.update(progressRatio, progressInset);
}

function updateGlow() {
  if (!elDisplayArea) return;
  if (gameState !== "playing" && gameState !== "ended") {
    elDisplayArea.style.boxShadow = "none";
    return;
  }

  // Base glow calculation off streak (e.g. up to a max 10 streak)
  const glowLevel = Math.min(streak, 10);
  if (glowLevel > 0) {
    // scale from 5px to 25px blur based on streak
    const blur = 5 + glowLevel * 2;
    const opacity = 0.2 + glowLevel * 0.05;
    elDisplayArea.style.boxShadow =
      "0 0 " + blur + "px rgba(234, 179, 8, " + opacity + ")"; // Using a yellow-ish tailwind color
  } else {
    elDisplayArea.style.boxShadow = "none";
  }
}

function updateUI() {
  if (gameState === "idle" || gameState === "ended") {
    if (gameState === "idle") {
      elIdleText.classList.remove("hidden");
      elDigit.classList.add("hidden");
    }
  } else {
    elIdleText.classList.add("hidden");
    elDigit.classList.remove("hidden");
    elDigit.innerText = currentDigit !== null ? currentDigit : "?";

    elDigit.classList.remove("animate-pop");
    void elDigit.offsetWidth;
    elDigit.classList.add("animate-pop");
  }

  numpadButtons.forEach((btn) => (btn.disabled = gameState !== "playing"));
  btnPlay.innerHTML = gameState === "playing" ? pauseIcon : playIcon;
}

function updateFeedback(type) {
  elDigit.className = "digit-text animate-pop ";
  elDisplayArea.className = "display-area ";

  if (type === "correct") {
    elDigit.classList.add("text-correct");
    elDisplayArea.classList.add("border-correct");
    elStatus.innerText = "";
    triggerHaptic();
  } else if (type === "wrong" || type === "miss") {
    elDigit.classList.add("text-wrong");
    elDisplayArea.classList.add("border-wrong");
    elStatus.innerText = type === "miss" ? "Missed!" : "Wrong!";
    triggerHapticError();
  } else {
    elDigit.classList.add("text-normal");
    elDisplayArea.classList.add("border-normal");
    elStatus.innerText = gameState === "paused" ? "Paused" : "";
  }
}

function startProgressBar() {
  elProgress.style.transition = "none";
  elProgress.style.width = "100%";
  elProgress.style.backgroundColor = "var(--color-blue)";

  void elProgress.offsetWidth;

  // NEW: Use currentTickMs here
  elProgress.style.transition =
    "width " +
    currentTickMs +
    "ms linear, background-color " +
    currentTickMs +
    "ms ease-in";
  elProgress.style.width = "10%";
  elProgress.style.backgroundColor = "#ff0000";
  elProgress.style.width = "0%";
  elProgress.style.backgroundColor = "#ff0000";
}

function stopProgressBar() {
  elProgress.style.transition = "none";
}

// --- Controls ---
function togglePlayState() {
  triggerHaptic();
  if (gameState === "ended") return;

  if (gameState === "playing") {
    gameState = "paused";
    clearTimeout(timerId);
    stopProgressBar();
    updateFeedback("none");
  } else {
    let wasIdle = gameState === "idle";
    gameState = "playing";
    updateFeedback("none");
    if (wasIdle) {
      handleTick();
    } else {
      startProgressBar();
      // NEW: Resume using the current tick's allotted time
      timerId = setTimeout(handleTick, currentTickMs);
    }
  }
  updateUI();
}

function resetGame() {
  triggerHaptic();
  clearTimeout(timerId);
  gameState = "idle";
  currentDigit = null;
  previousDigit = null;
  intervalMs = 3000;
  currentTickMs = 3000; // NEW: Reset tick time
  fastestInterval = 3000;
  streak = 0;
  correct = 0;
  total = 0;
  hasAnsweredCurrent = true;

  elProgress.style.transition = "none";
  elProgress.style.width = "100%";

  updateFeedback("none");
  updateGlow();
  updateBatteryIcon();
  updateUI();
}

// --- Keyboard Support ---
window.addEventListener("keydown", (e) => {
  if (gameState !== "playing") return;

  if (e.key >= "0" && e.key <= "9") {
    processDigitInput(e.key);
  }
});

async function initVersion() {
  try {
    const response = await fetch("manifest.json");
    const manifest = await response.json();
    if (elVersion && manifest.version) {
      elVersion.innerText = "v" + manifest.version;
    }
  } catch (error) {
    console.error("Failed to load manifest version:", error);
  }
}

// Run Init
async function init() {
  getHistory(); // Pre-warm the localStorage cache
  initHaptic();
  initNumpad();
  initVersion();
  FireSystem.init();
  updateUI();
  updateBatteryIcon();
}
init();

const statsBtn = document.getElementById("stats-btn");
if (statsBtn) {
  statsBtn.addEventListener("click", () => {
    openHistoryModal();
  });
}

const closeHistoryBtn = document.getElementById("close-history-btn");
if (closeHistoryBtn) {
  closeHistoryBtn.addEventListener("click", () => {
    document.getElementById("history-modal").classList.add("hidden");
  });
}

// Make faker available globally
window.injectFakeHistory = injectFakeHistory;
