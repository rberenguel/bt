import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

const { open } = makeHistoryUI({
    getHistory,
    metricDefs: [
        { key: "redAccuracy",     label: "Red accuracy",       unit: "%", invertColor: false },
        { key: "yellowAccuracy",  label: "Yellow accuracy",    unit: "%", invertColor: false },
        { key: "tilesReachedRed", label: "Contexts memorised", unit: "",  invertColor: false },
    ],
    listElId:     "history-list",
    modalElId:    "history-modal",
    sessionTitle: (s, i) => `Session ${i + 1}`,
});

export const openHistoryModal = open;
