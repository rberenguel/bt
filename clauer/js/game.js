import { ICONS, PARAMS_CONFIG } from "./constants.js";
import { state, resetStateForNewGame, updateParameter } from "./state.js";
import * as UI from "./ui.js";
import {
  logEvent,
  generateStatsReport,
  generateRecoveryGraphData,
} from "./metrics.js";
import { saveSessionRecord } from "./storage.js";

// Pick a random item from pool, avoiding repeating prev (if pool has >1 item)
function pickNonRepeating(pool, prev) {
  if (pool.length <= 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pick === prev);
  return pick;
}

// Helper to generate a key
function generateNewKey(iconsForKey) {
  state.keyMap.clear();
  let digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (state.isShuffleMode) {
    digits.sort(() => 0.5 - Math.random());
  }
  iconsForKey.forEach((icon, i) => {
    state.keyMap.set(icon.icon, digits.slice(0, iconsForKey.length)[i]);
  });
  UI.renderKey();
}

export function setupGame() {
  state.isHardMode = UI.elements.hardModeToggle.checked;
  state.isMemorizeMode = UI.elements.memorizeModeToggle.checked;
  state.isShuffleMode = UI.elements.shuffleModeToggle.checked;

  resetStateForNewGame();

  const { totalItems, keySize, batchSize } = state.gameParams;

  if (state.isHardMode) {
    const numBatches = Math.ceil(totalItems / batchSize);
    state.batchKeys = [];
    for (let i = 0; i < numBatches; i++) {
      const keyIconsForBatch = [...ICONS]
        .sort(() => 0.5 - Math.random())
        .slice(0, keySize);
      state.batchKeys.push(keyIconsForBatch);

      const itemsInThisBatch = Math.min(
        batchSize,
        totalItems - state.sequence.length,
      );
      let prev = null;
      for (let j = 0; j < itemsInThisBatch; j++) {
        const pick = pickNonRepeating(keyIconsForBatch, prev);
        state.sequence.push(pick);
        prev = pick;
      }
    }
    generateNewKey(state.batchKeys[0]);
  } else {
    const keyIcons = [...ICONS]
      .sort(() => 0.5 - Math.random())
      .slice(0, keySize);
    generateNewKey(keyIcons);
    let prev = null;
    for (let i = 0; i < totalItems; i++) {
      const pick = pickNonRepeating(keyIcons, prev);
      state.sequence.push(pick);
      prev = pick;
    }
  }

  UI.renderSequenceBatch();
}

export function startGame() {
  setupGame();
  state.gameActive = true;
  state.startTime = null; // Will be set on first press to exclude start delay

  UI.elements.startScreen.classList.add("hidden");
  UI.elements.resultsScreen.classList.add("hidden");
  UI.elements.gameScreen.classList.remove("hidden");
  UI.elements.pauseModal.classList.remove("visible");
  UI.elements.copyBtn.textContent = "Copy as Markdown";

  if (state.isMemorizeMode) {
    UI.showKeyWithTimer(() => (state.itemStartTime = performance.now()));
  } else {
    UI.elements.keyDisplay.classList.remove("hidden-by-memorize");
    UI.elements.keyTimerSVG.classList.add("hidden");
    state.itemStartTime = performance.now(); // Start timing first item immediately (for delta, though first item is untimed in stats)
    UI.highlightCurrentItem();
  }
}

export function handleNumberPress(digit) {
  if (!state.gameActive || state.isPaused || state.isMemorizing) return;

  const { totalItems, batchSize } = state.gameParams;
  const iconName = state.sequence[state.currentItemIndex].icon;

  if (!state.currentSessionStats[iconName]) {
    state.currentSessionStats[iconName] = {
      attempts: 0,
      correct: 0,
      totalTime: 0,
    };
  }

  const correctDigit = state.keyMap.get(
    state.sequence[state.currentItemIndex].icon,
  );
  const currentElement =
    UI.elements.sequenceDisplay.children[state.currentItemIndex % batchSize];

  // Determine if this is a switch item
  // A switch happens at the start of a batch (if hard/shuffle) or maybe we treat "Switch"
  // as just the first item of a batch regardless?
  // Use user definition: "RT_switch: The time it takes to answer the first item immediately after the key changes."
  // Key changes happen at batch boundaries in Hard/Shuffle mode.
  // In Normal mode, key never changes. So switch cost might be N/A or we treat start as switch?
  // Let's implement strict definition: Only if key ACTUALLY changed.
  // We can track if key changed in the last step.
  // Or simpler: Index % BatchSize === 0 AND (HardMode OR ShuffleMode OR Index === 0).
  // Actually, for "Recovery Speed" graph, we want position relative to batch start.

  const isBatchStart = state.currentItemIndex % batchSize === 0;
  const isKeyChange =
    isBatchStart &&
    (state.isHardMode || state.isShuffleMode || state.currentItemIndex === 0);

  state.currentSessionStats[iconName].attempts++;

  const isCorrect = digit === correctDigit;

  // Handle start delay: If this is the first item, set the start time NOW.
  if (state.startTime === null) {
    state.startTime = performance.now();
    // Reset itemStartTime so the *next* item has a correct delta.
    // The first item's time will be whatever elapsed, but we might want to exclude it from stats?
    // LogEvent uses (now - itemStartTime).
    // If we want to exclude first item from "Total Time", we set startTime now.
    // But logEvent still records a duration.
    // Let's mark the first log as "warmup" or just rely on metrics calculation to use (TotalTime / (N-1))?
  }

  // Log event
  logEvent(state, isCorrect, isKeyChange);

  if (isCorrect) {
    UI.triggerHaptic();
    state.currentSessionStats[iconName].correct++;
    // We already calculated time in logEvent, but we need it here for stats?
    // Actually logEvent uses state.itemStartTime.
    // The existing code accumulated time here.
    const timeTaken = performance.now() - state.itemStartTime;
    state.currentSessionStats[iconName].totalTime += timeTaken;

    currentElement.classList.add("correct-answer");
    setTimeout(() => currentElement.classList.remove("correct-answer"), 500);

    state.currentItemIndex++;

    if (state.currentItemIndex >= totalItems) {
      endGame();
      return;
    }

    if (
      state.currentItemIndex > 0 &&
      state.currentItemIndex % batchSize === 0
    ) {
      let keyChanged = false;
      if (state.isHardMode) {
        const nextBatchIndex = Math.floor(state.currentItemIndex / batchSize);
        if (state.batchKeys[nextBatchIndex]) {
          generateNewKey(state.batchKeys[nextBatchIndex]);
          keyChanged = true;
        }
      } else if (state.isShuffleMode) {
        const currentIcons = Array.from(state.keyMap.keys()).map((iconName) =>
          ICONS.find((i) => i.icon === iconName),
        );
        generateNewKey(currentIcons);
        keyChanged = true;
      }

      if (keyChanged && state.isMemorizeMode) {
        UI.showKeyWithTimer(() => (state.itemStartTime = performance.now()));
      } else {
        // If no memorize pause, reset timer for next item
        state.itemStartTime = performance.now();
      }
      UI.renderSequenceBatch();
    } else {
      UI.highlightCurrentItem();
      // itemStartTime is set in highlightCurrentItem in original code?
      // No, let's explicitly set it here to be sure.
      // UI.highlightCurrentItem sets it in original code.
      // let's mirror that in UI.highlightCurrentItem if possible, or set it here.
      // In original: `highlightCurrentItem` did `itemStartTime = performance.now();`
      // I removed that from my UI.highlightCurrentItem copy? Let me check.
      // I should modify UI.highlightCurrentItem to set state.itemStartTime.
      // Or just set it here. Set it here is clearer.
      state.itemStartTime = performance.now();
    }
  } else {
    state.errorCount++;
    currentElement.classList.add("shake");
    UI.triggerHapticError();
    setTimeout(() => currentElement.classList.remove("shake"), 500);
    // Do NOT reset timer on error, as time keeps ticking?
    // User said "CPM penalizes you for every second wasted on a wrong answer".
    // So yes, keep timer running.
  }
}

export function endGame() {
  state.gameActive = false;
  UI.elements.hardModeToggleResults.checked = state.isHardMode;
  UI.elements.memorizeModeToggleResults.checked = state.isMemorizeMode;
  UI.elements.shuffleModeToggleResults.checked = state.isShuffleMode;

  UI.renderParamsUI();

  const activeModes = [];
  if (state.isHardMode) activeModes.push("Hard");
  if (state.isShuffleMode) activeModes.push("Shuffle");
  if (state.isMemorizeMode) activeModes.push("Memorize");

  let mode = activeModes.join(" / ");
  if (mode === "") mode = "Normal";

  const config = `${state.gameParams.keySize}@${state.gameParams.batchSize}/${state.gameParams.totalItems}`;

  const sessionData = {
    stats: state.currentSessionStats,
    mode: mode,
    config: config,
    errors: state.errorCount,
    time: (performance.now() - state.startTime - state.totalPausedTime) / 1000,
    logs: [...state.sessionLogs], // copy logs
  };

  state.allSessionsData.push(sessionData);
  saveSessionRecord(sessionData);

  const report = generateStatsReport(state.allSessionsData);
  UI.elements.resultsTableContainer.innerHTML = report.html;
  state.markdownStats = report.markdown;

  // Visualize Recovery Graph
  const recoveryData = generateRecoveryGraphData(
    state.sessionLogs,
    state.gameParams.batchSize,
  );
  UI.visualizeRecoveryGraph(recoveryData);

  UI.elements.gameScreen.classList.add("hidden");
  UI.elements.resultsScreen.classList.remove("hidden");

  // Update totals
  const finalTime = state.allSessionsData.reduce((acc, s) => acc + s.time, 0);
  const finalErrors = state.allSessionsData.reduce(
    (acc, s) => acc + s.errors,
    0,
  );
  const finalItems = state.allSessionsData.reduce(
    (acc, s) => acc + parseInt(s.config.split("/")[1], 10),
    0,
  );
  const finalAccuracy =
    finalItems > 0
      ? (((finalItems - finalErrors) / finalItems) * 100).toFixed(1)
      : 0;

  UI.elements.timeResult.textContent = `Total Time: ${finalTime.toFixed(2)}s`;
  UI.elements.accuracyResult.textContent = `Overall Accuracy: ${finalAccuracy}% (${finalItems - finalErrors}/${finalItems})`;
}

export function pauseGame() {
  if (!state.gameActive || state.isPaused) return;
  state.isPaused = true;
  state.pauseTime = performance.now();

  const activeModes = [];
  if (state.isHardMode) activeModes.push("Hard");
  if (state.isShuffleMode) activeModes.push("Shuffle");
  if (state.isMemorizeMode) activeModes.push("Memorize");
  let mode = activeModes.join(" / ");
  if (mode === "") mode = "Normal";

  UI.elements.pauseGameDetails.innerHTML = `
    <div class="detail-label">Mode:</div><div class="detail-value">${mode}</div>
    <div class="detail-label">Total Items:</div><div class="detail-value">${state.gameParams.totalItems}</div>
    <div class="detail-label">Key Size:</div><div class="detail-value">${state.gameParams.keySize}</div>
    <div class="detail-label">Batch Size:</div><div class="detail-value">${state.gameParams.batchSize}</div>
  `;

  UI.elements.pauseModal.classList.add("visible");
}

export function resumeGame() {
  if (!state.gameActive || !state.isPaused) return;
  state.totalPausedTime += performance.now() - state.pauseTime;
  state.isPaused = false;
  UI.elements.pauseModal.classList.remove("visible");
  UI.highlightCurrentItem();
  // Don't reset itemStartTime, just account for pause?
  // itemStartTime is used for delta.
  // If we pause, the clock effectively stops?
  // performance.now() keeps increasing.
  // We need to shift itemStartTime forward by pause duration so the delta is small.
  state.itemStartTime += performance.now() - state.pauseTime;
}
