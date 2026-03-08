import { makeHistoryUI } from "./shared/history.js";
import { get } from "./nb/lib/idb-keyval.js";

// ── App registry ──────────────────────────────────────────────────────────────

const APPS = [
  {
    id: "nb",
    name: "NB",
    path: "./nb/",
    icon: "./nb/icon.png",
    color: "#e9c46a",
    storageKey: null,   // IndexedDB — loaded separately
    keyMetric: (s) => "N-" + s.metrics.level,
    metricDefs: [
      { key: "level",  label: "Level", unit: "",  invertColor: false },
      { key: "pctPos", label: "Pos",   unit: "%", invertColor: false },
      { key: "pctCol", label: "Col",   unit: "%", invertColor: false },
    ],
    sessionTitle: (s) =>
      "N-" + s.metrics.level + (s._triple ? " (triple)" : s._quad ? " (quad)" : ""),
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
      { key: "cpm",      label: "CPM",      desc: "Throughput",  unit: "",  invertColor: false },
      { key: "accuracy", label: "Accuracy", desc: "Correctness", unit: "%", invertColor: false },
      { key: "cv",       label: "CV",       desc: "Stability",   unit: "%", invertColor: true  },
      { key: "ies",      label: "IES",      desc: "Efficiency",  unit: "",  invertColor: true  },
    ],
  },
  {
    id: "tanmateix",
    name: "Tanmateix",
    path: "./tanmateix/",
    icon: "./tanmateix/icon.png",
    color: "#9b5de5",
    storageKey: "tanmateix_history",
    keyMetric: (s) => Math.round(s.metrics.accuracy) + "% acc",
    metricDefs: [
      { key: "accuracy",   label: "Accuracy", unit: "%",  invertColor: false },
      { key: "score",      label: "Score",    unit: "/50", invertColor: false },
      { key: "maxStreak",  label: "Streak",   unit: "",    invertColor: false },
      { key: "finalLevel", label: "Level",    unit: "",    invertColor: false },
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
      { key: "accuracy",  label: "Acc",   desc: "Correctness", unit: "%", invertColor: false },
      { key: "finalPace", label: "Final", desc: "Pace",        unit: "s", invertColor: true  },
      { key: "bestPace",  label: "Best",  desc: "Pace",        unit: "s", invertColor: true  },
    ],
  },
  {
    id: "stop",
    name: "Stop",
    path: "./stop/",
    icon: "./stop/icon.png",
    color: "#457b9d",
    storageKey: "stop_history",
    keyMetric: (s) => Math.round(s.metrics.goAcc) + "% go",
    metricDefs: [
      { key: "goAcc",   label: "Go acc",   unit: "%",  invertColor: false },
      { key: "stopAcc", label: "Stop acc", unit: "%",  invertColor: false },
      { key: "avgRt",   label: "Avg RT",   unit: "ms", invertColor: true  },
    ],
  },
];

// ── Data loading ──────────────────────────────────────────────────────────────

function readLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

async function loadNbSessions() {
  try {
    const raw = (await get("sessions")) || [];
    // Normalise into standard { timestamp, dateStr, metrics, _triple, _quad }
    return raw
      .map((s) => ({
        timestamp: s.date,
        dateStr: new Date(s.date).toISOString().split("T")[0],
        metrics: {
          level:  s.level,
          pctPos: Math.round(s.pctPos),
          pctCol: Math.round(s.pctCol),
        },
        _triple: s.triple,
        _quad:   s.quad,
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
    const last = lastSessionDate(sessions);
    const week = sessionsThisWeek(sessions);
    const latest = sessions.length ? sessions[sessions.length - 1] : null;
    const keyM = latest && app.keyMetric ? app.keyMetric(latest) : null;

    const hasHistory = app.metricDefs && sessions.length > 0;

    const card = document.createElement("div");
    card.className = "app-card" + (hasHistory ? " has-history" : "");
    card.style.setProperty("--app-color", app.color);

    card.innerHTML =
      '<a class="app-link" href="' + app.path + '">' +
        (app.icon ? '<img class="app-icon" src="' + app.icon + '" alt="">' : '') +
        '<div class="app-info">' +
          '<div class="app-name">' + app.name + "</div>" +
          (last
            ? '<div class="app-last">Last: ' + last + "</div>"
            : '<div class="app-last muted">No sessions yet</div>') +
          (week > 0
            ? '<div class="app-week">' + week + " this week</div>"
            : "") +
          (keyM ? '<div class="app-metric">' + keyM + "</div>" : "") +
        "</div>" +
      "</a>" +
      (hasHistory
        ? '<button class="stats-btn" title="Show stats"><i class="ph-light ph-chart-bar"></i></button>'
        : "");

    if (hasHistory) {
      const histUI = makeHistoryUI({
        getHistory: () => sessions,
        metricDefs: app.metricDefs,
        listElId: "history-list",
        modalElId: "history-modal",
        sessionTitle: app.sessionTitle || null,
      });

      card.querySelector(".stats-btn").addEventListener("click", (e) => {
        e.preventDefault();
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
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initModal();

  // Load all session data
  const nbSessions = await loadNbSessions();

  const appData = APPS.map((app) => ({
    app,
    sessions: app.id === "nb" ? nbSessions
             : app.storageKey    ? readLocalStorage(app.storageKey)
             : [],
  }));

  // Cross-app streak
  const daySets = appData.map(({ sessions }) => daysWithSessions(sessions));
  renderStreak(computeStreak(daySets));
  renderCards(appData);
}

init();
