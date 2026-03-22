import { FireSystem } from "../shared/fire.js";
import { saveSession, getHistory } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { initHaptic, triggerHaptic, triggerHapticError } from "../shared/haptic.js";

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  puzzlesPerSession: 10,
  targetExamples:   8,   // 4 valid + 4 invalid
  timeByLevel: [0, 60, 50, 42, 35, 28, 22],
  levelUpEvery: 2,
  maxLevel:     6,
  correctMs:    700,
  wrongMs:      1500,
};

// ── Domain ────────────────────────────────────────────────
const ATTRS = [
  { key: "active",   pos: "active",    neg: "inactive",   icon: "ph-pulse",        color: "#38bdf8" },
  { key: "approved", pos: "approved",  neg: "unapproved", icon: "ph-check-circle", color: "#4ade80" },
  { key: "flagged",  pos: "flagged",   neg: "unflagged",  icon: "ph-flag",         color: "#f87171" },
  { key: "premium",  pos: "premium",   neg: "standard",   icon: "ph-star",         color: "#fbbf24" },
  { key: "urgent",   pos: "urgent",    neg: "non-urgent", icon: "ph-bell",         color: "#fb923c" },
];

// ── Utilities ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ── AST (identical to Precís) ─────────────────────────────
function leaf(attr, negated = false) {
  return { type: "LEAF", attr: attr.key, pos: attr.pos, neg: attr.neg, negated };
}
function bin(type, left, right) { return { type, left, right }; }

function genAST(level) {
  const allowNeg = level >= 2;
  const attrs = pickN(ATTRS, 3);
  const mk = a => leaf(a, allowNeg && Math.random() < 0.25);

  const op1 = pick(["AND", "OR"]);
  const op2 = op1 === "AND" ? "OR" : "AND";
  const base = Math.random() < 0.5
    ? bin(op2, bin(op1, mk(attrs[0]), mk(attrs[1])), mk(attrs[2]))
    : bin(op1, mk(attrs[0]), bin(op2, mk(attrs[1]), mk(attrs[2])));

  return base;
}

function evalAST(node, payload) {
  if (node.type === "LEAF")   return node.negated ? !payload[node.attr] : !!payload[node.attr];
  if (node.type === "AND")    return evalAST(node.left, payload) && evalAST(node.right, payload);
  if (node.type === "OR")     return evalAST(node.left, payload) || evalAST(node.right, payload);
  return false;
}

function collectAttrs(node, out = new Set()) {
  if (node.type === "LEAF") { out.add(node.attr); return out; }
  if (node.left)  collectAttrs(node.left,  out);
  if (node.right) collectAttrs(node.right, out);
  return out;
}

function astToTokens(node) {
  if (node.type === "LEAF") {
    const toks = [];
    if (node.negated) toks.push({ type: "NOT" });
    toks.push({ type: "ATTR", key: node.attr });
    return toks;
  }
  if (node.type === "AND") {
    const needL = node.left.type  === "OR";
    const needR = node.right.type === "OR";
    return [
      ...(needL ? [{ type: "(" }] : []), ...astToTokens(node.left),  ...(needL ? [{ type: ")" }] : []),
      { type: "AND" },
      ...(needR ? [{ type: "(" }] : []), ...astToTokens(node.right), ...(needR ? [{ type: ")" }] : []),
    ];
  }
  if (node.type === "OR") {
    return [...astToTokens(node.left), { type: "OR" }, ...astToTokens(node.right)];
  }
  return [];
}

function renderAST(node) {
  if (node.type === "LEAF")   return node.negated ? `NOT ${node.pos}` : node.pos;
  if (node.type === "AND") {
    const wrap = n => n.type === "OR" ? `(${renderAST(n)})` : renderAST(n);
    return `${wrap(node.left)} AND ${wrap(node.right)}`;
  }
  if (node.type === "OR")     return `${renderAST(node.left)} OR ${renderAST(node.right)}`;
  return "";
}

// ── Puzzle generation ─────────────────────────────────────
// Returns true if a single attribute perfectly separates the chosen examples
function hasSingleDiscriminator(examples) {
  for (const attr of ATTRS) {
    const validVals   = examples.filter(e =>  e.valid).map(e => e.payload[attr.key]);
    const invalidVals = examples.filter(e => !e.valid).map(e => e.payload[attr.key]);
    const allVTrue  = validVals.every(v =>  v);
    const allVFalse = validVals.every(v => !v);
    const allITrue  = invalidVals.every(v =>  v);
    const allIFalse = invalidVals.every(v => !v);
    if ((allVTrue && allIFalse) || (allVFalse && allITrue)) return true;
  }
  return false;
}

function gini(ast, population) {
  const trueCount = population.filter(p => evalAST(ast, p)).length;
  const n = population.length;
  const p = trueCount / n;
  return 1 - (p * p + (1 - p) * (1 - p));
}

function genPuzzle(level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const ast = genAST(level);

    // Generate 50 full-attribute payloads
    const population = Array.from({ length: 50 }, () => {
      const p = {};
      for (const a of ATTRS) p[a.key] = Math.random() < 0.5;
      return p;
    });

    if (gini(ast, population) < 0.30) continue;

    const labeled  = population.map(p => ({ payload: p, valid: evalAST(ast, p) }));
    const valids   = labeled.filter(e => e.valid);
    const invalids = labeled.filter(e => !e.valid);
    if (valids.length < 2 || invalids.length < 2) continue;

    const nV = Math.min(4, valids.length);
    const nI = Math.min(CONFIG.targetExamples - nV, invalids.length);
    if (nI < 3) continue;

    const examples = [...pickN(valids, nV), ...pickN(invalids, nI)];
    // Shuffle
    for (let i = examples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [examples[i], examples[j]] = [examples[j], examples[i]];
    }

    // Reject if any single attribute trivially separates the chosen examples
    if (hasSingleDiscriminator(examples)) continue;

    // Give each card its own independent attr order (stable across re-renders)
    const shuffled = examples.map(e => ({ ...e, attrOrder: pickN(ATTRS, ATTRS.length) }));
    return { ast, examples: shuffled };
  }
  // Fallback: trivial puzzle
  const ast = bin("AND", leaf(ATTRS[1]), leaf(ATTRS[0]));
  return {
    ast,
    examples: [
      { payload: { active: true,  approved: true,  flagged: false, premium: false, urgent: false }, valid: true  },
      { payload: { active: false, approved: true,  flagged: true,  premium: true,  urgent: false }, valid: false },
      { payload: { active: true,  approved: false, flagged: false, premium: false, urgent: true  }, valid: false },
      { payload: { active: true,  approved: true,  flagged: true,  premium: true,  urgent: true  }, valid: true  },
      { payload: { active: false, approved: false, flagged: false, premium: false, urgent: false }, valid: false },
    ],
  };
}

// ── Parser ────────────────────────────────────────────────
// Maps display words → leaf factory fns
const WORD_TO_LEAF = {};
for (const a of ATTRS) {
  WORD_TO_LEAF[a.pos] = () => leaf(a, false);
  WORD_TO_LEAF[a.neg] = () => leaf(a, true);
}
const KEYWORDS = new Set(["AND", "OR", "NOT"]);

function tokenize(text) {
  return text.trim()
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter(Boolean)
    .map(p => {
      if (p === "(" || p === ")") return p;
      const upper = p.toUpperCase();
      if (KEYWORDS.has(upper)) return upper;
      return p.toLowerCase();
    });
}

function parseRule(text) {
  const tokens = tokenize(text);
  if (!tokens.length) return null;
  let pos = 0;

  const peek    = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let left = parseAnd();
    while (peek() === "OR") {
      consume();
      left = { type: "OR", left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek() === "AND") {
      consume();
      left = { type: "AND", left, right: parseNot() };
    }
    return left;
  }

  function parseNot() {
    if (peek() === "NOT") {
      consume();
      const atom = parseAtom();
      if (atom.type !== "LEAF") throw new Error("NOT must precede an attribute name");
      return { ...atom, negated: !atom.negated };
    }
    return parseAtom();
  }

  function parseAtom() {
    if (peek() === "(") {
      consume();
      const inner = parseExpr();
      if (peek() !== ")") throw new Error("Expected )");
      consume();
      return inner;
    }
    const tok = consume();
    if (!tok) throw new Error("Unexpected end of rule");
    const mkLeaf = WORD_TO_LEAF[tok];
    if (!mkLeaf) throw new Error(`Unknown attribute: "${tok}"`);
    return mkLeaf();
  }

  const ast = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected: "${tokens[pos]}"`);
  return ast;
}

// ── Rule builder ─────────────────────────────────────────
// Token shapes:
//   { type: "ATTR",   key: "active" }
//   { type: "NOT" | "AND" | "OR" | "(" | ")" }

let ruleTokens = [];
let cursorPos  = 0;   // insertion index: 0..ruleTokens.length
let drag       = null;

function clearRule() {
  ruleTokens = [];
  cursorPos  = 0;
  renderRuleBuilder();
  $("check-feedback").textContent = "";
  if (state?.currentPuzzle) renderExamples(state.currentPuzzle);
}

function insertToken(token) {
  if (token.type === "(") {
    // auto-pair: insert ( ) with cursor between them
    ruleTokens.splice(cursorPos, 0, { type: "(" }, { type: ")" });
    cursorPos++;
  } else {
    ruleTokens.splice(cursorPos, 0, token);
    cursorPos++;
  }
  renderRuleBuilder();
  $("check-feedback").textContent = "";
}

function deleteBeforeCursor() {
  if (cursorPos === 0) return;
  ruleTokens.splice(cursorPos - 1, 1);
  cursorPos--;
  renderRuleBuilder();
  $("check-feedback").textContent = "";
}

function tokensToString(tokens) {
  return tokens.map(t => {
    if (t.type === "ATTR") return ATTRS.find(a => a.key === t.key).pos;
    return t.type; // "AND", "OR", "NOT", "(", ")"
  }).join(" ");
}

function renderTokenHTML(token, idx) {
  let cls = "rb-token";
  let inner = "";
  if (token.type === "ATTR") {
    const a = ATTRS.find(a => a.key === token.key);
    cls += " rb-attr";
    inner = `<i class="ph-light ${a.icon}" style="color:${a.color}"></i>`;
  } else if (token.type === "AND")    { cls += " rb-op rb-and";    inner = "∧"; }
  else if (token.type === "OR")       { cls += " rb-op rb-or";     inner = "∨"; }
  else if (token.type === "NOT")      { cls += " rb-op rb-not";    inner = "¬"; }
  else if (token.type === "(" || token.type === ")") { cls += " rb-paren"; inner = token.type; }
  return `<span class="${cls}" data-idx="${idx}">${inner}</span>`;
}

function renderRuleBuilder() {
  const container = $("rule-builder");

  if (ruleTokens.length === 0) {
    container.innerHTML =
      `<span class="rb-cursor blink">|</span>`
    + `<span class="rb-hint">tap blocks below to build the rule</span>`;
    return;
  }

  let html = "";
  for (let i = 0; i <= ruleTokens.length; i++) {
    html += `<span class="rb-gap${i === cursorPos ? " rb-cursor-here" : ""}" data-pos="${i}">`
          + (i === cursorPos ? `<span class="rb-cursor blink">|</span>` : "")
          + `</span>`;
    if (i < ruleTokens.length) html += renderTokenHTML(ruleTokens[i], i);
  }
  container.innerHTML = html;

  // Token interactions
  container.querySelectorAll(".rb-token").forEach(el => {
    // Tap → move cursor after this token
    el.addEventListener("click", e => {
      e.stopPropagation();
      if (drag?.hasMoved) return;
      cursorPos = parseInt(el.dataset.idx) + 1;
      renderRuleBuilder();
    });
    // Drag start
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0 && e.button !== undefined) return;
      drag = { idx: parseInt(el.dataset.idx), startX: e.clientX, startY: e.clientY,
               hasMoved: false, ghost: null, srcEl: el };
    }, { passive: true });
  });

  // Gap tap → move cursor there
  container.querySelectorAll(".rb-gap").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      cursorPos = parseInt(el.dataset.pos);
      renderRuleBuilder();
    });
  });

  // Click on rule background → cursor at end
  container.addEventListener("click", () => {
    cursorPos = ruleTokens.length;
    renderRuleBuilder();
  });
}

// ── Drag handling ─────────────────────────────────────────
document.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  if (!drag.hasMoved && Math.hypot(dx, dy) > 10) {
    drag.hasMoved = true;
    // Ghost
    const rect = drag.srcEl.getBoundingClientRect();
    drag.ghost = drag.srcEl.cloneNode(true);
    Object.assign(drag.ghost.style, {
      position: "fixed", pointerEvents: "none", zIndex: "200",
      left: rect.left + "px", top: rect.top + "px",
      opacity: "0.9", transform: "scale(1.08)",
    });
    document.body.appendChild(drag.ghost);
    drag.srcEl.style.opacity = "0.2";
    $("rule-trash").classList.add("trash-visible");
  }

  if (drag.hasMoved && drag.ghost) {
    drag.ghost.style.left = (e.clientX - 28) + "px";
    drag.ghost.style.top  = (e.clientY - 16) + "px";
    const r = $("rule-trash").getBoundingClientRect();
    const over = e.clientX >= r.left && e.clientX <= r.right
              && e.clientY >= r.top  && e.clientY <= r.bottom;
    $("rule-trash").classList.toggle("trash-hot", over);
  }
}, { passive: true });

document.addEventListener("pointerup", e => {
  if (!drag) return;

  if (drag.hasMoved) {
    const r = $("rule-trash").getBoundingClientRect();
    const overTrash = e.clientX >= r.left && e.clientX <= r.right
                   && e.clientY >= r.top  && e.clientY <= r.bottom;

    if (overTrash) {
      triggerHaptic();
      ruleTokens.splice(drag.idx, 1);
      cursorPos = Math.min(cursorPos, ruleTokens.length);
      if (cursorPos > drag.idx) cursorPos--;
    } else {
      // Reorder: find nearest gap
      const newPos = findDropPos(e.clientX, e.clientY);
      if (newPos !== drag.idx && newPos !== drag.idx + 1) {
        const [tok] = ruleTokens.splice(drag.idx, 1);
        const insertAt = newPos > drag.idx ? newPos - 1 : newPos;
        ruleTokens.splice(insertAt, 0, tok);
        cursorPos = insertAt + 1;
      }
    }
  }

  if (drag.ghost) drag.ghost.remove();
  if (drag.srcEl) drag.srcEl.style.opacity = "";
  $("rule-trash").classList.remove("trash-visible", "trash-hot");
  drag = null;
  renderRuleBuilder();
  $("check-feedback").textContent = "";
});

function findDropPos(x, y) {
  const els = [...document.querySelectorAll("#rule-builder .rb-token")];
  if (!els.length) return 0;
  let bestPos = 0, bestDist = Infinity;
  const first = els[0].getBoundingClientRect();
  let d = Math.hypot(x - first.left, y - (first.top + first.height / 2));
  if (d < bestDist) { bestDist = d; bestPos = 0; }
  for (const el of els) {
    const r = el.getBoundingClientRect();
    d = Math.hypot(x - r.right, y - (r.top + r.height / 2));
    const idx = parseInt(el.dataset.idx);
    if (d < bestDist) { bestDist = d; bestPos = idx + 1; }
  }
  return bestPos;
}

// ── Display helpers ───────────────────────────────────────
function renderExamples(puzzle, playerAST = null) {
  const { examples } = puzzle;

  function renderCard(example) {
    let cls = "example-card " + (example.valid ? "card-valid" : "card-invalid");
    if (playerAST !== null) {
      const ok = evalAST(playerAST, example.payload) === example.valid;
      cls += ok ? " ex-correct" : " ex-wrong";
    }
    const slots = (example.attrOrder || ATTRS)
      .filter(a => example.payload[a.key])
      .map(a => `<span class="attr-slot attr-on" style="color:${a.color}"><i class="ph-light ${a.icon}"></i></span>`)
      .join("");
    return `<div class="${cls}">${slots}</div>`;
  }

  $("valid-col").innerHTML   = examples.filter(e =>  e.valid).map(renderCard).join("");
  $("invalid-col").innerHTML = examples.filter(e => !e.valid).map(renderCard).join("");
}

// ── State ─────────────────────────────────────────────────
let state = null;

function fresh() {
  return {
    phase: "idle",
    puzzleIdx: 0,
    score: 0, correct: 0, incorrect: 0,
    consecutiveCorrect: 0,
    level: 1,
    currentPuzzle: null,
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
  brainFire.style.setProperty("--fire-inset",         inset + "%");
  FireSystem.update(p, inset);
}

// ── Init ──────────────────────────────────────────────────
let scoreTarget = 10;
getHistory().then(h => {
  if (h.length) scoreTarget = Math.max(...h.map(s => s.metrics.score)) + 1;
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
    if (rem <= 0) { onTimeout(); return; }
    state.timerRaf = requestAnimationFrame(tick);
  }
  state.timerRaf = requestAnimationFrame(tick);
}

function stopTimer() {
  if (state.timerRaf) { cancelAnimationFrame(state.timerRaf); state.timerRaf = null; }
}

// ── Puzzle display ────────────────────────────────────────
function showPuzzle(puzzle) {
  state.currentPuzzle = puzzle;

  $("q-counter").textContent      = `${state.puzzleIdx + 1} / ${CONFIG.puzzlesPerSession}`;
  $("score-display").textContent  = state.score;

  renderExamples(puzzle);
  clearRule();

  $("check-feedback").textContent = "";
  $("check-btn").disabled         = false;
  $("check-btn").textContent      = "CHECK";

  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");

  state.phase = "playing";

  const timeSec = CONFIG.timeByLevel[state.level] || 12;
  startTimer(timeSec);
}

// ── Answer handling ───────────────────────────────────────
function onCheck() {
  if (state?.phase !== "playing") return;
  if (!ruleTokens.length) return;
  triggerHaptic();

  let playerAST;
  try {
    playerAST = parseRule(tokensToString(ruleTokens));
  } catch (e) {
    $("check-feedback").textContent = "incomplete rule — add more blocks";
    triggerHapticError();
    return;
  }
  if (!playerAST) return;

  const { examples } = state.currentPuzzle;
  const allCorrect = examples.every(e => evalAST(playerAST, e.payload) === e.valid);

  renderExamples(state.currentPuzzle, playerAST);

  if (allCorrect) {
    state.phase = "feedback";
    stopTimer();
    state.score++;
    state.correct++;
    state.consecutiveCorrect++;
    triggerHaptic();
    setBrainFill(Math.min(1, state.score / state.target));
    if (state.consecutiveCorrect >= CONFIG.levelUpEvery) {
      state.consecutiveCorrect = 0;
      state.level = Math.min(CONFIG.maxLevel, state.level + 1);
    }
    $("score-display").textContent  = state.score;
    $("check-feedback").textContent = "Correct!";
    $("check-btn").disabled         = true;
    setTimeout(() => advance(), CONFIG.correctMs);
  } else {
    const wrong = examples.filter(e => evalAST(playerAST, e.payload) !== e.valid).length;
    $("check-feedback").textContent =
      `${wrong} example${wrong > 1 ? "s" : ""} wrong — revise and try again`;
    triggerHapticError();
  }
}

function onTimeout() {
  if (state.phase !== "playing") return;
  state.phase = "feedback";
  stopTimer();

  state.incorrect++;
  state.consecutiveCorrect = 0;
  triggerHapticError();

  const tokens   = astToTokens(state.currentPuzzle.ast);
  const iconsHTML = tokens.map((t, i) => renderTokenHTML(t, i)).join("");
  const fb = $("check-feedback");
  fb.innerHTML = `<span class="fb-label">Time! Law:</span><span class="fb-tokens">${iconsHTML}</span>`;

  const btn = $("check-btn");
  btn.textContent = "Next →";
  btn.disabled = false;
}

function advance() {
  state.puzzleIdx++;
  if (state.puzzleIdx >= CONFIG.puzzlesPerSession) endSession();
  else nextPuzzle();
}

// ── Game flow ─────────────────────────────────────────────
function nextPuzzle() {
  showPuzzle(genPuzzle(state.level));
}

function startSession() {
  state = fresh();
  state.target = scoreTarget;

  $("idle-overlay").classList.add("hidden");
  $("play-btn").classList.add("hidden");
  $("controls-row").classList.add("hidden");
  $("game-area").classList.remove("hidden");
  $("score-display").textContent = "0";
  setBrainFill(0);
  nextPuzzle();
}

function endSession() {
  state.phase = "idle";
  stopTimer();

  $("game-area").classList.add("hidden");

  const total    = state.correct + state.incorrect;
  const accuracy = total ? Math.round(state.correct / total * 100) : 0;

  $("modal-score").textContent    = state.score;
  $("modal-accuracy").textContent = accuracy + "%";
  $("modal-level").textContent    = state.level;

  saveSession({ score: state.score, accuracy, finalLevel: state.level });
  if (state.score >= scoreTarget) scoreTarget = state.score + 1;

  $("results-modal").classList.remove("hidden");
}

function resetSession() {
  stopTimer();
  state = fresh();
  clearRule();

  $("idle-overlay").classList.remove("hidden");
  $("play-btn").classList.remove("hidden");
  $("controls-row").classList.remove("hidden");
  $("game-area").classList.add("hidden");
  $("results-modal").classList.add("hidden");
  $("q-counter").textContent     = "";
  $("score-display").textContent = "";

  const bar = $("timer-bar");
  bar.style.transform = "scaleX(1)";
  bar.classList.remove("urgent");
  setBrainFill(0);
}

// ── Events ────────────────────────────────────────────────
$("play-btn").addEventListener("click",        () => { triggerHaptic(); startSession(); });
$("modal-close-btn").addEventListener("click", () => { triggerHaptic(); resetSession(); });
$("stats-btn").addEventListener("click",       () => { triggerHaptic(); openHistoryModal(); });
$("close-history-btn").addEventListener("click", () => $("history-modal").classList.add("hidden"));
$("check-btn").addEventListener("click", () => {
  if (state?.phase === "feedback") { triggerHaptic(); advance(); }
  else onCheck();
});
$("rule-backspace").addEventListener("click",  () => { if (state?.phase === "playing") { triggerHaptic(); deleteBeforeCursor(); } });
$("rule-clear").addEventListener("click",      () => { if (state?.phase === "playing") { triggerHaptic(); clearRule(); } });

// Building block buttons
document.querySelectorAll(".block-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (state?.phase !== "playing") return;
    triggerHaptic();
    const { action, key, value } = btn.dataset;
    if (action === "attr")  insertToken({ type: "ATTR", key });
    if (action === "op")    insertToken({ type: value });
    if (action === "paren") insertToken({ type: "(" });
  });
});
