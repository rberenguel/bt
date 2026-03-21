import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "score", label: "Score", unit: "", invertColor: false },
    { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
