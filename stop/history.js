import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "goAcc", label: "Go acc", unit: "%", invertColor: false },
    { key: "stopAcc", label: "Stop acc", unit: "%", invertColor: false },
    { key: "avgRt", label: "Avg RT", unit: "ms", invertColor: true },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
