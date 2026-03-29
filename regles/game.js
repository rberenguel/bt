import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import { FireSystem } from "../shared/fire.js";
import { saveSessionRecord } from "./storage.js";
import {
  COLORS,
  ICONS,
  TILE_COUNT,
  MAX_NUM,
  DIM_SIZE,
  BASE_RULES,
  FILTER_RULES,
  generateBoard as sharedGenerateBoard,
  forceTileToMatchRule,
} from "../shared/rules/engine.js";

(async () => {
  try {
    const m = await (await fetch("manifest.json")).json();
    if (m.version)
      document.getElementById("app-version").textContent = "v" + m.version;
  } catch {}
})();

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_LEVELS = 10; // Levels 1–10: stack grows to 9 filter rules + base rule.

// ── Game state ────────────────────────────────────────────────────────────────

let state = {
  level: 1,
  rules: [],
  board: [],
  activeRuleIndex: 0,
  status: "IDLE", // IDLE | MEMORIZE | PLAYING | DONE
};

// ── Session metrics ───────────────────────────────────────────────────────────

function freshMetrics() {
  return {
    shiftTimes: [], // ms from rule becoming active → first correct tap after it
    previousActiveRule: null,
    ruleShiftAt: null,
    totalTaps: 0,
    wrongTaps: 0,
    interferenceErrors: 0, // wrong taps that matched the immediately prior rule
  };
}

let met = freshMetrics();

function resetMetrics() {
  met = freshMetrics();
}

// ── DOM ───────────────────────────────────────────────────────────────────────

const DOM = {
  grid: document.getElementById("grid"),
  level: document.getElementById("level-display"),
  overlay: document.getElementById("overlay"),
  oIcon: document.getElementById("overlay-icon"),
  oTitle: document.getElementById("overlay-title"),
  oDesc: document.getElementById("overlay-desc"),
  oRule: document.getElementById("overlay-rule"),
  oStats: document.getElementById("overlay-stats"),
  oBtn: document.getElementById("overlay-btn"),
};

// ── Overlay helper ────────────────────────────────────────────────────────────

function showOverlay({
  icon = true,
  title,
  desc,
  ruleText = null,
  stats = null,
  btn,
}) {
  DOM.oIcon.classList.toggle("hidden", !icon);
  DOM.oTitle.textContent = title;
  DOM.oDesc.textContent = desc;

  if (ruleText !== null) {
    DOM.oRule.textContent = ruleText;
    DOM.oRule.classList.remove("hidden");
  } else {
    DOM.oRule.classList.add("hidden");
  }

  if (stats !== null) {
    DOM.oStats.innerHTML = stats
      .map(
        ({ label, value, note }) => `
            <div class="stat-row">
                <span class="stat-label">${label}</span>
                <span>
                    <span class="stat-value">${value}</span>
                    ${note ? `<div class="stat-desc">${note}</div>` : ""}
                </span>
            </div>`,
      )
      .join("");
    DOM.oStats.classList.remove("hidden");
  } else {
    DOM.oStats.classList.add("hidden");
  }

  DOM.oBtn.textContent = btn;
  document
    .getElementById("hub-link")
    .classList.toggle("hidden", btn !== "Play Again");
  DOM.overlay.classList.add("active");
}

// ── Init ──────────────────────────────────────────────────────────────────────

DOM.oBtn.addEventListener("click", handleOverlayClick);
document.getElementById("hub-link").addEventListener("click", triggerHaptic);

function handleOverlayClick() {
  triggerHaptic();
  if (state.status === "IDLE" || state.status === "DONE") {
    startGame();
  } else if (state.status === "MEMORIZE") {
    startPlayingPhase();
  }
}

// ── Game flow ─────────────────────────────────────────────────────────────────

function startGame() {
  state.level = 1;
  state.rules = [];
  resetMetrics();
  setBrainFill(0);
  setupLevel();
}

function setupLevel() {
  state.status = "MEMORIZE";

  let newRule;
  if (state.level === 1) {
    newRule = BASE_RULES[Math.floor(Math.random() * BASE_RULES.length)];
  } else {
    // Count how many rules per dimension are already in the stack.
    const dimCounts = {};
    for (const r of state.rules) {
      if (r.dim) dimCounts[r.dim] = (dimCounts[r.dim] || 0) + 1;
    }

    // Hard constraint: never exhaust a dimension (always leave ≥1 option unused).
    let available = FILTER_RULES.filter(
      (r) =>
        !state.rules.some((sr) => sr.id === r.id) &&
        (dimCounts[r.dim] || 0) < DIM_SIZE[r.dim] - 1,
    );

    // Prefer dimensions not yet represented — keeps the stack varied.
    const fresh = available.filter((r) => !dimCounts[r.dim]);
    if (fresh.length > 0) available = fresh;

    // Fallback: relax constraints if pool is exhausted.
    if (available.length === 0)
      available = FILTER_RULES.filter(
        (r) => !state.rules.some((sr) => sr.id === r.id),
      );

    newRule = available[Math.floor(Math.random() * available.length)];
  }

  state.rules.push(newRule);
  state.activeRuleIndex = state.rules.length - 1;

  generateBoard();

  showOverlay({
    icon: false,
    title: `Level ${state.level} / ${SESSION_LEVELS}`,
    desc:
      state.level === 1
        ? "Follow the rule to clear the board. Rules stack — only the new rule is shown each time."
        : "New rule added. Remember the full stack — only this new rule is shown.",
    ruleText: newRule.text,
    stats: null,
    btn: "Ready",
  });
}

function startPlayingPhase() {
  state.status = "PLAYING";
  met.ruleShiftAt = performance.now();
  met.previousActiveRule = null;
  DOM.overlay.classList.remove("active");
  renderBoard();
  updateHeader();
}

// ── Board generation ──────────────────────────────────────────────────────────

function generateBoard() {
  state.board = sharedGenerateBoard(state.rules);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderBoard() {
  DOM.grid.innerHTML = "";
  state.board.forEach((tile) => {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.dataset.id = tile.id;
    btn.innerHTML = `
            <span class="tile-number">${tile.number}</span>
            <i class="ph-light ${tile.icon}" style="color:${tile.color.hex}"></i>
        `;
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        handleTap(tile.id);
      },
      { passive: false },
    );

    DOM.grid.appendChild(btn);
  });
}

function updateHeader() {
  DOM.level.textContent = `Level ${state.level} / ${SESSION_LEVELS}`;
}

// ── Tap handling ──────────────────────────────────────────────────────────────

function handleTap(tileId) {
  triggerHaptic();
  if (state.status !== "PLAYING") return;
  if (state.activeRuleIndex < 0 || state.activeRuleIndex >= state.rules.length)
    return;

  const tileIndex = state.board.findIndex((t) => t.id === tileId);
  if (tileIndex === -1) return;

  const tile = state.board[tileIndex];
  const currentRule = state.rules[state.activeRuleIndex];

  met.totalTaps++;

  if (currentRule.isValid(tile, state.board)) {
    // ── Correct ──────────────────────────────────────────────────────────

    if (met.ruleShiftAt !== null) {
      met.shiftTimes.push(performance.now() - met.ruleShiftAt);
      met.ruleShiftAt = null;
    }

    state.board.splice(tileIndex, 1);
    document
      .querySelector(`.tile[data-id="${tileId}"]`)
      ?.classList.add("cleared");

    checkBoardState();
  } else {
    // ── Wrong — penalise but continue ────────────────────────────────────
    triggerHapticError();
    met.wrongTaps++;

    if (
      met.previousActiveRule &&
      met.previousActiveRule.isValid(tile, state.board)
    ) {
      met.interferenceErrors++;
    }

    document
      .querySelector(`.tile[data-id="${tileId}"]`)
      ?.classList.add("error");
    setTimeout(
      () =>
        document
          .querySelector(`.tile[data-id="${tileId}"]`)
          ?.classList.remove("error"),
      400,
    );
    // Tile stays on the board — game continues.
  }
}

// ── Board state ───────────────────────────────────────────────────────────────

function checkBoardState() {
  if (state.board.length === 0) {
    levelComplete();
    return;
  }

  while (state.activeRuleIndex >= 0) {
    const rule = state.rules[state.activeRuleIndex];
    const hasValid = state.board.some((t) => rule.isValid(t, state.board));

    if (hasValid) {
      updateHeader();
      return;
    }

    // Rule cleared — shift down to the previous one
    met.previousActiveRule = rule;
    met.ruleShiftAt = performance.now();
    state.activeRuleIndex--;
  }

  // Base rule always has valid tiles while board is non-empty; reaching here is a bug.
  if (state.board.length === 0) levelComplete();
  else {
    console.warn("regles: rule stack exhausted with tiles remaining");
    levelComplete();
  }
}

// ── Level / session end ───────────────────────────────────────────────────────

function levelComplete() {
  state.status = "IDLE";
  const progress = state.level / SESSION_LEVELS;
  setBrainFill(progress, progress);

  if (state.level >= SESSION_LEVELS) {
    setTimeout(endSession, 400);
  } else {
    state.level++;
    setTimeout(setupLevel, 500);
  }
}

function endSession() {
  state.status = "DONE";

  const errorRate =
    met.totalTaps > 0 ? Math.round((met.wrongTaps / met.totalTaps) * 100) : 0;
  const avgSL =
    met.shiftTimes.length > 0
      ? (
          met.shiftTimes.reduce((a, b) => a + b, 0) /
          met.shiftTimes.length /
          1000
        ).toFixed(2)
      : null;
  const ier =
    met.wrongTaps > 0
      ? Math.round((met.interferenceErrors / met.wrongTaps) * 100)
      : 0;

  saveSessionRecord({
    maxLevel: SESSION_LEVELS,
    errorRate,
    avgShiftLatency: avgSL !== null ? parseFloat(avgSL) : null,
    interferenceRate: ier,
  });

  const stats = [
    {
      label: "Error rate",
      value: `${errorRate}%`,
      note: `${met.wrongTaps} wrong of ${met.totalTaps} taps`,
    },
    {
      label: "Shift latency",
      value: avgSL !== null ? `${avgSL}s` : "—",
      note: "avg time after rule change",
    },
    {
      label: "Interference",
      value: `${ier}%`,
      note: "wrong taps matching prior rule",
    },
  ];

  showOverlay({
    icon: true,
    title: "Session done",
    desc: `${SESSION_LEVELS} levels completed.`,
    ruleText: null,
    stats,
    btn: "Play Again",
  });
}

// ── Brain progress ────────────────────────────────────────────────────────────

function setBrainFill(progress, fireFraction = 0) {
  const inset = Math.round(88 - progress * (88 - 8));
  const fireInset = Math.round(88 - fireFraction * (88 - 8));
  document
    .querySelector(".brain-progress-fill")
    .style.setProperty("--progress-inset", inset + "%");
  document
    .querySelector(".brain-fire-fill")
    .style.setProperty("--fire-inset", fireInset + "%");
  FireSystem.update(fireFraction, fireInset);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

FireSystem.init();
initHaptic();
setBrainFill(0);
