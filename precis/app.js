import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  questionsPerSession: 15,
  phaseARate: 0.50,           // 50/50 split from the start
  timeByLevel: [0, 14, 12, 10, 8, 7, 6],  // index = level
  phaseABonusSec: 4,
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

// ── Phase A: Scope question ───────────────────────────────
// Returns a question about whether a 3-term mixed-op sentence is ambiguous
// or maps to a specific parse tree.
function genScopeQuestion() {
  const attrs = pickN(ATTRS, 3);
  const op1 = pick(["AND", "OR"]);
  const op2 = op1 === "AND" ? "OR" : "AND";

  // treeA = (attrs[0] op1 attrs[1]) op2 attrs[2]
  // treeB = attrs[0] op1 (attrs[1] op2 attrs[2])

  const isAmbiguous = Math.random() < 0.3;
  let sentence, correctAnswer;

  if (isAmbiguous) {
    // No disambiguation markers — genuinely ambiguous
    sentence = `${attrs[0].pos} ${op1.toLowerCase()} ${attrs[1].pos} ${op2.toLowerCase()} ${attrs[2].pos}`;
    correctAnswer = "ambiguous";
  } else {
    correctAnswer = Math.random() < 0.5 ? "A" : "B";
    if (correctAnswer === "A") {
      // (a op1 b) op2 c: comma before op2 groups left side
      sentence = `${attrs[0].pos} ${op1.toLowerCase()} ${attrs[1].pos}, ${op2.toLowerCase()} ${attrs[2].pos}`;
    } else {
      // a op1 (b op2 c): "either/both" groups the right side
      const groupWord = op2 === "OR" ? "either" : "both";
      sentence = `${attrs[0].pos} ${op1.toLowerCase()} ${groupWord} ${attrs[1].pos} ${op2.toLowerCase()} ${attrs[2].pos}`;
    }
  }

  // Pre-build the linked Phase B question using the correct tree's AST,
  // so correct Phase A immediately chains into evaluating the same rule.
  const treeA = bin(op2, bin(op1, leaf(attrs[0]), leaf(attrs[1])), leaf(attrs[2]));
  const treeB = bin(op1, leaf(attrs[0]), bin(op2, leaf(attrs[1]), leaf(attrs[2])));
  const linkedLiteral = correctAnswer !== "ambiguous"
    ? { ...genLiteralFromAST(correctAnswer === "A" ? treeA : treeB, true), isLinked: true }
    : null;

  return { phase: "A", attrs, op1, op2, sentence, correctAnswer, treeA, treeB, linkedLiteral };
}

// Render one parse-option button's HTML content
// innerOnLeft=true  → [a op1 b] op2 c
// innerOnLeft=false → a op1 [b op2 c]
function renderOptionHtml(innerOnLeft, a, innerOp, b, outerOp, c) {
  const grouped = `${a} <span class="kw-${innerOp.toLowerCase()}">${innerOp}</span> ${b}`;
  const groupSpan = `<span class="parse-group">${grouped}</span>`;
  const restSpan  = `<span class="parse-atom">${c}</span>`;
  const opSpan    = `<span class="kw-${outerOp.toLowerCase()} parse-op">${outerOp}</span>`;
  return innerOnLeft
    ? `${groupSpan} ${opSpan} ${restSpan}`
    : `${restSpan} ${opSpan} ${groupSpan}`;
}

// ── State ─────────────────────────────────────────────────
let state = null;

function fresh() {
  return {
    phase: "idle",
    questionIdx: 0,
    score: 0, correct: 0, incorrect: 0,
    scopeCorrect: 0, scopeTotal: 0,
    literalCorrect: 0, literalTotal: 0,
    consecutiveCorrect: 0,
    level: 1,
    currentQ: null,
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

// ── Display ───────────────────────────────────────────────
function showQuestion(q) {
  state.currentQ = q;

  // Reset button feedback states
  ["deny-btn", "allow-btn", "option-a", "option-b", "ambig-btn"].forEach((id) => {
    $(id)?.classList.remove("btn-correct", "btn-wrong", "btn-hint");
  });

  // Update HUD
  const phaseBadge = $("phase-badge");
  phaseBadge.textContent = q.isLinked ? "→ APPLY IT" : q.phase === "A" ? "SCOPE" : "LITERAL";
  phaseBadge.classList.add("visible");
  $("q-counter").textContent = `${state.questionIdx + 1} / ${CONFIG.questionsPerSession}`;

  // Reset timer bar
  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");

  // Show correct phase area + controls
  $("phase-b-area").classList.toggle("hidden", q.phase !== "B");
  $("phase-a-area").classList.toggle("hidden", q.phase !== "A");
  $("phase-b-btns").classList.toggle("hidden", q.phase !== "B");
  $("ambig-btn").classList.toggle("hidden",    q.phase !== "A");

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
  } else {
    $("scope-sentence").textContent = `"${q.sentence}"`;

    const { attrs, op1, op2 } = q;
    // Option A: (attrs[0] op1 attrs[1]) op2 attrs[2]  →  [a op1 b] op2 c
    $("option-a").innerHTML = renderOptionHtml(true,  attrs[0].pos, op1, attrs[1].pos, op2, attrs[2].pos);
    // Option B: attrs[0] op1 (attrs[1] op2 attrs[2])  →  a op1 [b op2 c]
    $("option-b").innerHTML = renderOptionHtml(false, attrs[1].pos, op2, attrs[2].pos, op1, attrs[0].pos);
  }

  const timeSec = (CONFIG.timeByLevel[state.level] || 5) + (q.phase === "A" ? CONFIG.phaseABonusSec : 0);
  state.phase = "playing";
  startTimer(timeSec);
}

// ── Answer handling ───────────────────────────────────────
function onAnswer(correct, isTimeout = false) {
  if (state.phase !== "playing") return;
  state.phase = "feedback";
  stopTimer();

  const q = state.currentQ;

  if (isTimeout) {
    // Reveal correct answer on timeout
    if (q.phase === "B") {
      (q.result ? $("allow-btn") : $("deny-btn")).classList.add("btn-hint");
    } else {
      const id = q.correctAnswer === "A" ? "option-a"
               : q.correctAnswer === "B" ? "option-b"
               : "ambig-btn";
      $(id).classList.add("btn-hint");
    }
  }

  if (correct) {
    state.score++;
    state.correct++;
    state.consecutiveCorrect++;
    if (q.phase === "A") state.scopeCorrect++;
    else                 state.literalCorrect++;
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

  if (q.phase === "A") state.scopeTotal++;
  else                 state.literalTotal++;

  $("score-display").textContent = state.score;

  // Phase A correct + has a linked literal → chain immediately into same question slot
  if (correct && !isTimeout && q.phase === "A" && q.linkedLiteral) {
    setTimeout(() => showQuestion(q.linkedLiteral), CONFIG.feedbackMs);
    return;
  }

  setTimeout(() => {
    state.questionIdx++;
    if (state.questionIdx >= CONFIG.questionsPerSession) endSession();
    else nextQuestion();
  }, correct ? CONFIG.feedbackMs : CONFIG.wrongMs);
}

// ── Game flow ─────────────────────────────────────────────
function nextQuestion() {
  const usePhaseA = Math.random() < CONFIG.phaseARate;
  showQuestion(usePhaseA ? genScopeQuestion() : genLiteralQuestion(state.level));
}

function startSession() {
  state = fresh();
  state.target = scoreTarget;
  $("idle-overlay").classList.add("hidden");
  $("play-btn").classList.add("hidden");
  $("score-display").textContent = "0";
  setBrainFill(0);
  nextQuestion();
}

function endSession() {
  state.phase = "idle";
  stopTimer();

  $("phase-b-area").classList.add("hidden");
  $("phase-a-area").classList.add("hidden");
  $("phase-b-btns").classList.add("hidden");
  $("ambig-btn").classList.add("hidden");

  const total      = state.correct + state.incorrect;
  const accuracy   = total ? Math.round(state.correct / total * 100) : 0;
  const scopeAcc   = state.scopeTotal   ? Math.round(state.scopeCorrect   / state.scopeTotal   * 100) : null;
  const literalAcc = state.literalTotal ? Math.round(state.literalCorrect / state.literalTotal * 100) : null;

  $("modal-score").textContent       = state.score;
  $("modal-accuracy").textContent    = accuracy + "%";
  $("modal-scope-acc").textContent   = scopeAcc   !== null ? scopeAcc   + "%" : "—";
  $("modal-literal-acc").textContent = literalAcc !== null ? literalAcc + "%" : "—";
  $("modal-level").textContent       = state.level;

  saveSession({ score: state.score, accuracy, scopeAcc, literalAcc, finalLevel: state.level });
  if (state.score >= scoreTarget) scoreTarget = state.score + 1;

  $("results-modal").classList.remove("hidden");
}

function resetSession() {
  stopTimer();
  state = fresh();

  $("idle-overlay").classList.remove("hidden");
  $("play-btn").classList.remove("hidden");
  $("phase-b-area").classList.add("hidden");
  $("phase-a-area").classList.add("hidden");
  $("phase-b-btns").classList.add("hidden");
  $("ambig-btn").classList.add("hidden");
  $("results-modal").classList.add("hidden");
  $("phase-badge").classList.remove("visible");
  $("q-counter").textContent = "";
  $("score-display").textContent = "";

  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");
  setBrainFill(0);
}

// ── Events ────────────────────────────────────────────────
$("play-btn").addEventListener("click", () => { triggerHaptic(); startSession(); });
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

$("option-a").addEventListener("click", () => {
  if (state?.phase !== "playing") return;
  triggerHaptic();
  const correct = state.currentQ.correctAnswer === "A";
  $("option-a").classList.add(correct ? "btn-correct" : "btn-wrong");
  if (!correct) {
    const hintId = state.currentQ.correctAnswer === "B" ? "option-b" : "ambig-btn";
    $(hintId).classList.add("btn-hint");
  }
  onAnswer(correct);
});

$("option-b").addEventListener("click", () => {
  if (state?.phase !== "playing") return;
  triggerHaptic();
  const correct = state.currentQ.correctAnswer === "B";
  $("option-b").classList.add(correct ? "btn-correct" : "btn-wrong");
  if (!correct) {
    const hintId = state.currentQ.correctAnswer === "A" ? "option-a" : "ambig-btn";
    $(hintId).classList.add("btn-hint");
  }
  onAnswer(correct);
});

$("ambig-btn").addEventListener("click", () => {
  if (state?.phase !== "playing") return;
  triggerHaptic();
  const correct = state.currentQ.correctAnswer === "ambiguous";
  $("ambig-btn").classList.add(correct ? "btn-correct" : "btn-wrong");
  if (!correct) {
    const hintId = state.currentQ.correctAnswer === "A" ? "option-a" : "option-b";
    $(hintId).classList.add("btn-hint");
  }
  onAnswer(correct);
});
