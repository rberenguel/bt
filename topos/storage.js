import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("topos_history");

export function saveSessionRecord(sessionData) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      accuracy: sessionData.accuracy,
      score: sessionData.score,
      total: sessionData.total,
    },
  });
}

export const getHistory = () => storage.getHistory();
