import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("regles_history");

export function saveSessionRecord(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      errorRate:        data.errorRate,        // % wrong taps of all taps
      avgShiftLatency:  data.avgShiftLatency,  // seconds, null if no shifts recorded
      interferenceRate: data.interferenceRate, // % of wrong taps that matched prior rule
    },
  });
}

export const getHistory  = () => storage.getHistory();
