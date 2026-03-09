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
    const isLegacyDay = i === days - 3; // 2 days ago: always a legacy-only session
    for (let j = 0; j < dailySessions; j++) {
      const isLegacy = isLegacyDay || Math.random() < 0.25;
      const total = isLegacy
        ? undefined
        : Math.random() > 0.9
          ? Math.floor(Math.random() * 10) + 15
          : 30;

      const effectiveTotal = total ?? 30;
      let rawScore = Math.min(
        effectiveTotal,
        Math.max(10, baseScore + (Math.random() * 6 - 3)),
      );
      if (rawScore > effectiveTotal) rawScore = effectiveTotal;
      const score = Math.round(rawScore);

      const accuracy = Math.round((score / effectiveTotal) * 100);

      const metrics = {
        accuracy,
        score,
        maxStreak: Math.round(
          Math.min(20, Math.max(1, baseMaxStreak + (Math.random() * 4 - 2))),
        ),
        finalLevel: Math.round(
          Math.min(7, Math.max(1, baseFinalLevel + (Math.random() * 2 - 1))),
        ),
      };
      if (total !== undefined) metrics.total = total;

      records.push({
        timestamp: ts + j * 3_600_000,
        dateStr: new Date(ts).toISOString().split("T")[0],
        metrics,
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
