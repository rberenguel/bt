import { ICONS, PARAMS_CONFIG } from "./constants.js";
import { state } from "./state.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../../shared/haptic.js";

export const elements = {
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  resultsScreen: document.getElementById("results-screen"),
  pauseModal: document.getElementById("pause-modal"),
  helpModal: document.getElementById("help-modal"),
  startBtn: document.getElementById("start-btn"),
  helpBtn: document.getElementById("help-btn"),
  statsBtn: document.getElementById("stats-btn"),
  resultsHelpBtn: document.getElementById("results-help-btn"),
  closeHelpBtn: document.getElementById("close-help-btn"),
  historyModal: document.getElementById("history-modal"),
  closeHistoryBtn: document.getElementById("close-history-btn"),
  historyList: document.getElementById("history-list"),
  restartBtn: document.getElementById("restart-btn"),
  resumeBtn: document.getElementById("resume-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  copyBtn: document.getElementById("copy-btn"),
  pauseGameDetails: document.getElementById("pause-game-details"),
  hardModeToggle: document.getElementById("hard-mode-toggle"),
  hardModeToggleResults: document.getElementById("hard-mode-toggle-results"),
  memorizeModeToggle: document.getElementById("memorize-mode-toggle"),
  memorizeModeToggleResults: document.getElementById(
    "memorize-mode-toggle-results",
  ),
  shuffleModeToggle: document.getElementById("shuffle-mode-toggle"),
  shuffleModeToggleResults: document.getElementById(
    "shuffle-mode-toggle-results",
  ),
  keyDisplayWrapper: document.getElementById("key-display-wrapper"),
  keyDisplay: document.getElementById("key-display"),
  keyTimerSVG: document.getElementById("key-timer"),
  numberPad: document.getElementById("number-pad"),
  sequenceDisplay: document.getElementById("sequence-display"),
  resultsTableContainer: document.getElementById("results-table-container"),
  iconPreviewGrid: document.getElementById("icon-preview-grid"),
  timeResult: document.getElementById("time-result"),
  accuracyResult: document.getElementById("accuracy-result"),
  batchProgress: document.getElementById("batch-progress"),
  // New element for graph
  recoveryGraphContainer:
    document.getElementById("recovery-graph-container") ||
    createGraphContainer(),

  paramValueInputs: {
    totalItems: [
      document.getElementById("total-items-value"),
      document.getElementById("total-items-value-results"),
    ],
    keySize: [
      document.getElementById("key-size-value"),
      document.getElementById("key-size-value-results"),
    ],
    batchSize: [
      document.getElementById("batch-size-value"),
      document.getElementById("batch-size-value-results"),
    ],
  },
};

function createGraphContainer() {
  // If it doesn't exist yet (will look for it in HTML update later),
  // we might return null or handle it.
  // Ideally index.html is updated before this runs, but module load might be early.
  // We'll return null and handle checks.
  return null;
}

export function initUI() {
  initHaptic();

  if (elements.iconPreviewGrid) {
    elements.iconPreviewGrid.innerHTML = "";
    const randomizedIcons = [...ICONS].sort(() => 0.5 - Math.random());
    const n = randomizedIcons.length;
    const cols = Math.ceil(Math.sqrt(n));
    elements.iconPreviewGrid.style.setProperty("--grid-cols", cols);
    randomizedIcons.forEach((icon) => {
      const iconWrapper = document.createElement("div");
      iconWrapper.className = "preview-icon";
      iconWrapper.innerHTML = `${icon.font}`;
      elements.iconPreviewGrid.appendChild(iconWrapper);
    });
  }
}

export function renderParamsUI() {
  for (const param in state.gameParams) {
    if (elements.paramValueInputs[param]) {
      elements.paramValueInputs[param].forEach((input) => {
        if (input) input.value = state.gameParams[param];
      });
    }
  }
}

export function renderKey() {
  elements.keyDisplay.innerHTML = "";
  elements.keyDisplay.style.gridTemplateColumns = `repeat(${Math.min(state.gameParams.keySize, 5)}, 1fr)`;
  state.keyMap.forEach((digit, iconName) => {
    const iconData = ICONS.find((i) => i.icon === iconName);
    const item = document.createElement("div");
    item.className = "grid-item";
    item.innerHTML = `<span class="iconoir iconoir-${iconData.icon}"></span><span class="icon-value">${digit}</span>`;
    elements.keyDisplay.appendChild(item);
  });
}

export function renderNumberPad(handleNumberPress) {
  elements.numberPad.innerHTML = "";
  const keypadOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  keypadOrder.forEach((digit) => {
    const button = document.createElement("button");
    button.textContent = digit;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
    }); // Prevent focus/selection
    button.addEventListener("pointerup", (e) => {
      e.preventDefault();
      handleNumberPress(digit);
    });
    elements.numberPad.appendChild(button);
  });
}

export function renderSequenceBatch() {
  const { batchSize } = state.gameParams;
  elements.sequenceDisplay.innerHTML = "";
  elements.sequenceDisplay.style.gridTemplateColumns = `repeat(${Math.min(batchSize, 5)}, 1fr)`;
  const start = Math.floor(state.currentItemIndex / batchSize) * batchSize;
  const end = start + batchSize;
  const batch = state.sequence.slice(start, end);
  batch.forEach((iconData) => {
    const item = document.createElement("div");
    item.className = "grid-item";
    item.innerHTML = `<span class="iconoir iconoir-${iconData.icon}"></span>`;
    elements.sequenceDisplay.appendChild(item);
  });

  // Update Batch Progress
  const { totalItems } = state.gameParams;
  const currentBatch = Math.floor(state.currentItemIndex / batchSize) + 1;
  const totalBatches = Math.ceil(totalItems / batchSize);
  if (elements.batchProgress) {
    elements.batchProgress.textContent = `Batch ${currentBatch} / ${totalBatches}`;
  }

  highlightCurrentItem();
}

export function highlightCurrentItem() {
  if (state.isMemorizing) return;
  document
    .querySelectorAll("#sequence-display .grid-item")
    .forEach((el) => el.classList.remove("current-item"));

  if (state.currentItemIndex >= state.gameParams.totalItems) return;

  const sequenceIndexInBatch =
    state.currentItemIndex % state.gameParams.batchSize;
  const currentElement =
    elements.sequenceDisplay.children[sequenceIndexInBatch];
  if (currentElement) {
    currentElement.classList.add("current-item");
  }
}

export function showKeyWithTimer(callback) {
  state.isMemorizing = true;
  elements.keyDisplay.classList.remove("hidden-by-memorize");
  elements.keyTimerSVG.classList.remove("hidden");

  setTimeout(() => {
    const rect = elements.keyTimerSVG.querySelector("rect");

    requestAnimationFrame(() => {
      const width = elements.keyDisplayWrapper.clientWidth;
      const height = elements.keyDisplayWrapper.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      const perimeter = 2 * (width + height);
      rect.style.transition = "none";
      rect.style.strokeDasharray = perimeter;
      rect.style.strokeDashoffset = 0;
      void rect.offsetWidth;
      rect.style.transition = "stroke-dashoffset 9s linear";
      rect.style.strokeDashoffset = perimeter;
    });

    clearTimeout(state.memorizeTimer);
    state.memorizeTimer = setTimeout(() => {
      elements.keyDisplay.classList.add("hidden-by-memorize");
      elements.keyTimerSVG.classList.add("hidden");
      state.isMemorizing = false;
      highlightCurrentItem();
      if (rect) {
        rect.style.transition = "none";
        rect.style.strokeDashoffset = "0";
      }
      if (callback) callback();
    }, 9000);
  }, 10);
}

export function visualizeRecoveryGraph(graphData) {
  // Get container again if it wasn't there at init
  const container = document.getElementById("recovery-graph-container");
  if (!container) return;

  container.innerHTML = "<h3>Recovery Speed (ms)</h3>";
  if (!graphData || graphData.data.length === 0) return;

  const graph = document.createElement("div");
  graph.className = "recovery-graph";
  graph.style.display = "flex";
  graph.style.alignItems = "flex-end";
  graph.style.height = "150px";
  graph.style.gap = "10px";
  graph.style.padding = "10px";
  graph.style.marginTop = "10px";
  graph.style.borderLeft = "1px solid var(--text)";
  graph.style.borderBottom = "1px solid var(--text)";

  const maxVal = Math.max(...graphData.data, 100); // Avoid divide by zero

  graphData.data.forEach((val, idx) => {
    const barContainer = document.createElement("div");
    barContainer.style.flex = "1";
    barContainer.style.display = "flex";
    barContainer.style.flexDirection = "column";
    barContainer.style.alignItems = "center";
    barContainer.style.justifyContent = "flex-end";
    barContainer.style.height = "100%";

    const bar = document.createElement("div");
    const heightPct = (val / maxVal) * 100;

    bar.style.width = "100%";
    bar.style.height = `${heightPct}%`;
    bar.style.backgroundColor = "var(--primary)";
    bar.style.borderRadius = "2px 2px 0 0";

    // Switch color for the first item (Switch)
    if (idx === 0) {
      bar.style.backgroundColor = "#ff6b6b";
    }

    const label = document.createElement("div");
    label.textContent = graphData.labels[idx];
    label.style.fontSize = "10px";
    label.style.marginTop = "4px";

    const valueLabel = document.createElement("div");
    valueLabel.textContent = val > 0 ? val : "";
    valueLabel.style.fontSize = "10px";
    valueLabel.style.marginBottom = "2px";

    barContainer.appendChild(valueLabel);
    barContainer.appendChild(bar);
    barContainer.appendChild(label);

    graph.appendChild(barContainer);
  });

  container.appendChild(graph);
}

export { initHaptic, triggerHaptic, triggerHapticError };
