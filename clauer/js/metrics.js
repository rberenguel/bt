import { ICONS } from "./constants.js";

export function logEvent(state, isCorrect, isSwitch) {
  const now = performance.now();
  const responseTime = now - state.itemStartTime;

  state.sessionLogs.push({
    timestamp: now,
    responseTime: responseTime,
    correct: isCorrect,
    isSwitch: isSwitch,
    itemIndex: state.currentItemIndex,
    batchIndex: Math.floor(state.currentItemIndex / state.gameParams.batchSize),
  });
}

export function calculateMetrics(logs, totalTimeSec) {
  // Filter for valid response times (ignore extremely short ones that might be accidental double taps if needed,
  // but for now we trust the inputs)
  const correctLogs = logs.filter((l) => l.correct);
  const switchLogs = correctLogs.filter((l) => l.isSwitch);
  const stableLogs = correctLogs.filter((l) => !l.isSwitch);

  // 1. CPM (Correct Per Minute)
  // We use the passed totalTimeSec which accounts for pauses.
  const minutes = totalTimeSec / 60;

  // CRITICAL: We start the timer AFTER the first item is entered (to account for start delay).
  // So totalTimeSec covers (TotalItems - 1) items.
  // We should divide (correctLogs.length - 1) by minutes?
  // Or did we count the first item in correctLogs? Yes.
  // If the first item is correct, we have N correct answers.
  // But the time covers N-1 intervals.
  // If we just do N / Time, we are inflating CPM slightly because the first item took "0" time in the valid window?
  // Actually, TotalTime is (End - Start). Start was set AFTER first press.
  // So TotalTime is strictly the duration for items 2..N.
  // So we should calculate CPM based on items 2..N.
  // Let's assume the first item is "setup".

  // However, `logs` contains the first item too.
  // Let's filter out the first item log from CPM calculation if it corresponds to the start trigger?
  // Simply: Use (correctLogs.length - 1) if we have at least one log and it was the start trigger.
  // But what if the first one was wrong?
  // The timer starts regardless.
  // Let's us (Total Correct - (First was correct ? 1 : 0)) / Minutes.

  // Simpler approach: CPM = (Total Correct) / (Total Time + (Time for 1st item estimated)).
  // OR: CPM = (Total Correct - 1) / Total Time. (Throughput of the *timed* portion).
  // This feels most fair. You completed X items in Y seconds *during the timed phase*.

  // Correction: logs includes ALL items.
  // We should probably check if logs[0] exists.

  // New Logic:
  const timedCorrectCount =
    logs.length > 0 && logs[0].correct
      ? correctLogs.length - 1
      : correctLogs.length;
  // Wait, if logs[0] was error, correctLogs doesn't have it.
  // If logs[0] was correct, correctLogs has it.
  // So we subtract 1 if logs[0] was correct.
  // Basically we only count correct answers that happened *after* the timer started.
  // But wait, user pressed the key for Item 1, THEN timer started.
  // So Item 1 is "outside" the timer.

  const cpm =
    minutes > 0 ? (Math.max(0, timedCorrectCount) / minutes).toFixed(1) : 0;

  // 2. CV (Coefficient of Variation) = SD / Mean
  const responseTimes = correctLogs.map((l) => l.responseTime);
  const n = responseTimes.length;
  let cv = "N/A";
  let meanRT = 0;

  if (n > 1) {
    meanRT = responseTimes.reduce((a, b) => a + b, 0) / n;
    const variance =
      responseTimes.reduce((a, b) => a + Math.pow(b - meanRT, 2), 0) / n;
    const sd = Math.sqrt(variance);
    // CV is usually expressed as a percentage or decimal. Let's use percentage.
    cv = ((sd / meanRT) * 100).toFixed(1) + "%";
  }

  // 3. Switch Cost
  // Difference between average switch RT and average stable RT
  let switchCost = "N/A";
  let avgSwitchRT = 0;
  let avgStableRT = 0;

  if (switchLogs.length > 0 && stableLogs.length > 0) {
    avgSwitchRT =
      switchLogs.reduce((a, b) => a + b.responseTime, 0) / switchLogs.length;
    avgStableRT =
      stableLogs.reduce((a, b) => a + b.responseTime, 0) / stableLogs.length;
    switchCost = (avgSwitchRT - avgStableRT).toFixed(0) + "ms";
  }

  // 4. Inverse Efficiency Score (IES) = Mean RT / (1 - Proportion of Errors)
  // Note: IES usually uses Mean RT of CORRECT trials.
  // Error rate (PE)
  const totalTrials = logs.length; // correct + errors
  let ies = "N/A";

  if (totalTrials > 0 && meanRT > 0) {
    const errorCount = totalTrials - correctLogs.length;
    const pe = errorCount / totalTrials;
    if (pe < 1) {
      ies = (meanRT / (1 - pe)).toFixed(0) + "ms";
    } else {
      ies = "Inf";
    }
  }

  return {
    cpm,
    cv,
    switchCost,
    ies,
    avgSwitchRT: avgSwitchRT.toFixed(0),
    avgStableRT: avgStableRT.toFixed(0),
    meanRT: meanRT.toFixed(0),
  };
}

export function generateRecoveryGraphData(logs, batchSize) {
  // We want to see the average RT for the 1st, 2nd, 3rd... item in a batch/sequence after a switch.
  // Position 0 is the switch item.

  // If not in hard/shuffle mode, there might be no "switches" other than the very start?
  // Actually, even in normal mode, we can look at "Recovery from what?"
  // Maybe just "Recovery from Start" if no switches.
  // But the plan says "Specific to your Key Change toggle".

  // Let's gather RTs by "position in batch".
  const rtsByPosition = {};

  logs
    .filter((l) => l.correct)
    .forEach((log) => {
      // position relative to the last key change or batch start
      const position = log.itemIndex % batchSize;
      if (!rtsByPosition[position]) {
        rtsByPosition[position] = [];
      }
      rtsByPosition[position].push(log.responseTime);
    });

  // Calculate averages
  const labels = [];
  const data = [];

  // We usually care about the first 5 items
  const maxPos = Math.min(batchSize, 5);

  for (let i = 0; i < maxPos; i++) {
    labels.push(i === 0 ? "Switch" : `+${i}`);
    if (rtsByPosition[i] && rtsByPosition[i].length > 0) {
      const avg =
        rtsByPosition[i].reduce((a, b) => a + b, 0) / rtsByPosition[i].length;
      data.push(Math.round(avg));
    } else {
      data.push(0);
    }
  }

  return { labels, data };
}

export function generateStatsReport(allSessionsData) {
  let html =
    '<table class="results-table"><thead>' +
    "<tr><th>Stat</th><th>Atts</th><th>%</th><th>AvgT(s)</th></tr>" +
    "</thead><tbody>";

  let markdown = "### Clauer Report\n\n";
  const grandTotalByIcon = {};

  const calc = (stat) => {
    if (!stat || stat.attempts === 0)
      return { atts: 0, success: "N/A", avgT: "N/A" };
    const successRate = (stat.correct / stat.attempts) * 100;
    const avgTime = stat.correct > 0 ? stat.totalTime / stat.correct / 1000 : 0;
    return {
      atts: stat.attempts,
      success: successRate.toFixed(1),
      avgT: avgTime.toFixed(2),
    };
  };

  const addRow = (ctx, label, stat, style, config, extraMetrics = null) => {
    const { atts, success, avgT } = calc(stat);
    const iconData = ICONS.find((i) => i.icon === label);
    const iconHtml = iconData
      ? `<span class="iconoir iconoir-${iconData.icon}"></span>`
      : "";
    const configHtml = config ? ` <small>(${config})</small>` : "";

    // Granular Metrics HTML
    let granularHtml = "";
    if (extraMetrics) {
      granularHtml = `
        <tr class="granular-row">
          <td colspan="4">
            <div class="granular-stats">
              <span><strong>CPM:</strong> ${extraMetrics.cpm}</span>
              <span><strong>CV:</strong> ${extraMetrics.cv}</span>
              <span><strong>Switch Cost:</strong> ${extraMetrics.switchCost}</span>
              <span><strong>IES:</strong> ${extraMetrics.ies}</span>
            </div>
          </td>
        </tr>`;
    }

    const labelHtml = {
      header: `<td colspan="4">${label}${configHtml}</td>`,
      main: `<td><strong>${label}</strong></td><td>${atts}</td><td>${success}</td><td>${avgT}</td>`,
      sub: `<td>${iconHtml}${label}</td><td>${atts}</td><td>${success}</td><td>${avgT}</td>`,
    };

    // Markdown doesn't support the granular row nicely in the same table usually,
    // maybe we append it to the header or just list it.
    let extraMd = "";
    if (extraMetrics) {
      extraMd = `> CPM: ${extraMetrics.cpm} | CV: ${extraMetrics.cv} | SC: ${extraMetrics.switchCost} | IES: ${extraMetrics.ies}\n\n`;
    }

    const labelMd = {
      header: `| **${label}** ${config ? `(${config})` : ""} | | | |\n${extraMd}`,
      main: `| **${label}** | ${atts} | ${success} | ${avgT} |\n`,
      sub: `|  ↳ ${label} | ${atts} | ${success} | ${avgT} |\n`,
    };

    ctx.html += `<tr class="${style}-row">${labelHtml[style]}</tr>`;
    if (extraMetrics) ctx.html += granularHtml;

    ctx.markdown += labelMd[style];
  };

  const reportContext = { html, markdown };
  reportContext.markdown += "| Stat | Atts | % | AvgT(s) |\n";
  reportContext.markdown += "|:-----|-----:|----:|--------:|\n";

  allSessionsData.forEach((session, i) => {
    // Calculate granular metrics for this session if logs exist
    let granularMetrics = null;
    if (session.logs && session.logs.length > 0) {
      granularMetrics = calculateMetrics(session.logs, session.time);
    }

    addRow(
      reportContext,
      `Session ${i + 1} (${session.mode})`,
      null,
      "header",
      session.config,
      granularMetrics,
    );

    const sessionOverall = { attempts: 0, correct: 0, totalTime: 0 };
    const sortedIcons = Object.keys(session.stats).sort();

    sortedIcons.forEach((iconName) => {
      const iconStat = session.stats[iconName];
      sessionOverall.attempts += iconStat.attempts;
      sessionOverall.correct += iconStat.correct;
      sessionOverall.totalTime += iconStat.totalTime;

      if (!grandTotalByIcon[iconName]) {
        grandTotalByIcon[iconName] = {
          attempts: 0,
          correct: 0,
          totalTime: 0,
        };
      }
      grandTotalByIcon[iconName].attempts += iconStat.attempts;
      grandTotalByIcon[iconName].correct += iconStat.correct;
      grandTotalByIcon[iconName].totalTime += iconStat.totalTime;
    });

    addRow(reportContext, "Overall", sessionOverall, "main");
    sortedIcons.forEach((iconName) => {
      addRow(reportContext, iconName, session.stats[iconName], "sub");
    });
  });

  if (allSessionsData.length > 1) {
    addRow(reportContext, "Total (All Sessions)", null, "header");
    const grandTotalOverall = { attempts: 0, correct: 0, totalTime: 0 };
    const sortedTotalIcons = Object.keys(grandTotalByIcon).sort();
    sortedTotalIcons.forEach((iconName) => {
      const totalIconStat = grandTotalByIcon[iconName];
      grandTotalOverall.attempts += totalIconStat.attempts;
      grandTotalOverall.correct += totalIconStat.correct;
      grandTotalOverall.totalTime += totalIconStat.totalTime;
    });
    addRow(reportContext, "Overall", grandTotalOverall, "main");
    sortedTotalIcons.forEach((iconName) => {
      addRow(reportContext, iconName, grandTotalByIcon[iconName], "sub");
    });
  }

  reportContext.html += "</tbody></table>";

  return reportContext;
}
