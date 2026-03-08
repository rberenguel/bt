import { makeStorage } from "../../shared/storage.js";
import { calculateMetrics } from "./metrics.js";

const storage = makeStorage("clauer_history");

export function saveSessionRecord(sessionData) {
  const now = Date.now();
  const dateStr = new Date(now).toISOString().split("T")[0];

  let metricsObj = { cpm: 0, accuracy: 0, ies: 0, cv: 0, switchCost: 0 };

  if (sessionData.logs && sessionData.logs.length > 0) {
    const metrics = calculateMetrics(sessionData.logs, sessionData.time);
    const totalItems = parseInt(sessionData.config.split("/")[1], 10);
    const accuracy =
      totalItems > 0
        ? ((totalItems - sessionData.errors) / totalItems) * 100
        : 0;

    metricsObj = {
      cpm: parseFloat(metrics.cpm) || 0,
      accuracy: parseFloat(accuracy.toFixed(1)) || 0,
      ies: parseFloat(metrics.ies) || 0,
      cv: parseFloat(metrics.cv) || 0,
      switchCost: parseFloat(metrics.switchCost) || 0,
    };
  }

  storage.save({
    timestamp: now,
    dateStr,
    config: sessionData.config,
    mode: sessionData.mode,
    metrics: metricsObj,
  });
}

export const getHistory = () => storage.getHistory();
