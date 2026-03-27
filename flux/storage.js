import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("flux_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      pmHitRate: data.pmHitRate,
      falseAlarmRate: data.falseAlarmRate,
      missRate: data.missRate,
      rtCost: data.rtCost,
      level: data.level,
      intentions: data.intentions,
      pairId: data.pairId,
    },
  });
}

export const getHistory = () => storage.getHistory();
