export function injectFakeHistory(count = 60) {
  const fakeHistory = [];
  let now = Date.now() - count * 24 * 60 * 60 * 1000;
  let baseAccuracy = 55.0;

  for (let i = 0; i < count; i++) {
    baseAccuracy = Math.min(95, baseAccuracy + Math.random() * 0.6);
    const dailySessions = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < dailySessions; j++) {
      const accuracy = Math.min(
        100,
        Math.max(0, baseAccuracy + (Math.random() * 20 - 10)),
      );
      const correct = Math.round((accuracy / 100) * 10);
      const incorrect = 10 - correct;
      fakeHistory.push({
        timestamp: now + j * 3600000,
        dateStr: new Date(now).toISOString().split("T")[0],
        metrics: { accuracy: Math.round(accuracy), correct, incorrect },
      });
    }
    now += 24 * 60 * 60 * 1000;
  }

  localStorage.setItem("mussol_history", JSON.stringify(fakeHistory));
  console.log(
    `Injected ${fakeHistory.length} fake sessions into localStorage.`,
  );
}

window.injectFakeHistory = injectFakeHistory;
