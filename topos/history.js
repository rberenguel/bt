import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    {
      key: "accuracy",
      label: "Acc",
      desc: "Correctness",
      unit: "%",
      invertColor: false,
    },
    { key: "score", label: "Score", unit: "", invertColor: false },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
