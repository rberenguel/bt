// Modal management module

/**
 * Decode round results from compact storage format
 * @param {Array} encodedResults - Array of encoded numbers (0-7)
 * @returns {Array} Array of {position, color, letter} objects
 */
function decodeRoundResults(encodedResults) {
  if (!encodedResults) return [];
  return encodedResults.map((val) => ({
    position: (val & 1) !== 0,
    color: (val & 2) !== 0,
    letter: (val & 4) !== 0,
    shape: (val & 8) !== 0,
  }));
}

/**
 * Render mini progress grid as inline preview (20x20 pixels)
 * @param {Array} encodedResults - Array of encoded numbers
 * @param {boolean} triple - Whether triple mode
 * @returns {string} HTML string for the mini grid
 */
function renderMiniProgressGrid(encodedResults, triple, quad) {
  if (!encodedResults || encodedResults.length === 0) {
    return '<div class="mini-grid-placeholder"></div>';
  }

  const roundResults = decodeRoundResults(encodedResults);

  let html = '<div class="mini-progress-grid">';

  for (let i = 0; i < 100; i++) {
    const result = roundResults[i];
    if (!result) {
      html += '<div class="mini-cell empty"></div>';
    } else {
      const allCorrect =
        result.position &&
        result.color &&
        (!triple || result.letter) &&
        (!quad || result.shape);
      const anyCorrect =
        result.position ||
        result.color ||
        (triple && result.letter) ||
        (quad && result.shape);

      let cellClass = "mini-cell";
      if (allCorrect) {
        cellClass += " all-correct";
      } else if (anyCorrect) {
        cellClass += " partial";
      } else {
        cellClass += " incorrect";
      }

      html += `<div class="${cellClass}"></div>`;
    }
  }

  html += "</div>";
  return html;
}

/**
 * Render 10x10 progress grid showing per-round correctness
 * @param {Array} roundResults - Array of {position, color, letter} objects
 * @param {boolean} triple - Whether triple mode
 * @returns {string} HTML string for the grid
 */
function renderProgressGrid(roundResults, triple, quad) {
  if (!roundResults || roundResults.length === 0) {
    return '<p style="opacity: 0.7; text-align: center;">No rounds completed yet</p>';
  }

  let html =
    '<div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 0.5rem;">';
  if (quad) {
    html += "Top: Pos, Mid1: Col, Mid2: Let, Bot: Shp";
  } else if (triple) {
    html += "Top: Position, Mid: Color, Bot: Letter";
  } else {
    html += "Top: Position, Bot: Color";
  }
  html += "</div>";

  html += '<div class="progress-grid">';

  // Create 10x10 grid (100 cells)
  for (let i = 0; i < 100; i++) {
    const result = roundResults[i];

    if (!result) {
      // Not yet played - show empty cell
      html += '<div class="grid-cell empty"></div>';
    } else {
      // Played - show split cell
      html += '<div class="grid-cell">';

      // Position (top bar)
      html += `<div class="cell-bar" style="background-color: ${result.position ? "#22c55e" : "#ef4444"}"></div>`;

      // Color (middle/bottom bar)
      html += `<div class="cell-bar" style="background-color: ${result.color ? "#22c55e" : "#ef4444"}"></div>`;

      // Letter (bottom bar, only in triple/quad mode)
      if (triple || quad) {
        html += `<div class="cell-bar" style="background-color: ${result.letter ? "#22c55e" : "#ef4444"}"></div>`;
      }

      // Shape (bottom bar, only in quad mode)
      if (quad) {
        html += `<div class="cell-bar" style="background-color: ${result.shape ? "#22c55e" : "#ef4444"}"></div>`;
      }

      html += "</div>";
    }
  }

  html += "</div>";

  return html;
}

/**
 * Compute current training streak in days.
 * Counts consecutive days with sessions ending today (or yesterday if today
 * has no sessions yet, so the streak doesn't vanish on a fresh morning).
 * @param {Array} sessions - Array of session objects
 * @returns {number} Streak length in days
 */
function computeStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;

  const daySet = new Set();
  sessions.forEach((s) => {
    const d = new Date(s.date);
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  // Start from today; if nothing today yet, start from yesterday
  const check = new Date();
  check.setHours(0, 0, 0, 0);
  const todayKey = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
  if (!daySet.has(todayKey)) {
    check.setDate(check.getDate() - 1);
  }

  let streak = 0;
  while (daySet.has(`${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`)) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

// DOM elements
const modal = document.getElementById("modal");
const modalInstructions = document.getElementById("modal-instructions");
const modalPause = document.getElementById("modal-pause");
const modalResults = document.getElementById("modal-results");
const modalHistory = document.getElementById("modal-history");
const modalSessionDetail = document.getElementById("modal-session-detail");

// Track which modal is currently open
let currentModal = null;
let onCloseCallback = null;
let calendarSessions = []; // Store sessions for back navigation

/**
 * Hide all modals and the overlay
 */
export function hideModal() {
  modal.classList.add("hidden");
  modalInstructions.classList.add("hidden");
  modalPause.classList.add("hidden");
  modalResults.classList.add("hidden");
  modalHistory.classList.add("hidden");
  modalSessionDetail.classList.add("hidden");

  // Call the close callback if one was set
  if (onCloseCallback) {
    const callback = onCloseCallback;
    onCloseCallback = null;
    callback();
  }

  currentModal = null;
}

/**
 * Show a specific modal
 */
function showModal(modalElement, closeCallback = null) {
  // Hide any currently showing modal
  modalInstructions.classList.add("hidden");
  modalPause.classList.add("hidden");
  modalResults.classList.add("hidden");
  modalHistory.classList.add("hidden");
  modalSessionDetail.classList.add("hidden");

  // Show the requested modal
  modalElement.classList.remove("hidden");
  modal.classList.remove("hidden");

  currentModal = modalElement;
  onCloseCallback = closeCallback;
}

/**
 * Show instructions modal
 */
export function showInstructions() {
  showModal(modalInstructions);
}

/**
 * Show pause stats modal
 * @param {Object} stats - Game statistics
 * @param {number} stats.BACK - N-back level
 * @param {boolean} stats.triple - Triple mode?
 * @param {number} stats.total - Total rounds completed
 * @param {number} stats.correctPosC - Correct position answers
 * @param {number} stats.correctColC - Correct color answers
 * @param {number} stats.correctLetC - Correct letter answers (triple only)
 * @param {Function} onClose - Callback when modal is closed (resume game)
 */
export function showPauseStats(stats, onClose) {
  // Calculate percentages (handle division by zero)
  const pctPos =
    stats.total > 0 ? Math.round((100 * stats.correctPosC) / stats.total) : 0;
  const pctCol =
    stats.total > 0 ? Math.round((100 * stats.correctColC) / stats.total) : 0;
  const pctLet =
    stats.triple && stats.total > 0
      ? Math.round((100 * stats.correctLetC) / stats.total)
      : 0;
  const pctShape =
    stats.quad && stats.total > 0
      ? Math.round((100 * stats.correctShapeC) / stats.total)
      : 0;

  let totalFactors = 2;
  if (stats.quad) totalFactors = 4;
  else if (stats.triple) totalFactors = 3;

  const totalAnswers = stats.total * totalFactors;
  const correctAnswers = stats.quad
    ? stats.correctPosC +
      stats.correctColC +
      stats.correctLetC +
      stats.correctShapeC
    : stats.triple
      ? stats.correctPosC + stats.correctColC + stats.correctLetC
      : stats.correctPosC + stats.correctColC;

  const overall =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Update modal content
  document.getElementById("pause-level").textContent =
    `Level: ${stats.BACK}-back ${stats.quad ? "(Quad)" : stats.triple ? "(Triple)" : "(Dual)"}`;
  document.getElementById("pause-rounds").textContent =
    `Rounds: ${stats.total} / 100`;
  document.getElementById("pause-overall").textContent = `Overall: ${overall}%`;
  document.getElementById("pause-position").textContent =
    `Position: ${stats.correctPosC}/${stats.total} (${pctPos}%)`;
  document.getElementById("pause-color").textContent =
    `Color: ${stats.correctColC}/${stats.total} (${pctCol}%)`;

  const pauseLetter = document.getElementById("pause-letter");
  if (stats.triple) {
    pauseLetter.textContent = `Letter: ${stats.correctLetC}/${stats.total} (${pctLet}%)`;
    pauseLetter.classList.remove("hidden");
  } else {
    pauseLetter.classList.add("hidden");
  }

  const pauseShape = document.getElementById("pause-shape");
  // Check if element exists (need to add it to HTML first in next step, but let's handle JS now)
  // I will create the element in JS if it doesn't exist? No, better to assume it exists or add logical check.
  // I'll add the element to HTML later.
  if (pauseShape) {
    if (stats.quad) {
      pauseShape.textContent = `Shape: ${stats.correctShapeC}/${stats.total} (${pctShape}%)`;
      pauseShape.classList.remove("hidden");
    } else {
      pauseShape.classList.add("hidden");
    }
  }

  // Add progress grid visualization
  const pauseGrid = document.getElementById("pause-grid");
  if (pauseGrid) {
    pauseGrid.innerHTML = renderProgressGrid(
      stats.roundResults,
      stats.triple,
      stats.quad,
    );
  }

  showModal(modalPause, onClose);
}

/**
 * Show results modal
 * @param {Object} stats - Game statistics (same structure as pause stats)
 */
export function showResults(stats) {
  let totalFactors = 2;
  if (stats.quad) totalFactors = 4;
  else if (stats.triple) totalFactors = 3;

  const totalAnswers = stats.total * totalFactors;
  const correctAnswers = stats.quad
    ? stats.correctPosC +
      stats.correctColC +
      stats.correctLetC +
      stats.correctShapeC
    : stats.triple
      ? stats.correctPosC + stats.correctColC + stats.correctLetC
      : stats.correctPosC + stats.correctColC;
  const percentage = Math.round((correctAnswers / totalAnswers) * 100);

  // Update modal content
  document.getElementById("results-level").textContent =
    `Level: ${stats.BACK}-back ${stats.quad ? "(Quad)" : stats.triple ? "(Triple)" : "(Dual)"}`;
  document.getElementById("results-rounds").textContent =
    `Rounds: ${stats.total}`;
  document.getElementById("results-overall").textContent =
    `Overall: ${percentage}%`;
  document.getElementById("results-position").textContent =
    `Position: ${stats.correctPosC}/${stats.total} (${Math.round((stats.correctPosC / stats.total) * 100)}%)`;
  document.getElementById("results-color").textContent =
    `Color: ${stats.correctColC}/${stats.total} (${Math.round((stats.correctColC / stats.total) * 100)}%)`;

  const resultsLetter = document.getElementById("results-letter");
  if (stats.triple) {
    resultsLetter.textContent = `Letter: ${stats.correctLetC}/${stats.total} (${Math.round((stats.correctLetC / stats.total) * 100)}%)`;
    resultsLetter.classList.remove("hidden");
  } else {
    resultsLetter.classList.add("hidden");
  }

  const resultsShape = document.getElementById("results-shape");
  if (resultsShape) {
    if (stats.quad) {
      const pctShape = Math.round((stats.correctShapeC / stats.total) * 100);
      resultsShape.textContent = `Shape: ${stats.correctShapeC}/${stats.total} (${pctShape}%)`;
      resultsShape.classList.remove("hidden");
    } else {
      resultsShape.classList.add("hidden");
    }
  }

  // Add level suggestion based on performance
  let suggestion = "";
  if (percentage >= 80) {
    suggestion =
      stats.BACK < 9
        ? "Consider advancing to a higher level"
        : "Excellent work at maximum level!";
  } else if (percentage >= 50) {
    suggestion = "Keep practicing at this level";
  } else {
    suggestion =
      stats.BACK > 1
        ? "Try an easier level for better results"
        : "Keep practicing!";
  }
  document.getElementById("results-suggestion").textContent = suggestion;

  // Add progress grid visualization
  const resultsGrid = document.getElementById("results-grid");
  if (resultsGrid) {
    resultsGrid.innerHTML = renderProgressGrid(
      stats.roundResults,
      stats.triple,
      stats.quad,
    );
  }

  showModal(modalResults);
}

// Track current month being viewed
let currentViewDate = new Date();

/**
 * Export sessions data as JSON file
 * @param {Array} sessions - Array of session objects
 */
async function exportSessions(sessions) {
  const jsonData = JSON.stringify(sessions, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `nb-${timestamp}.json`;

  // Try Web Share API first (if available and supports files)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "application/json" });
      const shareData = { files: [file], title: "N-Back Session Data" };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        console.info("Shared successfully");
        return;
      }
    } catch (err) {
      console.info("Web Share API failed, falling back to download:", err);
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.info("Downloaded:", filename);
}

/**
 * Show history modal with calendar view
 * @param {Array} sessions - Array of session objects
 */
export function showHistory(sessions) {
  currentViewDate = new Date(); // Reset to current month
  calendarSessions = sessions; // Store for back navigation
  renderCalendar(sessions);
  showModal(modalHistory);
}

/**
 * Render calendar view
 * @param {Array} sessions - Array of session objects
 */
function renderCalendar(sessions) {
  const historyList = document.getElementById("history-list");

  if (!sessions || sessions.length === 0) {
    historyList.innerHTML =
      '<p style="opacity: 0.7; text-align: center;">No completed sessions yet.</p>';
    return;
  }

  // Group sessions by date
  const sessionsByDate = {};
  sessions.forEach((session) => {
    const date = new Date(session.date);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = [];
    }
    sessionsByDate[dateKey].push(session);
  });

  // Get calendar data
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Convert Sunday-based (0-6) to Monday-based (0-6 where 0=Monday)
  let startingDayOfWeek = firstDay.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Sunday becomes 6

  // Month name
  const monthName = currentViewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const streak = computeStreak(sessions);
  const streakHtml = streak > 0
    ? `<div class="calendar-streak"><span class="streak-icon">\ue2de</span> ${streak}-day streak</div>`
    : "";

  let html = `
    <div class="calendar-header">
      <button class="calendar-nav" id="prev-month">&larr;</button>
      <h3>${monthName}</h3>
      <button class="calendar-nav" id="next-month">&rarr;</button>
    </div>
    ${streakHtml}
    <div class="calendar-grid">
      <div class="calendar-day-header">Mon</div>
      <div class="calendar-day-header">Tue</div>
      <div class="calendar-day-header">Wed</div>
      <div class="calendar-day-header">Thu</div>
      <div class="calendar-day-header">Fri</div>
      <div class="calendar-day-header">Sat</div>
      <div class="calendar-day-header">Sun</div>
  `;

  // Empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of month
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const daySessions = sessionsByDate[dateKey] || [];
    const sessionCount = daySessions.length;

    const isToday = isCurrentMonth && today.getDate() === day;
    const hasData = sessionCount > 0;

    let classes = "calendar-day";
    if (isToday) classes += " today";
    if (hasData) classes += " has-sessions";

    html += `
      <div class="${classes}" data-date="${dateKey}">
        <div class="calendar-day-number">${day}</div>
        ${sessionCount > 0 ? `<div class="session-indicator">${sessionCount}</div>` : ""}
      </div>
    `;
  }

  html += "</div>";

  // Details section (hidden initially)
  html += '<div id="day-details" class="day-details hidden"></div>';

  historyList.innerHTML = html;

  // Attach event listeners
  document.getElementById("prev-month")?.addEventListener("click", (e) => {
    e.stopPropagation();
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    renderCalendar(sessions);
  });

  document.getElementById("next-month")?.addEventListener("click", (e) => {
    e.stopPropagation();
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    renderCalendar(sessions);
  });

  // Day click handlers
  document.querySelectorAll(".calendar-day.has-sessions").forEach((dayEl) => {
    dayEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const dateKey = dayEl.dataset.date;
      const daySessions = sessionsByDate[dateKey] || [];
      showDayDetails(dateKey, daySessions);
    });
  });
}

/**
 * Show details for a specific day
 * @param {string} dateKey - Date key (YYYY-MM-DD)
 * @param {Array} daySessions - Sessions for this day
 */
function showDayDetails(dateKey, daySessions) {
  const detailsEl = document.getElementById("day-details");
  if (!detailsEl) return;

  const date = new Date(dateKey + "T12:00:00"); // Use noon to avoid timezone issues

  // Format as YYYYMMDD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Sort sessions by time
  const sortedSessions = [...daySessions].sort((a, b) => a.date - b.date);

  let html = `
    <div class="day-details-header">
      <h3>${dateStr}</h3>
      <button class="close-details" id="close-details">×</button>
    </div>
    <div class="day-sessions">
  `;

  sortedSessions.forEach((session, index) => {
    const time = new Date(session.date);

    // Format as HH:MM (24-hour)
    const hours = String(time.getHours()).padStart(2, "0");
    const minutes = String(time.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    const mode = session.quad ? "Quad" : session.triple ? "Triple" : "Dual";
    const pctPos = Math.round(session.pctPos);
    const pctCol = Math.round(session.pctCol);
    const pctLet = session.triple ? Math.round(session.pctLet) : null;

    const miniGrid = renderMiniProgressGrid(
      session.roundResults,
      session.triple,
      session.quad,
    );

    html += `
      <div class="session-card" data-session-index="${index}">
        <div class="session-content">
          <div class="session-info">
            <div class="session-header">
              <strong>${session.level}-back ${mode}</strong>
              <span class="session-time">${timeStr}</span>
            </div>
            <div class="session-stats">
              <span>Pos: ${pctPos}%</span>
              <span>Col: ${pctCol}%</span>
              ${pctLet !== null ? `<span>Let: ${pctLet}%</span>` : ""}
              ${session.quad ? `<span>Shp: ${Math.round(session.pctShape)}%</span>` : ""}
            </div>
          </div>
          ${miniGrid}
        </div>
      </div>
    `;
  });

  html += "</div>";

  detailsEl.innerHTML = html;
  detailsEl.classList.remove("hidden");

  // Close button handler
  document.getElementById("close-details")?.addEventListener("click", (e) => {
    e.stopPropagation();
    detailsEl.classList.add("hidden");
  });

  // Session card click handlers
  document.querySelectorAll(".session-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      const sessionIndex = parseInt(card.dataset.sessionIndex);
      const session = sortedSessions[sessionIndex];
      showSessionDetail(session);
    });
  });
}

/**
 * Show detailed view of a single session
 * @param {Object} session - Session object
 */
function showSessionDetail(session) {
  const date = new Date(session.date);

  // Format as YYYYMMDD @ HH:MM (Day)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

  const dateStr = `${year}${month}${day} @ ${hours}:${minutes} (${dayName})`;

  const mode = session.quad ? "Quad" : session.triple ? "Triple" : "Dual";
  const pctPos = Math.round(session.pctPos);
  const pctCol = Math.round(session.pctCol);
  const pctLet = session.triple ? Math.round(session.pctLet) : null;
  const pctShape = session.quad ? Math.round(session.pctShape) : null;

  // Calculate overall percentage
  let totalFactors = 2;
  if (session.quad) totalFactors = 4;
  else if (session.triple) totalFactors = 3;

  const totalAnswers = session.quad ? 400 : session.triple ? 300 : 200; // Actually total rounds * factors, but logic below was simpler
  // Correction: session doesn't store total rounds count explicitly in 'total'?
  // It stores pctPos etc.
  // Wait, session storage has 'level', 'triple', 'quad', 'pctPos', etc.
  // And 'roundResults'.
  // The original code calculated overall from pcts:

  const correctAnswers = session.quad
    ? session.pctPos + session.pctCol + session.pctLet + session.pctShape
    : session.triple
      ? session.pctPos + session.pctCol + session.pctLet
      : session.pctPos + session.pctCol;

  const overall = Math.round(correctAnswers / totalFactors);

  // Decode round results for the progress grid
  const roundResults = decodeRoundResults(session.roundResults);

  // Update modal content
  document.getElementById("session-detail-date").textContent = dateStr;
  document.getElementById("session-detail-level").textContent =
    `Level: ${session.level}-back ${mode}`;
  document.getElementById("session-detail-overall").textContent =
    `Overall: ${overall}%`;
  document.getElementById("session-detail-position").textContent =
    `Position: ${pctPos}%`;
  document.getElementById("session-detail-color").textContent =
    `Color: ${pctCol}%`;

  const sessionDetailLetter = document.getElementById("session-detail-letter");
  if (session.triple) {
    sessionDetailLetter.textContent = `Letter: ${pctLet}%`;
    sessionDetailLetter.classList.remove("hidden");
  } else {
    sessionDetailLetter.classList.add("hidden");
  }

  const sessionDetailShape = document.getElementById("session-detail-shape");
  if (sessionDetailShape) {
    if (session.quad) {
      sessionDetailShape.textContent = `Shape: ${pctShape}%`;
      sessionDetailShape.classList.remove("hidden");
    } else {
      sessionDetailShape.classList.add("hidden");
    }
  }

  // Add progress grid visualization
  const sessionDetailGrid = document.getElementById("session-detail-grid");
  if (sessionDetailGrid) {
    sessionDetailGrid.innerHTML = renderProgressGrid(
      roundResults,
      session.triple,
      session.quad,
    );
  }

  showModal(modalSessionDetail);
}

// Set up global click handler for modal dismissal
modal.addEventListener("click", (e) => {
  // Only close if clicking the overlay itself or a close hint
  if (e.target === modal || e.target.classList.contains("modal-close-hint")) {
    hideModal();
  }
});

// Instructions modal can be dismissed by clicking anywhere in it
modalInstructions.addEventListener("click", () => {
  hideModal();
});

// Pause modal can be dismissed by clicking the close hint
modalPause.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-close-hint")) {
    hideModal();
  }
});

// Results modal can be dismissed by clicking the close hint
modalResults.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-close-hint")) {
    hideModal();
  }
});

// History modal can be dismissed by clicking the close hint
modalHistory.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-close-hint")) {
    hideModal();
  }

  // Export sessions button
  if (e.target.id === "export-sessions") {
    e.stopPropagation();
    exportSessions(calendarSessions);
  }
});

// Session detail modal can be dismissed by clicking the close hint
modalSessionDetail.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-close-hint")) {
    hideModal();
  }
});

// Back button handler for session detail modal
// Use event delegation since button is inside modal
modalSessionDetail.addEventListener("click", (e) => {
  if (e.target.id === "back-to-calendar") {
    e.stopPropagation();
    // Close session detail and return to calendar
    modalSessionDetail.classList.add("hidden");
    modalHistory.classList.remove("hidden");
    renderCalendar(calendarSessions); // Re-render calendar to restore state
  }
});

// Swipe gesture for calendar month navigation
let swipeStartX = 0;
let swipeStartY = 0;
const historyListEl = document.getElementById("history-list");

historyListEl.addEventListener("touchstart", (e) => {
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
}, { passive: true });

historyListEl.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - swipeStartX;
  const dy = e.changedTouches[0].clientY - swipeStartY;
  // Require horizontal dominance and minimum distance to avoid interfering with scrolling
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    currentViewDate.setMonth(currentViewDate.getMonth() + (dx < 0 ? 1 : -1));
    renderCalendar(calendarSessions);
  }
}, { passive: true });

// Export for external access (keyboard shortcuts)
export { modal };
