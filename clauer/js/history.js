import { makeHistoryUI } from "../../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    {
      key: "cpm",
      label: "CPM",
      desc: "Throughput",
      unit: "",
      invertColor: false,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      desc: "Correctness",
      unit: "%",
      invertColor: false,
    },
    { key: "cv", label: "CV", desc: "Stability", unit: "%", invertColor: true },
    {
      key: "ies",
      label: "IES",
      desc: "Efficiency",
      unit: "",
      invertColor: true,
    },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
  openModal: (el) => el.classList.add("visible"),
  sessionTitle: (s) => s.mode + " (" + s.config + ")",
});

export const openHistoryModal = open;
