import { get, set } from "./idb-keyval.js";

/**
 * Shared parameterised IndexedDB storage helper (idb-keyval).
 * Falls back gracefully: on first getHistory(), migrates any existing
 * localStorage data for the same key into IndexedDB, then clears it.
 *
 * Usage:
 *   const storage = makeStorage("my_app_history");
 *   await storage.save({ timestamp, dateStr, metrics: { ... } });
 *   const sessions = await storage.getHistory();
 */
export function makeStorage(key) {
  return {
    async save(record) {
      try {
        const history = await this.getHistory();
        history.push(record);
        await set(key, history);
      } catch (e) {
        console.error("Failed to save session record", e);
      }
    },
    async getHistory() {
      try {
        let history = (await get(key)) || [];

        // Migrate legacy localStorage data (one-time)
        const legacy = localStorage.getItem(key);
        if (legacy) {
          try {
            const legacyRecords = JSON.parse(legacy);
            if (Array.isArray(legacyRecords) && legacyRecords.length > 0) {
              history = [...legacyRecords, ...history];
              await set(key, history);
            }
          } catch (e) {
            console.warn("Failed to migrate legacy localStorage data", e);
          }
          localStorage.removeItem(key);
        }

        return history.sort((a, b) => a.timestamp - b.timestamp);
      } catch (e) {
        console.error("Failed to load history", e);
        return [];
      }
    },
  };
}
