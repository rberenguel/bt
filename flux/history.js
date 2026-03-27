import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
  getHistory,
  metricDefs: [
    {
      key: "pmHitRate",
      label: "PM hits",
      desc: "Prospective memory hit rate",
      unit: "%",
      invertColor: false,
    },
    {
      key: "falseAlarmRate",
      label: "False alarms",
      desc: "Center taps on non-targets",
      unit: "%",
      invertColor: true,
    },
    {
      key: "missRate",
      label: "Misses",
      desc: "Deadline-expired trials",
      unit: "%",
      invertColor: true,
    },
    {
      key: "rtCost",
      label: "RT cost",
      desc: "Monitoring tax (ms)",
      unit: "ms",
      invertColor: true,
    },
    {
      key: "level",
      label: "Level",
      unit: "",
      invertColor: false,
    },
  ],
  listElId: "history-list",
  modalElId: "history-modal",
});

export const openHistoryModal = open;
