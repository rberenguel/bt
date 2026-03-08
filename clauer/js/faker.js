export function injectFakeHistory(count = 60) {
  const fakeHistory = [];
  const modes = ["Normal", "Hard / Shuffle"];
  const config = "9@10/50";

  let now = Date.now() - count * 24 * 60 * 60 * 1000; // Start 'count' days ago

  // Base starting stats
  let baseCpm = 25.0;
  let baseIes = 2500;
  let baseCv = 30.0;

  for (let i = 0; i < count; i++) {
    // Simulate learning curve (improvement over time)
    baseCpm += Math.random() * 2;
    baseIes -= Math.random() * 50;
    baseCv -= Math.random() * 0.5;

    // Add some random daily noise
    const cpm = Math.max(10, baseCpm + (Math.random() * 6 - 3));
    const ies = Math.max(800, baseIes + (Math.random() * 200 - 100));
    const cv = Math.max(5, baseCv + (Math.random() * 4 - 2));
    const accuracy = Math.min(100, 85 + Math.random() * 15);
    const switchCost = Math.max(200, 800 - i * 15 + Math.random() * 100);

    // Randomly pick between two modes to ensure grouping logic can be tested
    const mode = modes[Math.floor(Math.random() * modes.length)];

    // Simulate 1 to 3 sessions per day
    const dailySessions = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < dailySessions; j++) {
      fakeHistory.push({
        timestamp: now + j * 3600000, // Space out by an hour
        dateStr: new Date(now).toISOString().split("T")[0],
        config: config,
        mode: mode,
        metrics: {
          cpm: parseFloat(cpm.toFixed(1)),
          accuracy: parseFloat(accuracy.toFixed(1)),
          ies: parseFloat(ies.toFixed(0)),
          cv: parseFloat(cv.toFixed(1)),
          switchCost: parseFloat(switchCost.toFixed(0)),
        },
      });
    }

    now += 24 * 60 * 60 * 1000; // Next day
  }

  localStorage.setItem("clauer_history", JSON.stringify(fakeHistory));
  console.log(
    `Injected ${fakeHistory.length} fake sessions into localStorage.`,
  );
}
