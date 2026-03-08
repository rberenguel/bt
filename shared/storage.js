/**
 * Shared parameterised localStorage storage helper.
 *
 * Usage:
 *   const storage = makeStorage("my_app_history");
 *   storage.save({ timestamp, dateStr, metrics: { ... } });
 *   const sessions = storage.getHistory();
 */
export function makeStorage(key) {
  return {
    save(record) {
      try {
        const history = this.getHistory();
        history.push(record);
        localStorage.setItem(key, JSON.stringify(history));
      } catch (e) {
        console.error("Failed to save session record", e);
      }
    },
    getHistory() {
      try {
        const data = localStorage.getItem(key);
        const history = data ? JSON.parse(data) : [];
        return history.sort((a, b) => a.timestamp - b.timestamp);
      } catch (e) {
        console.error("Failed to load history", e);
        return [];
      }
    },
  };
}
