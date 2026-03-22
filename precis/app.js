import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  questionsPerSession: 10,
  phaseBRate: 0.25,           // 25% Literal, 75% Exploit
  timeByLevel: [0, 14, 12, 10, 8, 7, 6],  // index = level
  phaseCBonusSec: 8,
  levelUpEvery: 3,
  maxLevel: 6,
  feedbackMs: 500,
  wrongMs: 1100,
};

// ── Domain ────────────────────────────────────────────────
const ATTRS = [
  { key: "active",   pos: "active",    neg: "inactive"   },
  { key: "approved", pos: "approved",  neg: "unapproved" },
  { key: "flagged",  pos: "flagged",   neg: "unflagged"  },
  { key: "premium",  pos: "premium",   neg: "standard"   },
  { key: "urgent",   pos: "urgent",    neg: "non-urgent" },
];

// ── Utilities ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ── AST ──────────────────────────────────────────────────
function leaf(attr, negated = false) {
  return { type: "LEAF", attr: attr.key, pos: attr.pos, neg: attr.neg, negated };
}

function bin(type, left, right) { return { type, left, right }; }

// Generate rule AST. allowNegation=true for Phase B (adds NOT leaves and UNLESS).
function genAST(level, allowNegation = false) {
  const attrs = pickN(ATTRS, level <= 1 ? 2 : 3);
  const mk = (attr) => leaf(attr, allowNegation && level >= 2 && Math.random() < 0.3);

  if (level === 1) {
    return bin(pick(["AND", "OR"]), mk(attrs[0]), mk(attrs[1]));
  }

  const op1 = pick(["AND", "OR"]);
  const op2 = op1 === "AND" ? "OR" : "AND";
  const base = Math.random() < 0.5
    ? bin(op2, bin(op1, mk(attrs[0]), mk(attrs[1])), mk(attrs[2]))
    : bin(op1, mk(attrs[0]), bin(op2, mk(attrs[1]), mk(attrs[2])));

  // Add UNLESS at level 3+ — the key "catch" mechanism
  if (allowNegation && level >= 3 && Math.random() < 0.45) {
    const used = collectAttrs(base);
    const extra = ATTRS.filter((a) => !used.has(a.key));
    if (extra.length) return { type: "UNLESS", main: base, cond: leaf(pick(extra)) };
  }

  return base;
}

// Evaluate AST against a payload { attr: boolean, ... }
function evalAST(node, payload) {
  if (node.type === "LEAF")   return node.negated ? !payload[node.attr] : !!payload[node.attr];
  if (node.type === "AND")    return evalAST(node.left, payload) && evalAST(node.right, payload);
  if (node.type === "OR")     return evalAST(node.left, payload) || evalAST(node.right, payload);
  if (node.type === "UNLESS") return evalAST(node.main, payload) && !evalAST(node.cond, payload);
  return false;
}

// Collect all attr keys referenced by a rule
function collectAttrs(node, out = new Set()) {
  if (node.type === "LEAF") { out.add(node.attr); return out; }
  if (node.left)  collectAttrs(node.left, out);
  if (node.right) collectAttrs(node.right, out);
  if (node.main)  collectAttrs(node.main, out);
  if (node.cond)  collectAttrs(node.cond, out);
  return out;
}

// ── NL rendering (unambiguous, for Phase B) ───────────────
function renderLeaf(node) { return node.negated ? `NOT ${node.pos}` : node.pos; }

// unambiguous=true adds parens around OR-inside-AND for Phase B standalone rules.
// Linked Phase B rules omit them (player just parsed the structure themselves).
function renderAST(node, unambiguous = true) {
  if (node.type === "LEAF") return renderLeaf(node);
  if (node.type === "AND") {
    const wrap = (n) => unambiguous && n.type === "OR" ? `(${renderAST(n, true)})` : renderAST(n, unambiguous);
    return `${wrap(node.left)} AND ${wrap(node.right)}`;
  }
  if (node.type === "OR") {
    return `${renderAST(node.left, unambiguous)} OR ${renderAST(node.right, unambiguous)}`;
  }
  if (node.type === "UNLESS") {
    return `${renderAST(node.main, unambiguous)}, UNLESS ${renderAST(node.cond, unambiguous)}`;
  }
  return "";
}

function highlightKeywords(text) {
  return text
    .replace(/\bNOT\b/g,    '<span class="kw-not">NOT</span>')
    .replace(/\bAND\b/g,    '<span class="kw-and">AND</span>')
    .replace(/\bOR\b/g,     '<span class="kw-or">OR</span>')
    .replace(/\bUNLESS\b/g, '<span class="kw-unless">UNLESS</span>');
}

// ── Payload generation ────────────────────────────────────
function genPayload(ast) {
  const payload = {};
  for (const k of collectAttrs(ast)) payload[k] = Math.random() < 0.5;
  return payload;
}

// Generate a payload specifically designed to be a "trap" — counterintuitive edge case.
// Strategy: generate many candidates, prefer ones at the decision boundary
// (flipping one attribute would change the result) or ones where the result
// contradicts the naive "everything positive = passes" assumption.
function genTrapPayload(ast) {
  const keys = [...collectAttrs(ast)];
  const candidates = Array.from({ length: 12 }, () => genPayload(ast));

  // "Naive" assumption: all positive attrs → what result does the rule give?
  const allPos = Object.fromEntries(keys.map((k) => [k, true]));
  const naiveResult = evalAST(ast, allPos);

  // Prefer payloads that CONTRADICT the naive result — these are the "catches"
  const surprising = candidates.filter((p) => evalAST(ast, p) !== naiveResult);
  if (surprising.length > 0) return pick(surprising);

  // Fallback: prefer boundary payloads (flip one attr → different result)
  const boundary = candidates.filter((p) => {
    const r = evalAST(ast, p);
    return keys.some((k) => evalAST(ast, { ...p, [k]: !p[k] }) !== r);
  });
  if (boundary.length > 0) return pick(boundary);

  return pick(candidates);
}

// ── Phase C: Exploit engine ───────────────────────────────

// Like genTrapPayload but guaranteed to PASS the rule.
function genPassingTrapPayload(ast) {
  const keys = [...collectAttrs(ast)];
  const passing = Array.from({ length: 30 }, () => genPayload(ast)).filter((p) => evalAST(ast, p));

  if (passing.length === 0) {
    for (let bits = 0; bits < (1 << keys.length); bits++) {
      const p = Object.fromEntries(keys.map((k, i) => [k, !!(bits & (1 << i))]));
      if (evalAST(ast, p)) return p;
    }
    return Object.fromEntries(keys.map((k) => [k, false]));
  }

  const allPos = Object.fromEntries(keys.map((k) => [k, true]));
  if (!evalAST(ast, allPos)) return pick(passing); // all-positive fails → any pass is surprising

  // Prefer payloads with the most "negative" (false) attrs — maximally counterintuitive
  const withNeg = passing.filter((p) => keys.some((k) => !p[k]));
  if (withNeg.length > 0) {
    const scored = withNeg.map((p) => ({ p, n: keys.filter((k) => !p[k]).length }));
    scored.sort((a, b) => b.n - a.n);
    return scored[0].p;
  }
  return pick(passing);
}

// Identify the structural clause that clinched the pass — the loophole.
function findLoophole(node, payload) {
  if (node.type === "UNLESS" && !evalAST(node.cond, payload)) {
    const condAttr = ATTRS.find((a) => a.key === node.cond.attr);
    return { label: `UNLESS ${condAttr.pos} didn't fire`, attrs: collectAttrs(node.main) };
  }
  if (node.type === "OR") {
    const lp = evalAST(node.left, payload);
    const rp = evalAST(node.right, payload);
    if (lp && !rp) return { label: "passed via OR branch", attrs: collectAttrs(node.left) };
    if (rp && !lp) return { label: "passed via OR branch", attrs: collectAttrs(node.right) };
  }
  if (node.left)  { const r = findLoophole(node.left,  payload); if (r) return r; }
  if (node.right) { const r = findLoophole(node.right, payload); if (r) return r; }
  if (node.main)  { const r = findLoophole(node.main,  payload); if (r) return r; }
  return { label: "all conditions satisfied", attrs: collectAttrs(node) };
}

function hasChoice(node) {
  if (node.type === "OR" || node.type === "UNLESS") return true;
  if (node.left  && hasChoice(node.left))  return true;
  if (node.right && hasChoice(node.right)) return true;
  if (node.main  && hasChoice(node.main))  return true;
  return false;
}

function genExploitQuestion(level) {
  // Exploit needs at least 3-term rules with OR/UNLESS to produce real loopholes
  const effectiveLevel = Math.max(level, 2);
  let ast;
  for (let i = 0; i < 15; i++) {
    ast = genAST(effectiveLevel, true);
    if (hasChoice(ast)) break;
  }
  const ruleKeys = [...collectAttrs(ast)];
  const target = genPassingTrapPayload(ast);

  // "Wrong" attrs: ones that deviate from naive expectation (all-positive)
  const allPos = Object.fromEntries(ruleKeys.map((k) => [k, true]));
  const naiveResult = evalAST(ast, allPos);
  const wrongAttrs = {};
  for (const k of ruleKeys) {
    if (naiveResult ? target[k] === false : target[k] === true) wrongAttrs[k] = target[k];
  }
  if (Object.keys(wrongAttrs).length === 0) wrongAttrs[ruleKeys[0]] = target[ruleKeys[0]];

  const maxWrong = effectiveLevel <= 2 ? 1 : effectiveLevel <= 3 ? 2 : 3;
  const objKeys  = Object.keys(wrongAttrs).slice(0, maxWrong);
  const objAttrs = Object.fromEntries(objKeys.map((k) => [k, wrongAttrs[k]]));

  const numDist  = effectiveLevel >= 4 ? 2 : effectiveLevel >= 3 ? (Math.random() < 0.5 ? 1 : 0) : 0;
  const distAttrs = pickN(ATTRS.filter((a) => !new Set(ruleKeys).has(a.key)), numDist);
  const distKeys  = distAttrs.map((a) => a.key);

  const chipKeys   = [...ruleKeys, ...distKeys];
  const initPayload = Object.fromEntries(
    chipKeys.map((k) => [k, objAttrs[k] !== undefined ? objAttrs[k] : false])
  );
  const objDesc = objKeys.map((k) => {
    const attr = ATTRS.find((a) => a.key === k);
    return objAttrs[k] ? attr.pos : attr.neg;
  }).join(", ");

  return { phase: "C", ast, ruleText: renderAST(ast, true), target, objAttrs, ruleKeys, distKeys, chipKeys, initPayload, objDesc };
}

// ── Phase B: Literal question ─────────────────────────────
// Build a Phase B question from a given AST (used both standalone and for linked mode).
function genLiteralFromAST(ast, isLinked = false) {
  const payload = genTrapPayload(ast);
  // Add 1–2 distractor attributes (not referenced by the rule) as noise
  const ruleKeys = collectAttrs(ast);
  const distractors = pickN(ATTRS.filter((a) => !ruleKeys.has(a.key)), Math.random() < 0.5 ? 1 : 2);
  for (const d of distractors) payload[d.key] = Math.random() < 0.5;
  const result = evalAST(ast, payload);
  // Linked questions skip disambiguation parens — player just parsed the structure
  return { phase: "B", ast, payload, result, ruleText: renderAST(ast, !isLinked) };
}

function genLiteralQuestion(level) {
  return genLiteralFromAST(genAST(level, true));
}

// ── State ─────────────────────────────────────────────────
let state = null;

function fresh() {
  return {
    phase: "idle",
    questionIdx: 0,
    score: 0, correct: 0, incorrect: 0,
    literalCorrect: 0, literalTotal: 0,
    exploitCorrect: 0, exploitTotal: 0,
    consecutiveCorrect: 0,
    level: 1,
    currentQ: null,
    playerPayload: {},
    wrongAttempts: 0,
    timerRaf: null,
    timerEnd: 0,
    target: 10,
  };
}

// ── Brain fill ────────────────────────────────────────────
const brainProgress = document.querySelector(".brain-progress-fill");
const brainFire     = document.querySelector(".brain-fire-fill");

function setBrainFill(p) {
  const inset = Math.round(88 - p * (88 - 8));
  brainProgress.style.setProperty("--progress-inset", inset + "%");
  brainFire.style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(p, inset);
}

// ── Init ──────────────────────────────────────────────────
let scoreTarget = 10;
getHistory().then((h) => {
  if (h.length) scoreTarget = Math.max(...h.map((s) => s.metrics.score)) + 1;
});

(async () => {
  try {
    const m = await (await fetch("manifest.json")).json();
    if (m.version) $("app-version").textContent = "v" + m.version;
  } catch {}
})();

initHaptic();
FireSystem.init();
setBrainFill(0);

// ── Timer ─────────────────────────────────────────────────
function startTimer(seconds) {
  const bar = $("timer-bar");
  const end = performance.now() + seconds * 1000;
  state.timerEnd = end;

  function tick() {
    const rem  = Math.max(0, state.timerEnd - performance.now());
    const frac = rem / (seconds * 1000);
    bar.style.transform = `scaleX(${frac})`;
    bar.classList.toggle("urgent", frac < 0.25);
    if (rem <= 0) { onAnswer(false, true); return; }
    state.timerRaf = requestAnimationFrame(tick);
  }
  state.timerRaf = requestAnimationFrame(tick);
}

function stopTimer() {
  if (state.timerRaf) { cancelAnimationFrame(state.timerRaf); state.timerRaf = null; }
}

// ── Phase C: Chip rendering ───────────────────────────────
// loopholeAttrs: Set of attr keys to highlight (post-reveal); null = interactive mode.
function renderChips(loopholeAttrs = null) {
  const q = state.currentQ;
  $("chip-grid").innerHTML = q.chipKeys.map((k) => {
    const attr = ATTRS.find((a) => a.key === k);
    const isOn      = state.playerPayload[k];
    const isDist    = q.distKeys.includes(k);
    const isLoophole = loopholeAttrs && loopholeAttrs.has(k);
    const cls = ["attr-chip", "chip-toggle",
      isOn       ? "chip-on"       : "",
      isDist     ? "attr-distract" : "",
      isLoophole ? "chip-loophole" : "",
    ].filter(Boolean).join(" ");
    return `<button class="${cls}" data-key="${k}"${loopholeAttrs ? " disabled" : ""}>${isOn ? attr.pos : attr.neg}</button>`;
  }).join("");

  if (!loopholeAttrs) {
    $("chip-grid").querySelectorAll(".chip-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.phase !== "playing") return;
        state.playerPayload[btn.dataset.key] = !state.playerPayload[btn.dataset.key];
        triggerHaptic();
        renderChips();
      });
    });
  }
}

// ── Display ───────────────────────────────────────────────
function showQuestion(q) {
  state.currentQ = q;

  // Reset button feedback states
  ["deny-btn", "allow-btn"].forEach((id) => {
    $(id)?.classList.remove("btn-correct", "btn-wrong", "btn-hint");
  });

  // Update HUD
  const phaseBadge = $("phase-badge");
  phaseBadge.textContent = q.phase === "B" ? "LITERAL" : "EXPLOIT";
  phaseBadge.classList.add("visible");
  $("q-counter").textContent = `${state.questionIdx + 1} / ${CONFIG.questionsPerSession}`;

  // Reset timer bar
  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");

  // Show correct phase area + controls
  $("phase-b-area").classList.toggle("hidden", q.phase !== "B");
  $("phase-c-area").classList.toggle("hidden", q.phase !== "C");
  $("phase-b-btns").classList.toggle("hidden", q.phase !== "B");
  $("submit-btn").classList.toggle("hidden",   q.phase !== "C");

  if (q.phase === "C") {
    $("rule-text-c").innerHTML = highlightKeywords(q.ruleText);
    $("obj-attrs").textContent = q.objDesc;
    state.playerPayload = { ...q.initPayload };
    state.wrongAttempts = 0;
    renderChips();
    $("reveal-area").classList.add("hidden");
    $("feedback-bar").textContent = "";
    $("feedback-bar").className = "feedback-bar";
  }

  if (q.phase === "B") {
    $("rule-text").innerHTML = highlightKeywords(q.ruleText);

    // Show all payload keys (rule attrs + distractors); distractors styled differently
    const ruleKeys = collectAttrs(q.ast);
    $("payload-card").innerHTML = Object.keys(q.payload).map((k) => {
      const attr       = ATTRS.find((a) => a.key === k);
      const isTrue     = q.payload[k];
      const label      = isTrue ? attr.pos : attr.neg;
      const isDistract = !ruleKeys.has(k);
      return `<span class="attr-chip ${isTrue ? "attr-true" : "attr-false"}${isDistract ? " attr-distract" : ""}">${label}</span>`;
    }).join("");
  }

  const timeSec = (CONFIG.timeByLevel[state.level] || 5)
    + (q.phase === "C" ? CONFIG.phaseCBonusSec : 0);
  state.phase = "playing";
  startTimer(timeSec);
}

// ── Answer handling ───────────────────────────────────────
function onAnswer(correct, isTimeout = false) {
  if (state.phase !== "playing") return;

  // Phase C has its own flow; only intercept the timer-triggered timeout
  if (isTimeout && state.currentQ?.phase === "C") {
    state.phase = "feedback";
    stopTimer();
    state.incorrect++;
    state.exploitTotal++;
    state.consecutiveCorrect = 0;
    triggerHapticError();
    state.playerPayload = { ...state.currentQ.target };
    const loophole = findLoophole(state.currentQ.ast, state.currentQ.target);
    renderChips(loophole.attrs);
    $("reveal-label").textContent = loophole.label + " — time's up";
    $("reveal-area").classList.remove("hidden");
    $("submit-btn").classList.add("hidden");
    setTimeout(() => {
      state.questionIdx++;
      if (state.questionIdx >= CONFIG.questionsPerSession) endSession();
      else nextQuestion();
    }, 2200);
    return;
  }

  state.phase = "feedback";
  stopTimer();

  const q = state.currentQ;

  if (isTimeout) {
    (q.result ? $("allow-btn") : $("deny-btn")).classList.add("btn-hint");
  }

  if (correct) {
    state.score++;
    state.correct++;
    state.consecutiveCorrect++;
    state.literalCorrect++;
    triggerHaptic();
    setBrainFill(Math.min(1, state.score / state.target));
    if (state.consecutiveCorrect >= CONFIG.levelUpEvery) {
      state.consecutiveCorrect = 0;
      state.level = Math.min(CONFIG.maxLevel, state.level + 1);
    }
  } else {
    state.incorrect++;
    state.consecutiveCorrect = 0;
    if (!isTimeout) triggerHapticError();
  }

  state.literalTotal++;
  $("score-display").textContent = state.score;

  setTimeout(() => {
    state.questionIdx++;
    if (state.questionIdx >= CONFIG.questionsPerSession) endSession();
    else nextQuestion();
  }, correct ? CONFIG.feedbackMs : CONFIG.wrongMs);
}

// ── Phase C: Submit ───────────────────────────────────────
function onExploitSubmit() {
  if (state.phase !== "playing") return;
  const q = state.currentQ;
  const payload = state.playerPayload;
  const passes = evalAST(q.ast, payload);
  const objOk  = Object.keys(q.objAttrs).every((k) => payload[k] === q.objAttrs[k]);

  if (passes && objOk) {
    state.phase = "feedback";
    stopTimer();
    state.score++;
    state.correct++;
    state.exploitCorrect++;
    state.exploitTotal++;
    state.consecutiveCorrect++;
    triggerHaptic();
    setBrainFill(Math.min(1, state.score / state.target));
    $("score-display").textContent = state.score;
    if (state.consecutiveCorrect >= CONFIG.levelUpEvery) {
      state.consecutiveCorrect = 0;
      state.level = Math.min(CONFIG.maxLevel, state.level + 1);
    }
    const loophole = findLoophole(q.ast, payload);
    renderChips(loophole.attrs);
    $("reveal-label").textContent = loophole.label;
    $("reveal-area").classList.remove("hidden");
    $("submit-btn").classList.add("hidden");
    setTimeout(() => {
      state.questionIdx++;
      if (state.questionIdx >= CONFIG.questionsPerSession) endSession();
      else nextQuestion();
    }, 1500);
  } else {
    // Wrong submit: penalise score, stay on question
    state.wrongAttempts++;
    state.consecutiveCorrect = 0;
    state.score = Math.max(0, state.score - 1);
    $("score-display").textContent = state.score;
    triggerHapticError();
    let msg;
    if (!objOk) {
      const needed = Object.keys(q.objAttrs)
        .filter((k) => payload[k] !== q.objAttrs[k])
        .map((k) => { const a = ATTRS.find((x) => x.key === k); return q.objAttrs[k] ? a.pos : a.neg; })
        .join(", ");
      msg = `objective not met — needs: ${needed}`;
    } else {
      msg = "rule not satisfied — keep trying";
    }
    const fb = $("feedback-bar");
    fb.textContent = msg;
    fb.className = "feedback-bar fb-wrong";
    setTimeout(() => {
      if (state.phase === "playing") { fb.textContent = ""; fb.className = "feedback-bar"; }
    }, 1500);
  }
}

// ── Game flow ─────────────────────────────────────────────
function nextQuestion() {
  if (Math.random() < CONFIG.phaseBRate) showQuestion(genLiteralQuestion(state.level));
  else                                   showQuestion(genExploitQuestion(state.level));
}

function startSession() {
  state = fresh();
  state.target = scoreTarget;
  $("idle-overlay").classList.add("hidden");
  $("play-btn").classList.add("hidden");
  $("timer-track").classList.remove("hidden");
  $("score-display").textContent = "0";
  setBrainFill(0);
  nextQuestion();
}

function endSession() {
  state.phase = "idle";
  stopTimer();

  $("phase-b-area").classList.add("hidden");
  $("phase-c-area").classList.add("hidden");
  $("phase-b-btns").classList.add("hidden");
  $("submit-btn").classList.add("hidden");

  const total      = state.correct + state.incorrect;
  const accuracy   = total ? Math.round(state.correct / total * 100) : 0;
  const literalAcc = state.literalTotal ? Math.round(state.literalCorrect / state.literalTotal * 100) : null;
  const exploitAcc = state.exploitTotal ? Math.round(state.exploitCorrect / state.exploitTotal * 100) : null;

  $("modal-score").textContent        = state.score;
  $("modal-accuracy").textContent     = accuracy + "%";
  $("modal-literal-acc").textContent  = literalAcc !== null ? literalAcc + "%" : "—";
  $("modal-exploit-acc").textContent  = exploitAcc !== null ? exploitAcc + "%" : "—";
  $("modal-level").textContent        = state.level;

  saveSession({ score: state.score, accuracy, literalAcc, exploitAcc, finalLevel: state.level });
  if (state.score >= scoreTarget) scoreTarget = state.score + 1;

  $("results-modal").classList.remove("hidden");
}

function resetSession() {
  stopTimer();
  state = fresh();

  $("idle-overlay").classList.remove("hidden");
  $("play-btn").classList.remove("hidden");
  $("phase-b-area").classList.add("hidden");
  $("phase-c-area").classList.add("hidden");
  $("phase-b-btns").classList.add("hidden");
  $("submit-btn").classList.add("hidden");
  $("results-modal").classList.add("hidden");
  $("phase-badge").classList.remove("visible");
  $("q-counter").textContent = "";
  $("score-display").textContent = "";
  $("chip-grid").innerHTML = "";
  $("reveal-area").classList.add("hidden");
  $("feedback-bar").textContent = "";

  $("timer-track").classList.add("hidden");
  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");
  setBrainFill(0);
}

// ── Events ────────────────────────────────────────────────
$("play-btn").addEventListener("click", () => { triggerHaptic(); startSession(); });
$("submit-btn").addEventListener("click", () => { triggerHaptic(); onExploitSubmit(); });
$("modal-close-btn").addEventListener("click", () => { triggerHaptic(); resetSession(); });
$("stats-btn").addEventListener("click", () => { triggerHaptic(); openHistoryModal(); });
$("close-history-btn").addEventListener("click", () => $("history-modal").classList.add("hidden"));

$("deny-btn").addEventListener("click", () => {
  if (state?.phase !== "playing") return;
  triggerHaptic();
  const correct = !state.currentQ.result;
  $(correct ? "deny-btn" : "allow-btn").classList.add(correct ? "btn-correct" : "btn-hint");
  if (!correct) $("deny-btn").classList.add("btn-wrong");
  onAnswer(correct);
});

$("allow-btn").addEventListener("click", () => {
  if (state?.phase !== "playing") return;
  triggerHaptic();
  const correct = state.currentQ.result;
  $(correct ? "allow-btn" : "deny-btn").classList.add(correct ? "btn-correct" : "btn-hint");
  if (!correct) $("allow-btn").classList.add("btn-wrong");
  onAnswer(correct);
});

