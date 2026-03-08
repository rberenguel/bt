import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("summum_history");

export function saveSessionRecord(sessionData) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      accuracy: sessionData.accuracy,
      finalPace: sessionData.finalPace,
      bestPace: sessionData.bestPace,
    },
  });
}

export const getHistory = () => storage.getHistory();
