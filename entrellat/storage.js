import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("entrellat_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      solved: data.solved,
      failed: data.failed,
      total: data.total,
    },
  });
}

export const getHistory = () => storage.getHistory();
