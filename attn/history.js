import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "eb", label: "Eff. balls", unit: "", invertColor: false },
    { key: "balls", label: "Balls", unit: "", invertColor: false },
    { key: "accuracy", label: "Accuracy", unit: "%", invertColor: false },
    { key: "score", label: "Score", unit: "/5", invertColor: false },
    { key: "phase1", label: "Phase 1", unit: "/1", invertColor: false },
    { key: "phase2", label: "Phase 2", unit: "/1", invertColor: false },
    { key: "phase3", label: "Phase 3", unit: "/3", invertColor: false },
  ],
  sessionTitle: (s, i) => "Session " + (i + 1) + " — " + s.metrics.balls + " balls",
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
