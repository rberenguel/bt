import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("stop_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      goAcc:   data.goAcc,
      stopAcc: data.stopAcc,
      avgRt:   data.avgRt,
      ssd:     data.ssd,
    },
  });
}

export const getHistory = () => storage.getHistory();
