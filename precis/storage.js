import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("precis_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      score: data.score,
      accuracy: data.accuracy,
      literalAcc: data.literalAcc,
      exploitAcc: data.exploitAcc,
      finalLevel: data.finalLevel,
    },
  });
}

export const getHistory = () => storage.getHistory();
