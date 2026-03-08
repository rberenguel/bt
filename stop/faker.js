// Run injectFakeHistory() in the browser console to populate test data.
// Run clearHistory() to wipe it.

const STORAGE_KEY = "stop_history";

export function injectFakeHistory(days = 30) {
  const records = [];
  let ts = Date.now() - days * 24 * 60 * 60 * 1000;

  // Simulate gradual improvement over time
  let baseGoAcc   = 72;
  let baseStopAcc = 45; // starts low, converges toward 50%
  let baseAvgRt   = 420;
  let baseSsd     = 200;

  for (let i = 0; i < days; i++) {
    baseGoAcc   = Math.min(98, baseGoAcc   + Math.random() * 0.8);
    baseStopAcc = Math.min(60, baseStopAcc + (Math.random() - 0.3) * 2); // noisy around 50
    baseAvgRt   = Math.max(220, baseAvgRt  - Math.random() * 3);
    baseSsd     = Math.min(500, baseSsd    + Math.random() * 5);

    const dailySessions = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < dailySessions; j++) {
      records.push({
        timestamp: ts + j * 3_600_000,
        dateStr: new Date(ts).toISOString().split("T")[0],
        metrics: {
          goAcc:   Math.round(Math.min(100, Math.max(0, baseGoAcc   + (Math.random() * 10 - 5)))),
          stopAcc: Math.round(Math.min(100, Math.max(0, baseStopAcc + (Math.random() * 14 - 7)))),
          avgRt:   Math.round(Math.max(180, baseAvgRt + (Math.random() * 60 - 30))),
          ssd:     Math.round(Math.max(50,  baseSsd   + (Math.random() * 60 - 30))),
        },
      });
    }
    ts += 24 * 60 * 60 * 1000;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  console.log(`Injected ${records.length} fake sessions over ${days} days.`);
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  console.log("History cleared.");
}

window.injectFakeHistory = injectFakeHistory;
window.clearHistory      = clearHistory;
