import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "solved", label: "Solved", unit: "", invertColor: false },
    { key: "failed", label: "Failed", unit: "", invertColor: true },
    { key: "total", label: "Total", unit: "", invertColor: false },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
