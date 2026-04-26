import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  roundsPerSession: 20,
  correctStep: 1,
  wrongStep: 1,
};

// level → { bugProb, baseTime, perLine }
// time = baseTime + totalLines × perLine
// Fil lines cost more than Tanmateix premises: icon grammar + tab switching overhead
const LEVELS = [
  { bugProb: 0.85, baseTime: 18,  perLine: 3.0 }, // 1 → 7-line eg: ~39s
  { bugProb: 0.70, baseTime: 16,  perLine: 2.7 }, // 2
  { bugProb: 0.55, baseTime: 14,  perLine: 2.4 }, // 3
  { bugProb: 0.60, baseTime: 12,  perLine: 2.1 }, // 4
  { bugProb: 0.50, baseTime: 10,  perLine: 1.8 }, // 5
  { bugProb: 0.40, baseTime:  8,  perLine: 1.6 }, // 6
  { bugProb: 0.30, baseTime:  7,  perLine: 1.4 }, // 7
  { bugProb: 0.22, baseTime:  6,  perLine: 1.2 }, // 8 → 9-line eg: ~17s
];
const MAX_LEVEL = LEVELS.length;

// ── Icon grammar ────────────────────────────────────────────
const I = {
  PTR: (n) => `<span class="ptr-group"><i class="ph-light ph-asterisk"></i><span class="var-name">${n}</span></span>`,
  DEF: (icon) => `<span class="func-group"><i class="ph-light ${icon}"></i></span>`,
  CALL: (icon) => `<i class="ph-light ph-play-circle"></i> <span class="func-group"><i class="ph-light ${icon}"></i></span>`,
  RES: (s) => `<i class="ph-light ${s} c-yellow"></i>`,
  ARROW: '<i class="ph-light ph-arrow-right"></i>',
  ALLOC: '<i class="ph-light ph-plus-circle c-green"></i>',
  FREE: '<i class="ph-light ph-minus-circle c-red"></i>',
  READ: '<i class="ph-light ph-eye"></i>',
  HAMMER: '<i class="ph-light ph-hammer"></i>',
  BROOM: '<i class="ph-light ph-broom"></i>',
  HANDSHAKE: '<i class="ph-light ph-handshake"></i>',
  PACKAGE: '<i class="ph-light ph-package"></i>',
};

const L = (indent, html) => ({ indent, html });
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Scenario generators ─────────────────────────────────────

function genDeepMutation(hasBug) {
  const shape = randItem(['ph-square', 'ph-circle']);

  const fn2 = [
    L(0, `${I.DEF('ph-diamond', 'fn2')} ${I.HANDSHAKE} ${I.PTR('Z')}`),
    L(1, `${I.HAMMER} ${I.PTR('Z')}`),
  ];

  const fn1 = [
    L(0, `${I.DEF('ph-hexagon', 'fn1')} ${I.HANDSHAKE} ${I.PTR('Y')}`),
    L(1, `${I.READ} ${I.PTR('Y')}`),
    L(1, `${I.CALL('ph-diamond', 'fn2')} ${I.PTR('Y')}`),
  ];

  const main = [
    L(0, `${I.PTR('A')} ${I.ARROW} ${I.ALLOC} ${I.RES(shape)}`),
    L(0, `${I.CALL('ph-hexagon', 'fn1')} ${I.PTR('A')}`),
  ];

  let bugTab = null, bugLine = -1;
  if (hasBug) {
    main.push(L(0, `${I.FREE} ${I.PTR('A')}`));
    bugTab = 'main'; bugLine = 2;
  } else {
    main.push(L(0, `${I.BROOM} ${I.PTR('A')}`));
    main.push(L(0, `${I.FREE} ${I.PTR('A')}`));
  }

  return { tabs: [{ id: 'fn2', lines: fn2 }, { id: 'fn1', lines: fn1 }, { id: 'main', lines: main }], bugTab, bugLine };
}

function genDeepLeak(hasBug) {
  const shape = randItem(['ph-square', 'ph-circle']);

  const fn2 = [
    L(0, `${I.DEF('ph-diamond', 'fn2')} ${I.PACKAGE} ${I.PTR('Z')}`),
    L(1, `${I.HAMMER} ${I.PTR('Z')}`),
  ];

  let bugTab = null, bugLine = -1;
  if (hasBug) {
    bugTab = 'fn2'; bugLine = 0;
  } else {
    fn2.push(L(1, `${I.BROOM} ${I.PTR('Z')}`));
    fn2.push(L(1, `${I.FREE} ${I.PTR('Z')}`));
  }

  const fn1 = [
    L(0, `${I.DEF('ph-hexagon', 'fn1')} ${I.PACKAGE} ${I.PTR('Y')}`),
    L(1, `${I.CALL('ph-diamond', 'fn2')} ${I.PTR('Y')}`),
  ];

  const main = [
    L(0, `${I.PTR('A')} ${I.ARROW} ${I.ALLOC} ${I.RES(shape)}`),
    L(0, `${I.CALL('ph-hexagon', 'fn1')} ${I.PTR('A')}`),
  ];

  return { tabs: [{ id: 'fn2', lines: fn2 }, { id: 'fn1', lines: fn1 }, { id: 'main', lines: main }], bugTab, bugLine };
}

function genIllegalDeepFree(hasBug) {
  const shape = randItem(['ph-square', 'ph-circle']);

  const fn2 = [
    L(0, `${I.DEF('ph-diamond', 'fn2')} ${I.HANDSHAKE} ${I.PTR('Z')}`),
  ];

  let bugTab = null, bugLine = -1;
  if (hasBug) {
    fn2.push(L(1, `${I.FREE} ${I.PTR('Z')}`));
    bugTab = 'fn2'; bugLine = 1;
  } else {
    fn2.push(L(1, `${I.READ} ${I.PTR('Z')}`));
  }

  const fn1 = [
    L(0, `${I.DEF('ph-hexagon', 'fn1')} ${I.HANDSHAKE} ${I.PTR('Y')}`),
    L(1, `${I.CALL('ph-diamond', 'fn2')} ${I.PTR('Y')}`),
  ];

  const main = [
    L(0, `${I.PTR('A')} ${I.ARROW} ${I.ALLOC} ${I.RES(shape)}`),
    L(0, `${I.CALL('ph-hexagon', 'fn1')} ${I.PTR('A')}`),
    L(0, `${I.FREE} ${I.PTR('A')}`),
  ];

  return { tabs: [{ id: 'fn2', lines: fn2 }, { id: 'fn1', lines: fn1 }, { id: 'main', lines: main }], bugTab, bugLine };
}

function genDanglingAlias(hasBug) {
  const shape = randItem(['ph-square', 'ph-circle']);

  const fn1 = [
    L(0, `${I.DEF('ph-hexagon', 'fn1')} ${I.PACKAGE} ${I.PTR('Y')}`),
    L(1, `${I.FREE} ${I.PTR('Y')}`),
  ];

  const main = [
    L(0, `${I.PTR('A')} ${I.ARROW} ${I.ALLOC} ${I.RES(shape)}`),
    L(0, `${I.PTR('B')} ${I.ARROW} ${I.PTR('A')}`),
    L(0, `${I.CALL('ph-hexagon', 'fn1')} ${I.PTR('A')}`),
  ];

  let bugTab = null, bugLine = -1;
  if (hasBug) {
    main.push(L(0, `${I.READ} ${I.PTR('B')}`));
    bugTab = 'main'; bugLine = 3;
  } else {
    main.push(L(0, `${I.PTR('B')} ${I.ARROW} ${I.ALLOC} ${I.RES('ph-triangle')}`));
    main.push(L(0, `${I.FREE} ${I.PTR('B')}`));
  }

  return { tabs: [{ id: 'fn1', lines: fn1 }, { id: 'main', lines: main }], bugTab, bugLine };
}

const ALL_GENERATORS = [genDeepMutation, genDeepLeak, genIllegalDeepFree, genDanglingAlias];

let lastGenerator = null;

function generateScenario(level) {
  const { bugProb } = LEVELS[level - 1];
  const hasBug = Math.random() < bugProb;
  const pool = ALL_GENERATORS.length > 1
    ? ALL_GENERATORS.filter(g => g !== lastGenerator)
    : ALL_GENERATORS;
  const gen = randItem(pool);
  lastGenerator = gen;
  return gen(hasBug);
}

// ── State ───────────────────────────────────────────────────
let state = null;

function countLines(scenario) {
  return scenario.tabs.reduce((sum, tab) => sum + tab.lines.length, 0);
}

function timeLimitFor(scenario, level) {
  const { baseTime, perLine } = LEVELS[level - 1];
  return baseTime + countLines(scenario) * perLine;
}

function fresh() {
  return {
    phase: 'playing',
    roundIdx: 0,
    level: 1,
    score: 0,
    correct: 0,
    incorrect: 0,
    currentScenario: null,
    timerRaf: null,
    timerEnd: 0,
  };
}

// ── DOM refs ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const tabBar = $('tab-bar');
const tabContainers = $('tab-containers');
const qCounter = $('q-counter');
const scoreDisplay = $('score-display');
const brainProgress = document.querySelector('.brain-progress-fill');
const brainFire = document.querySelector('.brain-fire-fill');

// ── Timer ───────────────────────────────────────────────────
function startTimer(seconds) {
  const bar = $('timer-bar');
  const end = performance.now() + seconds * 1000;
  state.timerEnd = end;

  function tick() {
    const rem = Math.max(0, state.timerEnd - performance.now());
    const frac = rem / (seconds * 1000);
    bar.style.transform = `scaleX(${frac})`;
    bar.classList.toggle('urgent', frac < 0.25);
    if (rem <= 0) { onTimeout(); return; }
    state.timerRaf = requestAnimationFrame(tick);
  }
  state.timerRaf = requestAnimationFrame(tick);
}

function stopTimer() {
  if (state.timerRaf) { cancelAnimationFrame(state.timerRaf); state.timerRaf = null; }
  const bar = $('timer-bar');
  bar.style.transform = 'scaleX(1)';
  bar.classList.remove('urgent');
}

function onTimeout() {
  if (state.phase !== 'playing') return;
  triggerHapticError();
  onWrong();
}

// ── Brain fill ──────────────────────────────────────────────
function setBrainFill(p) {
  const inset = Math.round(88 - p * (88 - 8));
  brainProgress.style.setProperty('--progress-inset', inset + '%');
  brainFire.style.setProperty('--fire-inset', inset + '%');
  FireSystem.update(p, inset);
}

// ── Tab switching ───────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(pane => pane.classList.remove('active'));
  $(`btn-${tabId}`).classList.add('active');
  $(`pane-${tabId}`).classList.add('active');
}

// ── Round rendering ─────────────────────────────────────────
function renderRound(scenario) {
  tabBar.innerHTML = '';
  tabContainers.innerHTML = '';

  scenario.tabs.forEach((tab) => {
    const isMain = tab.id === 'main';

    const btn = document.createElement('button');
    btn.className = `tab-btn${isMain ? ' active' : ''}`;
    btn.id = `btn-${tab.id}`;
    btn.innerText = tab.id;
    btn.addEventListener('click', () => {
      triggerHaptic();
      switchTab(tab.id);
    });
    tabBar.appendChild(btn);

    const pane = document.createElement('div');
    pane.className = `tab-content${isMain ? ' active' : ''}`;
    pane.id = `pane-${tab.id}`;

    tab.lines.forEach((line, lineIndex) => {
      const div = document.createElement('div');
      div.className = 'code-line';
      div.style.setProperty('--indent-level', line.indent);
      div.innerHTML = `<span class="line-num">${lineIndex}</span>${line.html}`;
      div.addEventListener('click', () => {
        triggerHaptic();
        handleLineClick(tab.id, lineIndex, div);
      });
      pane.appendChild(div);
    });

    tabContainers.appendChild(pane);
  });
}

// ── Answer handling ─────────────────────────────────────────
function handleLineClick(tabId, lineIndex, element) {
  if (state.phase !== 'playing') return;
  const { bugTab, bugLine } = state.currentScenario;
  const correct = bugTab === tabId && bugLine === lineIndex;

  if (correct) {
    element.classList.add('correct');
    onCorrect();
  } else {
    element.classList.add('wrong');
    triggerHapticError();
    onWrong();
  }
}

function handleNoError() {
  if (state.phase !== 'playing') return;
  triggerHaptic();
  if (state.currentScenario.bugTab === null) {
    onCorrect();
  } else {
    triggerHapticError();
    onWrong();
  }
}

function onCorrect() {
  if (state.phase !== 'playing') return;
  state.phase = 'feedback';
  stopTimer();
  state.score++;
  state.correct++;
  state.level = Math.min(MAX_LEVEL, state.level + CONFIG.correctStep);
  setBrainFill(state.score / CONFIG.roundsPerSession);
  scoreDisplay.textContent = state.score;
  showNext();
}

function onWrong() {
  if (state.phase !== 'playing') return;
  state.phase = 'feedback';
  stopTimer();
  state.incorrect++;
  state.level = Math.max(1, state.level - CONFIG.wrongStep);
  // Reveal the bug
  const { bugTab, bugLine } = state.currentScenario;
  if (bugTab) {
    switchTab(bugTab);
    const pane = $(`pane-${bugTab}`);
    if (pane && pane.children[bugLine]) {
      pane.children[bugLine].classList.add('correct');
    }
  }
  showNext();
}

function showNext() {
  $('btn-no-error').classList.add('hidden');
  $('btn-next').classList.remove('hidden');
}

// ── Round / session flow ────────────────────────────────────
function startRound() {
  state.phase = 'playing';
  const scenario = generateScenario(state.level);
  state.currentScenario = scenario;

  qCounter.textContent = `${state.roundIdx + 1} / ${CONFIG.roundsPerSession}`;
  scoreDisplay.textContent = state.score;

  renderRound(scenario);

  $('btn-no-error').classList.remove('hidden');
  $('btn-next').classList.add('hidden');

  const secs = timeLimitFor(scenario, state.level);
  startTimer(secs);
}

function nextRound() {
  triggerHaptic();
  state.roundIdx++;
  if (state.roundIdx >= CONFIG.roundsPerSession) {
    endSession();
  } else {
    startRound();
  }
}

function startSession() {
  state = fresh();
  $('results-modal').classList.add('hidden');
  setBrainFill(0);
  startRound();
}

function endSession() {
  state.phase = 'idle';
  stopTimer();

  const total = state.correct + state.incorrect;
  const accuracy = total ? Math.round((state.correct / total) * 100) : 0;

  $('modal-score').textContent = `${state.score} / ${CONFIG.roundsPerSession}`;
  $('modal-accuracy').textContent = accuracy + '%';
  $('modal-level').textContent = state.level;

  saveSession({ score: state.score, accuracy, finalLevel: state.level });

  $('results-modal').classList.remove('hidden');
}

// ── Init ────────────────────────────────────────────────────
initHaptic();
FireSystem.init();
setBrainFill(0);

(async () => {
  try {
    const m = await (await fetch('manifest.json')).json();
    if (m.version) $('app-version').textContent = 'v' + m.version;
  } catch {}
})();

// ── Events ──────────────────────────────────────────────────
$('btn-no-error').addEventListener('click', () => {
  handleNoError();
});

$('btn-next').addEventListener('click', () => {
  nextRound();
});

$('stats-btn').addEventListener('click', () => {
  triggerHaptic();
  openHistoryModal();
});

$('close-history-btn').addEventListener('click', () => {
  triggerHaptic();
  $('history-modal').classList.add('hidden');
});

$('modal-close-btn').addEventListener('click', () => {
  triggerHaptic();
  startSession();
});

$('btn-help').addEventListener('click', () => {
  triggerHaptic();
  $('help-modal').classList.remove('hidden');
});

$('btn-close-help').addEventListener('click', () => {
  triggerHaptic();
  $('help-modal').classList.add('hidden');
  if (!state || state.phase === 'idle') startSession();
});

// Show help on load; session starts when dismissed
$('help-modal').classList.remove('hidden');
