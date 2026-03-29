import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("safata_history");

export function saveSessionRecord(data) {
    const now = Date.now();
    storage.save({
        timestamp: now,
        dateStr:   new Date(now).toISOString().split("T")[0],
        metrics: {
            redCompletions:   data.redCompletions,
            redAccuracy:      data.redAccuracy,
            yellowAccuracy:   data.yellowAccuracy,
            tilesReachedRed:  data.tilesReachedRed,
            avgVisitsPerTile: data.avgVisitsPerTile,
        },
    });
}

export const getHistory = () => storage.getHistory();
