import { initHaptic, triggerHaptic } from "../shared/haptic.js";
import { FireSystem } from "../shared/fire.js";
import { pickRules } from "../shared/rules/engine.js";
import { makeTaskScreen } from "../shared/rules/ui.js";
import { saveSessionRecord } from "./storage.js";
import { openHistoryModal } from "./history.js";

// ── Tuning constants ──────────────────────────────────────────────────────────

const N_ACTIVE_TILES = 9; // Total workstreams in the session
const RULE_VISIBLE_VISITS = 1; // Visit 0 shows the rule; 1+ hide it
const RED_COMPLETIONS_TARGET = 25; // Session ends after this many recall tasks
const P_REWORK = 0.6; // Probability a completed tile re-lights next turn
const COOLDOWN_K = 3; // Number of other tiles that must be visited before re-lighting

// Day arc: tiles unlock in waves as visits accumulate (simulates a slow morning → chaotic afternoon)
const WAVE_SCHEDULE = [2, 1, 1, 1, 1, 1, 1, 1]; // tiles per wave, must sum to N_ACTIVE_TILES
const WAVE_TRIGGER_VISITS = 1; // every visit unlocks the next tile until full board

// ── CC tile definitions — 24 available, 12 picked randomly each session ───────
// Icons are intentionally abstract — semantic but not work-literal

const CC_TILE_DEFS = [
  { icon: "ph-crown" },
  { icon: "ph-moon-stars" },
  { icon: "ph-mountains" },
  { icon: "ph-person-simple-hike" },
  { icon: "ph-anchor" },
  { icon: "ph-compass" },
  { icon: "ph-diamond" },
  { icon: "ph-flame" },
  { icon: "ph-leaf" },
  { icon: "ph-feather" },
  { icon: "ph-snowflake" },
  { icon: "ph-lighthouse" },
  { icon: "ph-planet" },
  { icon: "ph-waves" },
  { icon: "ph-butterfly" },
  { icon: "ph-skull" },
  { icon: "ph-eye" },
  { icon: "ph-key" },
  { icon: "ph-boat" },
  { icon: "ph-sun" },
  { icon: "ph-umbrella" },
  { icon: "ph-cactus" },
  { icon: "ph-guitar" },
  { icon: "ph-hourglass" },
];

const N_TILE_DEFS = 12; // how many of the 24 to use each session

// ── State ─────────────────────────────────────────────────────────────────────

let tiles = []; // Array of 12 tile descriptors
let screen = "IDLE"; // "IDLE" | "CC" | "TASK" | "DONE"
let currentTileId = null;
let taskScreenInst = null;
let currentWave = 0; // highest wave unlocked so far
let met = freshMetrics();

function freshMetrics() {
  return {
    redCompletions: 0,
    redTotalTaps: 0,
    redWrongTaps: 0,
    yellowTotalTaps: 0,
    yellowWrongTaps: 0,
    totalVisits: 0,
  };
}

// ── DOM ───────────────────────────────────────────────────────────────────────

const DOM = {
  ccView: document.getElementById("cc-view"),
  taskView: document.getElementById("task-view"),
  taskCont: document.getElementById("task-container"),
  ccGrid: document.getElementById("cc-grid"),
  overlay: document.getElementById("overlay"),
  oTitle: document.getElementById("overlay-title"),
  oDesc: document.getElementById("overlay-desc"),
  oStats: document.getElementById("overlay-stats"),
  oBtn: document.getElementById("overlay-btn"),
  oIcon: document.getElementById("overlay-icon"),
  status: document.getElementById("status-display"),
};

// ── Boot ──────────────────────────────────────────────────────────────────────

FireSystem.init();
initHaptic();
setBrainFill(0);

(async () => {
  try {
    const m = await (await fetch("manifest.json")).json();
    if (m.version)
      document.getElementById("app-version").textContent = "v" + m.version;
  } catch {}
})();

document.getElementById("hub-link").addEventListener("click", triggerHaptic);
DOM.oBtn.addEventListener("click", () => {
  triggerHaptic();
  if (screen === "IDLE" || screen === "DONE") startSession();
});

document.getElementById("brain-container")?.addEventListener("click", () => {
  triggerHaptic();
  openHistoryModal();
});

document.getElementById("close-history-btn")?.addEventListener("click", () => {
  triggerHaptic();
  document.getElementById("history-modal").classList.add("hidden");
});

document
  .getElementById("history-modal")
  ?.addEventListener("pointerdown", (e) => {
    if (e.target === document.getElementById("history-modal")) {
      document.getElementById("history-modal").classList.add("hidden");
    }
  });

document.getElementById("history-modal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("history-modal")) {
    triggerHaptic();
  }
});

// ── Session setup ─────────────────────────────────────────────────────────────

function startSession() {
  met = freshMetrics();
  setBrainFill(0);
  DOM.overlay.classList.remove("active");
  initSession();
}

function initSession() {
  currentWave = 0;

  // Shuffle positions and pick N_ACTIVE_TILES of them
  const positions = Array.from({ length: 12 }, (_, i) => i).sort(
    () => Math.random() - 0.5,
  );
  const activeSet = new Set(positions.slice(0, N_ACTIVE_TILES));

  // One unique rule per active tile
  const rules = pickRules(N_ACTIVE_TILES);

  // Build wave assignments: e.g. [0,0,1,1,2,3,3,4,4], then shuffle
  // so wave membership is random across tile positions
  const waveAssignments = WAVE_SCHEDULE.flatMap((count, w) =>
    Array(count).fill(w),
  ).sort(() => Math.random() - 0.5);

  const shuffledDefs = [...CC_TILE_DEFS]
    .sort(() => Math.random() - 0.5)
    .slice(0, N_TILE_DEFS);

  let activeCount = 0;
  tiles = shuffledDefs.map((def, i) => {
    const isActive = activeSet.has(i);
    const wave = isActive ? waveAssignments[activeCount] : null;
    const rule = isActive ? rules[activeCount] : null;
    if (isActive) activeCount++;
    const isWave0 = isActive && wave === 0;

    return {
      id: i,
      icon: def.icon,
      active: isActive,
      rule,
      wave,
      staged: isActive && !isWave0, // waves 1+ wait for their unlock
      idleColor: Math.random() < 0.5 ? "blue" : "green",
      visitCount: 0,
      hasWork: isWave0, // only wave-0 tiles start lit
      justProcessed: false,
      cooldown: 0,
      turnsLit: 0,
    };
  });

  screen = "CC";
  showCC();
}

// ── CC rendering ──────────────────────────────────────────────────────────────

function showCC() {
  screen = "CC";
  DOM.ccView.classList.remove("hidden");
  DOM.taskView.classList.add("hidden");
  DOM.status.textContent = "Command Centre";
  renderCC();
}

function renderCC() {
  DOM.ccGrid.innerHTML = "";
  tiles.forEach((tile) => {
    const btn = document.createElement("button");
    btn.className = "cc-tile";
    btn.dataset.id = tile.id;

    if (!tile.active || tile.staged) {
      btn.classList.add("cc-tile--inactive");
      btn.disabled = true;
    } else if (!tile.hasWork) {
      btn.classList.add(`cc-tile--idle-${tile.idleColor}`);
      btn.disabled = true;
      btn.innerHTML = `<i class="ph-light ${tile.icon}"></i>`;
    } else if (tile.visitCount >= RULE_VISIBLE_VISITS) {
      btn.classList.add("cc-tile--red");
      btn.innerHTML = `<i class="ph-light ${tile.icon}"></i>`;
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          handleCCTap(tile.id);
        },
        { passive: false },
      );
    } else {
      btn.classList.add("cc-tile--yellow");
      btn.innerHTML = `<i class="ph-light ${tile.icon}"></i>`;
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          handleCCTap(tile.id);
        },
        { passive: false },
      );
    }

    DOM.ccGrid.appendChild(btn);
  });
}

// ── CC tap → task screen ──────────────────────────────────────────────────────

function handleCCTap(tileId) {
  if (screen !== "CC") return;
  const tile = tiles[tileId];
  if (!tile || !tile.hasWork || !tile.active) return;
  triggerHaptic();
  currentTileId = tileId;
  enterTaskScreen(tile);
}

function enterTaskScreen(tile) {
  screen = "TASK";
  DOM.ccView.classList.add("hidden");
  DOM.taskView.classList.remove("hidden");
  DOM.status.textContent = "";

  if (taskScreenInst) {
    taskScreenInst.destroy();
    taskScreenInst = null;
  }

  const showRule = tile.visitCount < RULE_VISIBLE_VISITS;

  taskScreenInst = makeTaskScreen({
    containerEl: DOM.taskCont,
    rule: tile.rule,
    showRule,
    contextIcon: tile.icon,
    contextLabel: tile.icon.replace("ph-", ""),
    onComplete: (result) => onTaskComplete(result, showRule),
  });
}

// ── Task complete → back to CC ────────────────────────────────────────────────

function onTaskComplete(result, wasRuleVisible) {
  const { totalTaps, wrongTaps } = result;

  if (wasRuleVisible) {
    met.yellowTotalTaps += totalTaps;
    met.yellowWrongTaps += wrongTaps;
  } else {
    met.redTotalTaps += totalTaps;
    met.redWrongTaps += wrongTaps;
    met.redCompletions++;
  }
  met.totalVisits++;

  if (taskScreenInst) {
    taskScreenInst.destroy();
    taskScreenInst = null;
  }

  runTurnUpdate(currentTileId);
  setBrainFill(met.redCompletions / RED_COMPLETIONS_TARGET);

  if (met.redCompletions >= RED_COMPLETIONS_TARGET) {
    screen = "DONE";
    setTimeout(endSession, 500);
  } else {
    showCC();
  }
}

// ── Wave unlock ───────────────────────────────────────────────────────────────

function unlockWave(wave) {
  tiles.forEach((t) => {
    if (t.active && t.staged && t.wave === wave) {
      t.staged = false;
      t.hasWork = true;
      t.turnsLit = 0;
    }
  });
}

// ── Turn update algorithm ─────────────────────────────────────────────────────

function runTurnUpdate(tileId) {
  const tile = tiles[tileId];
  tile.visitCount++;
  tile.hasWork = false;
  tile.turnsLit = 0; // successfully completed
  tile.cooldown = COOLDOWN_K;

  let inboxBlocked = false;

  // Update state for all OTHER active, non-staged tiles
  tiles.forEach((t) => {
    if (t.active && !t.staged && t.id !== tileId) {
      if (t.hasWork) {
        // If it's already lit, age it. If ignored too long, block inbox
        t.turnsLit = (t.turnsLit || 0) + 1;
        if (t.turnsLit >= 3) {
          inboxBlocked = true;
        }
      } else {
        t.turnsLit = 0;
        // If unlit and on cooldown, cool it down
        if (t.cooldown > 0) t.cooldown--;
      }
    }
  });

  // Re-light eligible idle tiles if the inbox isn't blocked by an old task
  if (!inboxBlocked) {
    tiles.forEach((t) => {
      if (
        t.active &&
        !t.staged &&
        t.id !== tileId &&
        !t.hasWork &&
        t.cooldown === 0
      ) {
        if (Math.random() < P_REWORK) {
          t.hasWork = true;
          t.turnsLit = 0;
        }
      }
    });
  }

  // Invariant: at least one lit tile must exist (T excluded — it just did work).
  if (
    !tiles.some((t) => t.active && !t.staged && t.hasWork && t.id !== tileId)
  ) {
    const candidates = tiles.filter(
      (t) => t.active && !t.staged && t.id !== tileId,
    );
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      picked.hasWork = true;
      picked.turnsLit = 0;
    } else {
      tile.hasWork = true; // only one active tile; re-light immediately
      tile.turnsLit = 0;
    }
  }

  // Unlock the next wave if enough visits have accumulated
  const waveTarget = Math.floor(met.totalVisits / WAVE_TRIGGER_VISITS);
  while (currentWave < waveTarget && currentWave < WAVE_SCHEDULE.length - 1) {
    currentWave++;
    unlockWave(currentWave);
  }
}

// ── Session end ───────────────────────────────────────────────────────────────

function endSession() {
  const activeTiles = tiles.filter((t) => t.active);
  const redAccuracy =
    met.redTotalTaps > 0
      ? Math.round((1 - met.redWrongTaps / met.redTotalTaps) * 100)
      : 100;
  const yellowAccuracy =
    met.yellowTotalTaps > 0
      ? Math.round((1 - met.yellowWrongTaps / met.yellowTotalTaps) * 100)
      : 100;
  const tilesReachedRed = activeTiles.filter(
    (t) => t.visitCount >= RULE_VISIBLE_VISITS,
  ).length;
  const avgVisitsPerTile =
    activeTiles.length > 0
      ? parseFloat((met.totalVisits / activeTiles.length).toFixed(1))
      : 0;

  saveSessionRecord({
    redCompletions: met.redCompletions,
    redAccuracy,
    yellowAccuracy,
    tilesReachedRed,
    avgVisitsPerTile,
  });

  DOM.oIcon.classList.remove("hidden");
  DOM.oTitle.textContent = "Session done";
  DOM.oDesc.textContent = `${RED_COMPLETIONS_TARGET} memory recalls completed.`;

  DOM.oStats.innerHTML = [
    {
      label: "Red accuracy",
      value: `${redAccuracy}%`,
      note: `${met.redWrongTaps} wrong of ${met.redTotalTaps} taps`,
    },
    {
      label: "Yellow accuracy",
      value: `${yellowAccuracy}%`,
      note: "rule visible",
    },
    {
      label: "Contexts memorised",
      value: `${tilesReachedRed}`,
      note: "tiles reached recall state",
    },
    { label: "Avg visits / tile", value: `${avgVisitsPerTile}`, note: "" },
  ]
    .map(
      ({ label, value, note }) =>
        `<div class="stat-row">` +
        `<span class="stat-label">${label}</span>` +
        `<span>` +
        `<span class="stat-value">${value}</span>` +
        (note ? `<div class="stat-desc">${note}</div>` : "") +
        `</span>` +
        `</div>`,
    )
    .join("");
  DOM.oStats.classList.remove("hidden");

  DOM.oBtn.textContent = "Play Again";
  document.getElementById("hub-link").classList.remove("hidden");
  DOM.overlay.classList.add("active");
}

// ── Brain progress ────────────────────────────────────────────────────────────

function setBrainFill(progress, fireFraction = progress) {
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
