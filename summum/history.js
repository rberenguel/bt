import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "accuracy", label: "Acc", desc: "Correctness", unit: "%", invertColor: false },
    { key: "finalPace", label: "Final", desc: "Pace", unit: "s", invertColor: true },
    { key: "bestPace", label: "Best", desc: "Pace", unit: "s", invertColor: true },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
