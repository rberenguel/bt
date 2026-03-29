import { makeHistoryUI } from "./shared/history.js";
import { makeStorage } from "./shared/storage.js";
import { get, set } from "./shared/idb-keyval.js";
import { initHaptic, triggerHaptic } from "./shared/haptic.js";
import { openRadarModal } from "./radar.js";

// ── App registry ──────────────────────────────────────────────────────────────

export const APP_ORDER = [
  "nb",
  "tanmateix",
  "rot",
  "dotmatrix",
  "safata",
  "llei",
  "regles",
  "mussol",
  "attn",
  "clauer",
  "stop",
  "precis",
  "summum",
  "entrellat",
  "flux",

];

const APPS = [
  {
    id: "nb",
    name: "NB",
    path: "./nb/",
    icon: "./nb/icon.png",
    color: "#e9c46a",
    storageKey: null, // IndexedDB — loaded separately
    keyMetric: (s) => "N-" + s.metrics.level,
    metricDefs: [
      { key: "level", label: "Level", unit: "", invertColor: false },
      { key: "pctPos", label: "Pos", unit: "%", invertColor: false },
      { key: "pctCol", label: "Col", unit: "%", invertColor: false },
      { key: "dOverall", label: "d'", desc: "Sensitivity", unit: "", invertColor: false, format: (v) => v !== null ? v.toFixed(2) : "—" },
    ],
    sessionTitle: (s) =>
      "N-" +
      s.metrics.level +
      (s._triple ? " (triple)" : s._quad ? " (quad)" : ""),
  },
  {
    id: "tanmateix",
    name: "Tanmateix",
    path: "./tanmateix/",
    icon: "./tanmateix/icon.png",
    color: "#9b5de5",
    storageKey: "tanmateix_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    filterDisplay: (s) => s.metrics.total !== undefined,
    metricDefs: [
      { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
      {
        key: "score",
        label: "Score",
        unit: "",
        invertColor: false,
        format: (v, s) =>
          s.metrics.total ? `${v}/${s.metrics.total}` : `${v}/30`,
      },
      { key: "maxStreak", label: "Streak", unit: "", invertColor: false },
      { key: "finalLevel", label: "Level", unit: "", invertColor: false },
    ],
  },
  {
    id: "rot",
    name: "Rot",
    path: "./rot/",
    icon: "./rot/icon.png",
    color: "#f43f5e",
    storageKey: "rot_history",
    keyMetric: (s) => s.metrics.score + " pts",
    metricDefs: [
      { key: "score", label: "Score", unit: "", invertColor: false },
      { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
    ],
  },
  {
    id: "dotmatrix",
    name: "Dot Matrix",
    path: "./dotmatrix/",
    icon: "./dotmatrix/icon.png",
    color: "#d97706",
    storageKey: "dotmatrix_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    metricDefs: [
      {
        key: "accuracy",
        label: "Acc",
        desc: "Correctness",
        unit: "%",
        invertColor: false,
      },
      { key: "correct", label: "Correct", unit: "", invertColor: false },
      { key: "incorrect", label: "Wrong", unit: "", invertColor: true },
    ],
  },
    {
    id: "llei",
    name: "Llei",
    path: "./llei/",
     icon: "./llei/icon.png",
    color: "#34d399",
    storageKey: "llei_history",
    keyMetric: (s) => s.metrics.score + "/5 puzzles",
    metricDefs: [
      { key: "score",      label: "Score",    unit: "",  invertColor: false },
      { key: "accuracy",   label: "Accuracy", unit: "%", invertColor: false },
      { key: "finalLevel", label: "Level",    unit: "",  invertColor: false },
    ],
  },
  {
    id: "regles",
    name: "Regles",
    path: "./regles/",
    icon: "./regles/icon.png",
    color: "#5e5ce6",
    storageKey: "regles_history",
    keyMetric: (s) => s.metrics.errorRate + "% err",
    metricDefs: [
      { key: "errorRate", label: "Errors", desc: "Wrong taps", unit: "%", invertColor: true },
      {
        key: "avgShiftLatency",
        label: "SSL",
        desc: "Shift Latency",
        unit: "s",
        invertColor: true,
        format: (v) => v !== null ? v.toFixed(2) : "—",
      },
      { key: "interferenceRate", label: "IER", desc: "Interference", unit: "%", invertColor: true },
    ],
  },
  {
    id: "mussol",
    name: "Mussol",
    path: "./mussol/",
    icon: "./mussol/icon.png",
    color: "#a855f7",
    storageKey: "mussol_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    metricDefs: [
      {
        key: "accuracy",
        label: "Acc",
        desc: "Correctness",
        unit: "%",
        invertColor: false,
      },
      { key: "correct", label: "Correct", unit: "", invertColor: false },
      { key: "incorrect", label: "Wrong", unit: "", invertColor: true },
    ],
  },
  
  {
    id: "attn",
    name: "Attn",
    path: "./attn/",
    icon: "./attn/icon.png",
    color: "#38bdf8",
    storageKey: "attn_history",
    keyMetric: (s) => s.metrics.eb + " EB",
    metricDefs: [
      { key: "eb", label: "Eff. balls", unit: "", invertColor: false },
      { key: "balls", label: "Balls", unit: "", invertColor: false },
      { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
    ],
  },
  {
    id: "clauer",
    name: "Clauer",
    path: "./clauer/",
    icon: "./clauer/icon.png",
    color: "#2a9d8f",
    storageKey: "clauer_history",
    keyMetric: (s) => s.metrics.cpm + " CPM",
    metricDefs: [
      {
        key: "cpm",
        label: "CPM",
        desc: "Throughput",
        unit: "",
        invertColor: false,
      },
      {
        key: "accuracy",
        label: "Accuracy",
        desc: "Correctness",
        unit: "%",
        invertColor: false,
      },
      {
        key: "cv",
        label: "CV",
        desc: "Stability",
        unit: "%",
        invertColor: true,
      },
      {
        key: "ies",
        label: "IES",
        desc: "Efficiency",
        unit: "",
        invertColor: true,
      },
    ],
  },
  {
    id: "stop",
    name: "Stop",
    path: "./stop/",
    icon: "./stop/icon.png",
    color: "#457b9d",
    storageKey: "stop_history",
    keyMetric: (s) => Math.round(s.metrics.stopAcc) + "% stop",
    metricDefs: [
      { key: "goAcc", label: "Go acc", unit: "%", invertColor: false },
      { key: "stopAcc", label: "Stop acc", unit: "%", invertColor: false },
      { key: "avgRt", label: "Avg RT", unit: "ms", invertColor: true },
    ],
  },
  {
    id: "precis",
    name: "Precís",
    path: "./precis/",
    icon: "./precis/icon.png",
    color: "#818cf8",
    storageKey: "precis_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    metricDefs: [
      { key: "score",      label: "Score",   unit: "",  invertColor: false },
      { key: "accuracy",   label: "Overall", unit: "%", invertColor: false },
      { key: "scopeAcc",   label: "Scope",   unit: "%", invertColor: false },
      { key: "literalAcc", label: "Literal", unit: "%", invertColor: false },
      { key: "finalLevel", label: "Level",   unit: "",  invertColor: false },
    ],
  },
  {
    id: "summum",
    name: "Summum",
    path: "./summum/",
    icon: "./summum/icon.png",
    color: "#e63946",
    storageKey: "summum_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    metricDefs: [
      {
        key: "accuracy",
        label: "Acc",
        desc: "Correctness",
        unit: "%",
        invertColor: false,
      },
      {
        key: "finalPace",
        label: "Final",
        desc: "Pace",
        unit: "s",
        invertColor: true,
      },
      {
        key: "bestPace",
        label: "Best",
        desc: "Pace",
        unit: "s",
        invertColor: true,
      },
    ],
  },
  {
    id: "entrellat",
    name: "Entrellat",
    path: "./entrellat/",
    icon: "./entrellat/icon.png",
    color: "#22d3ee",
    storageKey: "entrellat_history",
    keyMetric: (s) => s.metrics.solved + " solved",
    metricDefs: [
      { key: "solved", label: "Solved", unit: "", invertColor: false },
      { key: "failed", label: "Failed", unit: "", invertColor: true },
      { key: "total", label: "Total", unit: "", invertColor: false },
    ],
  },
  {
    id: "flux",
    name: "Flow",
    path: "./flux/",
    icon: "./flux/icon.png",
    color: "#6366f1",
    storageKey: "flux_history",
    keyMetric: (s) => s.metrics.pmHitRate + "% PM",
    metricDefs: [
      { key: "pmHitRate", label: "PM hits", unit: "%", invertColor: false },
      { key: "falseAlarmRate", label: "False alarms", unit: "%", invertColor: true },
      { key: "missRate", label: "Misses", unit: "%", invertColor: true },
      { key: "rtCost", label: "RT cost", unit: "ms", invertColor: true },
      { key: "level", label: "Level", unit: "", invertColor: false },
    ],
  },
  {
    id: "safata",
    name: "Safata",
    path: "./safata/",
    icon: "./safata/icon.png",
    color: "#FF595E",
    storageKey: "safata_history",
    keyMetric: (s) => s.metrics.redAccuracy + "% red",
    metricDefs: [
      { key: "redAccuracy",     label: "Red accuracy",       unit: "%", invertColor: false },
      { key: "yellowAccuracy",  label: "Yellow accuracy",    unit: "%", invertColor: false },
      { key: "tilesReachedRed", label: "Contexts memorised", unit: "",  invertColor: false },
    ],
  },
];

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadNbSessions() {
  try {
    const raw = (await get("sessions")) || [];
    // Normalise into standard { timestamp, dateStr, metrics, _triple, _quad }
    return raw
      .map((s) => ({
        timestamp: s.date,
        dateStr: new Date(s.date).toISOString().split("T")[0],
        metrics: {
          level: s.level,
          pctPos: Math.round(s.pctPos),
          pctCol: Math.round(s.pctCol),
          pctLet: s.triple ? Math.round(s.pctLet) : null,
          pctShape: s.quad ? Math.round(s.pctShape) : null,
          dPos: s.dPos ?? null,
          dCol: s.dCol ?? null,
          dLet: s.dLet ?? null,
          dShape: s.dShape ?? null,
          dOverall: s.dOverall ?? null,
        },
        _triple: s.triple,
        _quad: s.quad,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

// ── Streak calculation ────────────────────────────────────────────────────────

function daysWithSessions(sessions) {
  const set = new Set();
  sessions.forEach((s) => {
    const d = new Date(s.timestamp);
    set.add(d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate());
  });
  return set;
}

function computeStreak(daySets) {
  const combined = new Set();
  daySets.forEach((s) => s.forEach((d) => combined.add(d)));
  if (combined.size === 0) return 0;

  const check = new Date();
  check.setHours(0, 0, 0, 0);
  const key = (d) => d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  if (!combined.has(key(check))) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (combined.has(key(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function sessionsThisWeek(sessions) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => s.timestamp >= cutoff).length;
}

function lastSessionDate(sessions) {
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  return new Date(last.timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderStreak(streak) {
  const el = document.getElementById("streak");
  if (streak > 0) {
    el.textContent = "🔥 " + streak + "-day streak";
    el.style.display = "";
  } else {
    el.style.display = "none";
  }
}

function renderCards(appData) {
  const grid = document.getElementById("app-grid");
  grid.innerHTML = "";

  appData.forEach(({ app, sessions }) => {
    const displaySessions = app.filterDisplay
      ? sessions.filter(app.filterDisplay)
      : sessions;

    // Use full sessions array for activity tracking (streak, last played, total this week)
    const last = lastSessionDate(sessions);
    const week = sessionsThisWeek(sessions);

    // Use filtered sessions array ONLY for specific stat values (score, accuracy, etc)
    const latest = displaySessions.length
      ? displaySessions[displaySessions.length - 1]
      : null;
    const keyM = latest && app.keyMetric ? app.keyMetric(latest) : null;

    const hasHistory = app.metricDefs && displaySessions.length > 0;

    const card = document.createElement("div");
    card.className = "app-card" + (hasHistory ? " has-history" : "");
    card.style.setProperty("--app-color", app.color);

    card.innerHTML =
      '<div class="app-name">' +
      app.name +
      "</div>" +
      '<div class="app-body">' +
      '<a class="app-link" href="' +
      app.path +
      '">' +
      (app.icon ? '<img class="app-icon" src="' + app.icon + '" alt="">' : "") +
      '<div class="app-info">' +
      (last
        ? '<div class="app-last">' + last + "</div>"
        : '<div class="app-last muted">No sessions yet</div>') +
      (week > 0 ? '<div class="app-week">' + week + " this week</div>" : "") +
      (keyM ? '<div class="app-metric">' + keyM + "</div>" : "") +
      "</div>" +
      "</a>" +
      (hasHistory
        ? '<button class="stats-btn" title="Show stats"><i class="ph-light ph-chart-bar"></i></button>'
        : "") +
      "</div>";

    card.querySelector(".app-link").addEventListener("click", () => {
      triggerHaptic();
    });

    if (hasHistory) {
      const histUI = makeHistoryUI({
        getHistory: () => sessions,
        metricDefs: app.metricDefs,
        listElId: "history-list",
        modalElId: "history-modal",
        sessionTitle: app.sessionTitle || null,
        filterDisplay: app.filterDisplay || null,
      });

      card.querySelector(".stats-btn").addEventListener("pointerdown", (e) => {
        e.preventDefault();
        triggerHaptic();
        document.getElementById("history-modal-title").textContent =
          app.name + " — History";
        histUI.open();
      });
    }

    grid.appendChild(card);
  });
}

// ── Modal close ───────────────────────────────────────────────────────────────

function initModal() {
  const modal = document.getElementById("history-modal");
  const closeBtn = document.getElementById("close-history-btn");
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    triggerHaptic();
    modal.classList.add("hidden");
  });
  modal.addEventListener("pointerdown", (e) => {
    if (e.target === modal) {
      e.preventDefault();
      triggerHaptic();
      modal.classList.add("hidden");
    }
  });
}

// ── Data export / import ──────────────────────────────────────────────────────

async function exportData() {
  triggerHaptic();
  const nbRaw = (await get("sessions")) || [];
  const appHistories = {};
  for (const app of APPS) {
    if (app.storageKey) {
      appHistories[app.storageKey] = await makeStorage(
        app.storageKey,
      ).getHistory();
    }
  }

  const payload = JSON.stringify(
    {
      exported: new Date().toISOString(),
      version: 1,
      data: { sessions: nbRaw, ...appHistories },
    },
    null,
    2,
  );

  const filename = `bt-backup-${new Date().toISOString().split("T")[0]}.json`;
  const blob = new Blob([payload], { type: "application/json" });

  if (navigator.canShare) {
    const file = new File([blob], filename, { type: "application/json" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "BT Backup" });
      return;
    }
  }

  // Fallback: direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload.data) throw new Error("Invalid backup file");

    // Merge NB sessions (keyed by .date)
    if (Array.isArray(payload.data.sessions)) {
      const existing = (await get("sessions")) || [];
      const byDate = new Map(existing.map((s) => [s.date, s]));
      for (const s of payload.data.sessions) byDate.set(s.date, s);
      await set(
        "sessions",
        [...byDate.values()].sort((a, b) => a.date - b.date),
      );
    }

    // Merge all other apps (keyed by .timestamp)
    for (const app of APPS) {
      if (!app.storageKey || !Array.isArray(payload.data[app.storageKey]))
        continue;
      const existing = await makeStorage(app.storageKey).getHistory();
      const byTs = new Map(existing.map((s) => [s.timestamp, s]));
      for (const s of payload.data[app.storageKey]) byTs.set(s.timestamp, s);
      await set(
        app.storageKey,
        [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp),
      );
    }

    triggerHaptic();
    location.reload();
  } catch (e) {
    console.error("Import failed", e);
    alert("Import failed: " + e.message);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initHaptic();
  initModal();

  document.getElementById("export-btn").addEventListener("click", exportData);
  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  // Load all session data
  const nbSessions = await loadNbSessions();

  let appData = await Promise.all(
    APPS.map(async (app) => ({
      app,
      sessions:
        app.id === "nb"
          ? nbSessions
          : app.storageKey
            ? await makeStorage(app.storageKey).getHistory()
            : [],
    })),
  );

  appData.sort((a, b) => {
    const ai = APP_ORDER.indexOf(a.app.id);
    const bi = APP_ORDER.indexOf(b.app.id);
    return (ai !== -1 ? ai : 999) - (bi !== -1 ? bi : 999);
  });

  // Cross-app streak
  const daySets = appData.map(({ sessions }) => daysWithSessions(sessions));
  renderStreak(computeStreak(daySets));
  renderCards(appData);

  // Radar
  const radarModal = document.getElementById("radar-modal");
  document.getElementById("radar-btn").addEventListener("click", () => {
    triggerHaptic();
    openRadarModal(appData);
  });
  document.getElementById("close-radar-btn").addEventListener("click", () => {
    triggerHaptic();
    radarModal.classList.add("hidden");
  });
  radarModal.addEventListener("pointerdown", (e) => {
    if (e.target === radarModal) {
      triggerHaptic();
      radarModal.classList.add("hidden");
    }
  });
}

init();
