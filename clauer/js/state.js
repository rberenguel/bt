import { DEFAULT_GAME_PARAMS } from "./constants.js";

export const state = {
  gameParams: { ...DEFAULT_GAME_PARAMS },
  keyMap: new Map(),
  sequence: [],
  currentItemIndex: 0,
  errorCount: 0,
  gameActive: false,
  startTime: 0,
  pauseTime: 0,
  totalPausedTime: 0,
  isPaused: false,
  isHardMode: false,
  isMemorizeMode: false,
  isShuffleMode: false,
  isMemorizing: false,
  memorizeTimer: null,
  currentSessionStats: {},
  // Detailed logs for granular metrics
  // Each entry: { timestamp, responseTime, correct, isSwitch, itemIndex, batchIndex }
  sessionLogs: [],
  allSessionsData: [],
  batchKeys: [],
  itemStartTime: 0,
  markdownStats: "",
};

export function resetStateForNewGame() {
  state.currentItemIndex = 0;
  state.errorCount = 0;
  state.totalPausedTime = 0;
  state.isPaused = false;
  state.isMemorizing = false;

  if (state.memorizeTimer) {
    clearTimeout(state.memorizeTimer);
    state.memorizeTimer = null;
  }

  state.sequence = [];
  state.keyMap.clear();
  state.currentSessionStats = {};
  state.sessionLogs = [];
  state.markdownStats = "";
}

export function updateParameter(param, value) {
  state.gameParams[param] = value;
}
