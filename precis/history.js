import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "score",      label: "Score",   unit: "",  invertColor: false },
    { key: "accuracy",   label: "Overall", unit: "%", invertColor: false },
    { key: "scopeAcc",   label: "Scope",   unit: "%", invertColor: false },
    { key: "literalAcc", label: "Literal", unit: "%", invertColor: false },
    { key: "finalLevel", label: "Level",   unit: "",  invertColor: false },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
