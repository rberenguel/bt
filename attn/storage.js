import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("attn_history");

export function saveSession(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      balls: data.balls,
      accuracy: data.accuracy,
      eb: data.eb,
      score: data.score,
      phase1: data.phase1,
      phase2: data.phase2,
      phase3: data.phase3,
    },
  });
}

export const getHistory = () => storage.getHistory();
