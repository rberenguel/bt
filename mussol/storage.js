import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("mussol_history");

export function saveSessionRecord(sessionData) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      correct: sessionData.correct,
      incorrect: sessionData.incorrect,
      accuracy: sessionData.accuracy,
    },
  });
}

export const getHistory = () => storage.getHistory();
