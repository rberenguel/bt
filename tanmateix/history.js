import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const METRIC_DEFS = [
  { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
  {
    key: "score",
    label: "Score",
    unit: "",
    invertColor: false,
    format: (v, s) => (s.metrics.total ? `${v}/${s.metrics.total}` : `${v}/30`),
  },
  { key: "maxStreak", label: "Streak", unit: "", invertColor: false },
  { key: "finalLevel", label: "Level", unit: "", invertColor: false },
];

export function openHistoryModal() {
  makeHistoryUI({
    getHistory,
    metricDefs: METRIC_DEFS,
    listElId: "history-list",
    modalElId: "history-modal",
    openModal: (el) => el.classList.add("visible"),
    filterDisplay: (s) => s.metrics.total !== undefined,
  }).open();
}
