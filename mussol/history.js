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
    { key: "correct", label: "Correct", unit: "", invertColor: false },
    { key: "incorrect", label: "Wrong", unit: "", invertColor: true },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
