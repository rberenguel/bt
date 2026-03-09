/**
 * Shared parameterised history UI (calendar + trends + day details).
 *
 * Usage:
 *   const { open } = makeHistoryUI({
 *     getHistory,          // () => session[]
 *     metricDefs,          // [{ key, label, unit, invertColor, desc? }]
 *     listElId,            // id of the container div  (default "history-list")
 *     modalElId,           // id of the modal element  (default "history-modal")
 *     openModal,           // optional (el) => void    (default: remove "hidden")
 *     sessionTitle,        // optional (session, i) => string
 *   });
 *   open();
 *
 * metricDefs drives both the trend charts and the per-session stat lines in
 * day-detail cards.  Tap a trend bar to see its value (tooltip).
 */

const iconArrowUp =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
const iconArrowDown =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
const iconCheck =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

export function makeHistoryUI({
  getHistory,
  metricDefs,
  listElId = "history-list",
  modalElId = "history-modal",
  openModal = null,
  sessionTitle = null,
  filterDisplay = null,
}) {
  let currentViewDate = new Date();
  let currentSessions = [];

  const doOpenModal = openModal || ((el) => el.classList.remove("hidden"));
  const getTitle = sessionTitle || ((_, i) => "Session " + (i + 1));

  function open() {
    currentViewDate = new Date();
    const listEl = document.getElementById(listElId);
    const modalEl = document.getElementById(modalElId);

    Promise.resolve(getHistory()).then((sessions) => {
      currentSessions = sessions;
      if (currentSessions.length === 0) {
        listEl.innerHTML =
          "<p style='text-align:center; opacity:0.7; margin-top:2rem;'>No history yet. Play a game!</p>";
        doOpenModal(modalEl);
        return;
      }
      renderCalendar(currentSessions);
      doOpenModal(modalEl);
    });
  }

  function computeStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    const daySet = new Set();
    sessions.forEach((s) => {
      const d = new Date(s.timestamp);
      daySet.add(d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate());
    });
    const check = new Date();
    check.setHours(0, 0, 0, 0);
    const key = (d) => d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (!daySet.has(key(check))) check.setDate(check.getDate() - 1);
    let streak = 0;
    while (daySet.has(key(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return streak;
  }

  function renderCalendar(sessions) {
    const listEl = document.getElementById(listElId);
    const displaySessions = filterDisplay
      ? sessions.filter(filterDisplay)
      : sessions;
    const legacySessions = filterDisplay
      ? sessions.filter((s) => !filterDisplay(s))
      : [];

    if (!sessions || sessions.length === 0) {
      listEl.innerHTML =
        '<p style="opacity: 0.7; text-align: center;">No completed sessions yet.</p>';
      return;
    }

    const sessionsByDate = {};
    displaySessions.forEach((s) => {
      const d = new Date(s.timestamp);
      const key =
        d.getFullYear() +
        "-" +
        String(d.getMonth()).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      if (!sessionsByDate[key]) sessionsByDate[key] = [];
      sessionsByDate[key].push(s);
    });

    const legacyByDate = {};
    legacySessions.forEach((s) => {
      const d = new Date(s.timestamp);
      const key =
        d.getFullYear() +
        "-" +
        String(d.getMonth()).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      if (!legacyByDate[key]) legacyByDate[key] = 0;
      legacyByDate[key]++;
    });

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay() - 1;
    if (startDow === -1) startDow = 6;

    const monthName = currentViewDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const streak = computeStreak(sessions);
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() === month;

    let html =
      '<div class="calendar-header">' +
      '<button class="calendar-nav" id="prev-month">&larr;</button>' +
      "<h3>" +
      monthName +
      "</h3>" +
      '<button class="calendar-nav" id="next-month">&rarr;</button>' +
      "</div>" +
      (streak > 0
        ? '<div class="calendar-streak">🔥 ' + streak + "-day streak</div>"
        : "") +
      '<div class="calendar-grid">' +
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        .map((d) => '<div class="calendar-day-header">' + d + "</div>")
        .join("");

    for (let i = 0; i < startDow; i++)
      html += '<div class="calendar-day empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey =
        year +
        "-" +
        String(month).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0");
      const daySessions = sessionsByDate[dateKey] || [];
      const legacyCount = legacyByDate[dateKey] || 0;
      const isToday = isCurrentMonth && today.getDate() === day;
      const cls =
        "calendar-day" +
        (isToday ? " today" : "") +
        (daySessions.length
          ? " has-sessions"
          : legacyCount
            ? " has-legacy"
            : "");
      html +=
        '<div class="' +
        cls +
        '" data-date="' +
        dateKey +
        '">' +
        '<div class="calendar-day-number">' +
        day +
        "</div>" +
        (daySessions.length
          ? '<div class="session-indicator">' + daySessions.length + "</div>"
          : legacyCount
            ? '<div class="session-indicator legacy-indicator">·</div>'
            : "") +
        "</div>";
    }

    html += "</div>";
    html += renderTrends(displaySessions);
    html += '<div id="day-details" class="day-details hidden"></div>';
    listEl.innerHTML = html;

    document.getElementById("prev-month").addEventListener("click", (e) => {
      e.stopPropagation();
      currentViewDate.setMonth(currentViewDate.getMonth() - 1);
      renderCalendar(currentSessions);
    });
    document.getElementById("next-month").addEventListener("click", (e) => {
      e.stopPropagation();
      currentViewDate.setMonth(currentViewDate.getMonth() + 1);
      renderCalendar(currentSessions);
    });
    document.querySelectorAll(".calendar-day.has-sessions").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showDayDetails(el.dataset.date, sessionsByDate[el.dataset.date] || []);
      });
    });
  }

  function renderTrends(displaySessions) {
    const recent = [...displaySessions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15)
      .reverse();
    if (recent.length < 2) return "";

    let html = '<div class="history-trends">';
    metricDefs.forEach((m) => {
      const values = recent.map((s) => s.metrics[m.key] ?? 0);
      const max = Math.max(...values, 1);
      const min = Math.min(...values);
      const range = max - min;
      const padding = range * 0.1;
      const chartMax = max;
      const chartMin = Math.max(0, min - padding);

      let bars = "";
      values.forEach((val) => {
        const h =
          range > 0
            ? Math.max(5, ((val - chartMin) / (chartMax - chartMin)) * 100)
            : 10;
        let cls = "trend-bar";
        if (val === max) cls += m.invertColor ? " low" : " high";
        if (val === min) cls += m.invertColor ? " high" : " low";
        bars +=
          '<div class="' +
          cls +
          '" style="height:' +
          h +
          '%;" tabindex="0">' +
          '<span class="trend-tooltip">' +
          val +
          (m.unit || "") +
          "</span></div>";
      });

      // Default best-direction icon from invertColor if not explicitly set
      const bestIcon =
        m.bestIcon !== undefined
          ? m.bestIcon
          : m.invertColor
            ? iconArrowDown + " " + iconCheck
            : iconArrowUp + " " + iconCheck;

      html +=
        '<div class="trend-chart">' +
        '<div class="trend-header">' +
        '<div class="trend-label"><strong>' +
        m.label +
        "</strong>" +
        (m.desc ? " (" + m.desc + ")" : "") +
        "</div>" +
        (bestIcon ? '<div class="trend-best">' + bestIcon + "</div>" : "") +
        "</div>" +
        '<div class="trend-bars">' +
        bars +
        "</div></div>";
    });
    return html + "</div>";
  }

  function showDayDetails(dateKey, daySessions) {
    const el = document.getElementById("day-details");
    if (!el) return;
    const date = new Date(dateKey + "T12:00:00");
    const label =
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0");
    const sorted = [...daySessions].sort((a, b) => b.timestamp - a.timestamp);

    let html =
      '<div class="day-details-header"><h3>' +
      label +
      "</h3>" +
      '<button class="close-details" id="close-details">&times;</button></div>' +
      '<div class="day-sessions">';

    sorted.forEach((s, i) => {
      const t = new Date(s.timestamp);
      const time =
        String(t.getHours()).padStart(2, "0") +
        ":" +
        String(t.getMinutes()).padStart(2, "0");
      const stats = metricDefs
        .map((m) => {
          const val = s.metrics[m.key] ?? "-";
          const displayValue =
            m.format && val !== "-" ? m.format(val, s) : val + (m.unit || "");
          return "<span>" + m.label + ": " + displayValue + "</span>";
        })
        .join("");
      html +=
        '<div class="session-card">' +
        '<div class="session-header"><strong>' +
        getTitle(s, i) +
        "</strong>" +
        '<span class="session-time">' +
        time +
        "</span></div>" +
        '<div class="session-stats">' +
        stats +
        "</div></div>";
    });

    html += "</div>";
    el.innerHTML = html;
    el.classList.remove("hidden");
    document.getElementById("close-details").addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.add("hidden");
    });
  }

  return { open };
}
