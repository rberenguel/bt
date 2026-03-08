// Run injectFakeHistory() in the browser console to populate test data.
// Run clearHistory() to wipe it.

const STORAGE_KEY = "tanmateix_history";

export function injectFakeHistory(days = 30) {
  const records = [];
  let ts = Date.now() - days * 24 * 60 * 60 * 1000;

  let baseAccuracy = 55;
  let baseScore = 17;
  let baseMaxStreak = 4;
  let baseFinalLevel = 2;

  for (let i = 0; i < days; i++) {
    baseAccuracy = Math.min(90, baseAccuracy + Math.random() * 0.7);
    baseScore = Math.min(27, baseScore + Math.random() * 0.4);
    baseMaxStreak = Math.min(18, baseMaxStreak + Math.random() * 0.3);
    baseFinalLevel = Math.min(7, baseFinalLevel + Math.random() * 0.15);

    const dailySessions = Math.floor(Math.random() * 2) + 1;
    for (let j = 0; j < dailySessions; j++) {
      const accuracy = Math.round(
        Math.min(100, Math.max(30, baseAccuracy + (Math.random() * 16 - 8))),
      );
      records.push({
        timestamp: ts + j * 3_600_000,
        dateStr: new Date(ts).toISOString().split("T")[0],
        metrics: {
          accuracy,
          score: Math.round(
            Math.min(30, Math.max(10, baseScore + (Math.random() * 6 - 3))),
          ),
          maxStreak: Math.round(
            Math.min(20, Math.max(1, baseMaxStreak + (Math.random() * 4 - 2))),
          ),
          finalLevel: Math.round(
            Math.min(7, Math.max(1, baseFinalLevel + (Math.random() * 2 - 1))),
          ),
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
window.clearHistory = clearHistory;
