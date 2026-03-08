export function injectFakeHistory(count = 60) {
  const fakeHistory = [];

  let now = Date.now() - count * 24 * 60 * 60 * 1000; // Start 'count' days ago

  // Base starting stats
  let baseAccuracy = 75.0;
  let baseFinalPace = 4.0;
  let baseBestPace = 3.5;

  for (let i = 0; i < count; i++) {
    // Simulate learning curve (improvement over time)
    baseAccuracy = Math.min(100, baseAccuracy + Math.random() * 0.5);
    baseFinalPace = Math.max(0.5, baseFinalPace - Math.random() * 0.05);
    baseBestPace = Math.max(0.4, baseBestPace - Math.random() * 0.05);

    // Add some random daily noise
    const accuracy = Math.min(
      100,
      Math.max(0, baseAccuracy + (Math.random() * 10 - 5)),
    );
    const finalPace = Math.max(
      0.5,
      baseFinalPace + (Math.random() * 0.5 - 0.25),
    );
    const bestPace = Math.max(
      0.4,
      Math.min(finalPace, baseBestPace + (Math.random() * 0.4 - 0.2)),
    );

    // Simulate 1 to 5 sessions per day
    const dailySessions = Math.floor(Math.random() * 5) + 1;

    for (let j = 0; j < dailySessions; j++) {
      fakeHistory.push({
        timestamp: now + j * 3600000, // Space out by an hour
        dateStr: new Date(now).toISOString().split("T")[0],
        metrics: {
          accuracy: Math.round(accuracy),
          finalPace: parseFloat(finalPace.toFixed(2)),
          bestPace: parseFloat(bestPace.toFixed(2)),
        },
      });
    }

    now += 24 * 60 * 60 * 1000; // Next day
  }

  localStorage.setItem("summum_history", JSON.stringify(fakeHistory));
  console.log(
    `Injected ${fakeHistory.length} fake sessions into localStorage.`,
  );
}

// Make it available globally for easy testing
window.injectFakeHistory = injectFakeHistory;
