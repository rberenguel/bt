import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("tanmateix_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      score: data.score,
      accuracy: data.accuracy,
      maxStreak: data.maxStreak,
      finalLevel: data.finalLevel,
    },
  });
}

export const getHistory = () => storage.getHistory();
