import {
  initUI,
  renderParamsUI,
  elements,
  triggerHaptic,
  triggerHapticError,
  renderNumberPad,
} from "./ui.js";
import { startGame, pauseGame, resumeGame, handleNumberPress } from "./game.js";
import { state, updateParameter } from "./state.js";
import { PARAMS_CONFIG } from "./constants.js";
import { openHistoryModal } from "./history.js";
import { injectFakeHistory } from "./faker.js";

// Make faker accessible from console
window.injectFakeHistory = injectFakeHistory;

async function fetchSelfManifest() {
  try {
    const response = await fetch("./manifest.json");
    if (response.ok) {
      let loadedManifest = await response.text();
      let version = JSON.parse(loadedManifest).version;
      Array.from(document.querySelectorAll(".with-version")).map(
        (e) => (e.innerHTML = e.innerHTML.replace("{{version}}", version)),
      );
      console.log("Version fetched.");
    } else {
      console.warn("Failed to fetch manifest", response.statusText);
    }
  } catch (error) {
    console.error("Error fetching manifest: ", error);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      elements.copyBtn.textContent = "Copied!";
      setTimeout(
        () => (elements.copyBtn.textContent = "Copy as Markdown"),
        2000,
      );
    });
  } else {
    // Fallback
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = 0;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      elements.copyBtn.textContent = "Copied!";
      setTimeout(
        () => (elements.copyBtn.textContent = "Copy as Markdown"),
        2000,
      );
    } catch (err) {
      console.error("Fallback: Oops, unable to copy", err);
    }
    document.body.removeChild(textArea);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initUI();

  // Attach Event Listeners

  // Parameter Inputs
  for (const param in elements.paramValueInputs) {
    elements.paramValueInputs[param].forEach((input) => {
      if (input) {
        input.addEventListener("change", (e) => {
          updateParameterAndRender(param, e.target.value);
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            renderParamsUI();
            input.blur();
          } else if (e.key === "Enter") {
            updateParameterAndRender(param, e.target.value);
            input.blur();
          }
        });
      }
    });
  }

  function updateParameterAndRender(param, value) {
    let newValue = parseInt(value, 10);
    const config = PARAMS_CONFIG[param];

    if (isNaN(newValue)) {
      renderParamsUI();
      return;
    }

    newValue = Math.max(config.min, Math.min(config.max, newValue));
    updateParameter(param, newValue);

    // Helper logic for constraints
    const maxBatch = Math.min(
      state.gameParams.totalItems,
      PARAMS_CONFIG.batchSize.max,
    );
    if (state.gameParams.batchSize > maxBatch) {
      updateParameter("batchSize", maxBatch);
    }

    renderParamsUI();
  }

  // Parameter Buttons
  document.querySelectorAll(".param-btn").forEach((button) => {
    for (let ev of ["touchend", "pointerup"]) {
      button.addEventListener(ev, (e) => {
        e.preventDefault(); // Prevent double firing
        const param = button.dataset.param;
        const step = parseInt(button.dataset.step, 10);

        const currentVal = state.gameParams[param];
        const initial = currentVal;

        updateParameterAndRender(param, currentVal + step);

        if (state.gameParams[param] !== initial) {
          triggerHaptic();
        } else {
          triggerHapticError();
        }
      });
    }
  });

  // Toggles sync
  const togglePairs = [
    [elements.hardModeToggle, elements.hardModeToggleResults],
    [elements.memorizeModeToggle, elements.memorizeModeToggleResults],
    [elements.shuffleModeToggle, elements.shuffleModeToggleResults],
  ];

  togglePairs.forEach(([t1, t2]) => {
    t1.addEventListener("change", () => (t2.checked = t1.checked));
    t2.addEventListener("change", () => (t1.checked = t2.checked));
  });

  // Main Buttons
  const attach = (btn, action) => {
    for (let ev of ["touchend", "pointerup"]) {
      btn.addEventListener(ev, (e) => {
        e.preventDefault();
        triggerHaptic(); // Most actions have haptic
        action(e);
      });
    }
  };

  attach(elements.startBtn, () => {
    state.allSessionsData = []; // Reset session data on fresh start? Original did this.
    startGame();
  });

  attach(elements.restartBtn, () => startGame());
  attach(elements.resumeBtn, () => resumeGame());
  attach(elements.pauseBtn, () => pauseGame());

  attach(elements.copyBtn, () => copyToClipboard(state.markdownStats));

  attach(elements.helpBtn, () => elements.helpModal.classList.add("visible"));
  if (elements.resultsHelpBtn) {
    attach(elements.resultsHelpBtn, () =>
      elements.helpModal.classList.add("visible"),
    );
  }
  attach(elements.closeHelpBtn, () =>
    elements.helpModal.classList.remove("visible"),
  );

  attach(elements.statsBtn, () => openHistoryModal());
  attach(elements.closeHistoryBtn, () =>
    elements.historyModal.classList.remove("visible"),
  );

  // Modal background clicks
  for (let ev of ["touchend", "pointerup"]) {
    elements.helpModal.addEventListener(ev, (e) => {
      if (e.target === elements.helpModal) {
        e.preventDefault();
        triggerHaptic();
        elements.helpModal.classList.remove("visible");
      }
    });
    elements.pauseModal.addEventListener(ev, (e) => {
      if (e.target === elements.pauseModal) {
        e.preventDefault();
        triggerHaptic();
        resumeGame();
      }
    });
    elements.historyModal.addEventListener(ev, (e) => {
      if (e.target === elements.historyModal) {
        e.preventDefault();
        triggerHaptic();
        elements.historyModal.classList.remove("visible");
      }
    });
  }

  // Render Number Pad
  renderNumberPad(handleNumberPress);

  // Initialize
  fetchSelfManifest();
  renderParamsUI();
});
