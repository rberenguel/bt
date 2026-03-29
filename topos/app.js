import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import { saveSessionRecord } from "./storage.js";
import { openHistoryModal } from "./history.js";

const INGEST_TIME_MS = 30000;
const DISTRACTOR_TIME_MS = 15000;
const NETWORKS = ["Alpha"];
const ICONS = ["ghost", "rocket", "crown", "butterfly", "fire", "star"];
const COLORS = [
  { name: "Red", hex: "#FF595E" },
  { name: "Blue", hex: "#1982C4" },
  { name: "Green", hex: "#8AC926" },
  { name: "Yellow", hex: "#FFCA3A" },
];

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let graphs = {};

let graphTimerId;
let distractorTimerId;
let animationId;

const edgeLayer = document.getElementById("edge-layer");
const edgesContainer = document.getElementById("edges-container");
const nodeLayer = document.getElementById("node-layer");
const distractorLayer = document.getElementById("distractor-layer");
const timerContainer = document.getElementById("timer-container");
const progressBar = document.getElementById("progress-bar");

// ── Graph generation ──────────────────────────────────────────────────────────

function generateGraph(name) {
  const numNodes = 6;
  const layers = 4;
  let nodes = [];
  let edges = [];

  let availableCombos = [];
  COLORS.forEach((c) =>
    ICONS.forEach((i) => availableCombos.push({ color: c, icon: i })),
  );
  availableCombos = availableCombos
    .sort(() => 0.5 - Math.random())
    .slice(0, numNodes);

  let layerMap = [[], [], [], []];
  let unassigned = [...availableCombos];

  for (let i = 0; i < layers; i++) {
    if (unassigned.length > 0) layerMap[i].push(unassigned.pop());
  }
  while (unassigned.length > 0) {
    let l = Math.floor(Math.random() * (layers - 1));
    if (layerMap[l].length < 2) layerMap[l].push(unassigned.pop());
  }

  let idCounter = 0;
  layerMap.forEach((layerNodes, lIdx) => {
    layerNodes.forEach((n) => {
      nodes.push({ id: idCounter++, ...n, layer: lIdx, out: [] });
    });
  });

  nodes.forEach((u) => {
    let potentialTargets = nodes.filter((v) => v.layer > u.layer);
    potentialTargets.forEach((v) => {
      let prob = v.layer - u.layer === 1 ? 0.6 : 0.2;
      if (Math.random() < prob) {
        edges.push({ from: u.id, to: v.id });
        u.out.push(v.id);
      }
    });
  });

  nodes.forEach((u) => {
    if (u.out.length === 0 && u.layer < layers - 1) {
      let targets = nodes.filter((v) => v.layer > u.layer);
      if (targets.length > 0) {
        let t = targets[Math.floor(Math.random() * targets.length)];
        edges.push({ from: u.id, to: t.id });
        u.out.push(t.id);
      }
    }
  });

  return { name, nodes, edges, layers: layerMap };
}

function canReach(graph, startId, targetId) {
  let visited = new Set();
  let queue = [startId];
  while (queue.length > 0) {
    let current = queue.shift();
    if (current === targetId) return true;
    if (!visited.has(current)) {
      visited.add(current);
      let node = graph.nodes.find((n) => n.id === current);
      node.out.forEach((neighbor) => queue.push(neighbor));
    }
  }
  return false;
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatNodeHtml(n) {
  return `<span class="q-node" style="color: ${n.color.hex};"><i class="ph-light ph-${n.icon}"></i> ${cap(n.icon)}</span>`;
}

function generateQuestionsForGraph(graph) {
  let pool = [];

  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = 0; j < graph.nodes.length; j++) {
      if (i !== j && graph.nodes[i].layer < graph.nodes[j].layer) {
        let n1 = graph.nodes[i];
        let n2 = graph.nodes[j];
        pool.push({
          network: graph.name,
          text: `Could the ${formatNodeHtml(n1)} reach the ${formatNodeHtml(n2)}?`,
          answer: canReach(graph, n1.id, n2.id),
        });
      }
    }
  }

  graph.nodes.forEach((n) => {
    pool.push({
      network: graph.name,
      text: `Was the ${formatNodeHtml(n)} a pure sink (no outgoing paths)?`,
      answer: n.out.length === 0,
    });
  });

  let uniqueIcons = [...new Set(graph.nodes.map((n) => n.icon))];
  uniqueIcons.forEach((icon) => {
    let nodesOfIcon = graph.nodes.filter((n) => n.icon === icon);
    if (nodesOfIcon.length > 1) {
      let allSinks = nodesOfIcon.every((n) => n.out.length === 0);
      pool.push({
        network: graph.name,
        text: `Were ALL <span class="q-node"><i class="ph-light ph-${icon}"></i> ${cap(icon)}</span> nodes acting as sinks?`,
        answer: allSinks,
      });
    }
  });

  pool = pool.sort(() => 0.5 - Math.random());
  return pool.slice(0, 5);
}

// ── Graph rendering ───────────────────────────────────────────────────────────

function drawGraph(graph) {
  edgesContainer.innerHTML = "";
  nodeLayer.innerHTML = "";

  const bounds = document.getElementById("game-area").getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;

  const maxGraphHeight = Math.min(height * 0.75, 450);
  const startY = (height - maxGraphHeight) / 2;
  const layerSpacing = maxGraphHeight / 3;

  let layersArr = [[], [], [], []];
  graph.nodes.forEach((n) => layersArr[n.layer].push(n));

  layersArr[0].forEach((n, idx) => {
    n.y = startY;
    let gap = 120;
    n.x =
      layersArr[0].length === 1
        ? width / 2
        : width / 2 + (idx === 0 ? -gap / 2 : gap / 2);
  });

  for (let i = 1; i < 4; i++) {
    if (layersArr[i].length === 2) {
      let getBarycenter = (node) => {
        let parents = graph.edges
          .filter((e) => e.to === node.id)
          .map((e) => graph.nodes.find((p) => p.id === e.from));
        if (parents.length === 0) return width / 2;
        return parents.reduce((sum, p) => sum + p.x, 0) / parents.length;
      };

      let b0 = getBarycenter(layersArr[i][0]);
      let b1 = getBarycenter(layersArr[i][1]);

      if (b0 > b1) layersArr[i].reverse();
    }

    layersArr[i].forEach((n, idx) => {
      n.y = startY + i * layerSpacing;
      let gap = 120;
      n.x =
        layersArr[i].length === 1
          ? width / 2
          : width / 2 + (idx === 0 ? -gap / 2 : gap / 2);
    });
  }

  graph.nodes.forEach((n) => {
    let el = document.createElement("div");
    el.className = "node";
    el.style.left = `${n.x}px`;
    el.style.top = `${n.y}px`;
    el.style.borderColor = n.color.hex;
    el.style.color = n.color.hex;
    el.innerHTML = `<i class="ph-light ph-${n.icon}"></i>`;
    nodeLayer.appendChild(el);
  });

  // Draw direct edges (adjacent layers) first, then skip edges on top
  const directEdges = graph.edges.filter((e) => {
    let u = graph.nodes.find((n) => n.id === e.from);
    let v = graph.nodes.find((n) => n.id === e.to);
    return v.layer - u.layer === 1;
  });
  const skipEdges = graph.edges.filter((e) => {
    let u = graph.nodes.find((n) => n.id === e.from);
    let v = graph.nodes.find((n) => n.id === e.to);
    return v.layer - u.layer > 1;
  });

  directEdges.forEach((e) => {
    let u = graph.nodes.find((n) => n.id === e.from);
    let v = graph.nodes.find((n) => n.id === e.to);

    let sx = u.x,
      sy = u.y + 26;
    let ex = v.x,
      ey = v.y - 34;
    let mid = (sy + ey) / 2;

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${sx} ${sy} C ${sx} ${mid}, ${ex} ${mid}, ${ex} ${ey}`,
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#586e75");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("marker-end", "url(#arrowhead)");
    edgesContainer.appendChild(path);
  });

  skipEdges.forEach((e) => {
    let u = graph.nodes.find((n) => n.id === e.from);
    let v = graph.nodes.find((n) => n.id === e.to);

    let sx = u.x,
      sy = u.y + 26;
    let ex = v.x,
      ey = v.y - 34;

    // Route to the side: push control points outward based on source x position
    const sideOffset = u.x < width / 2 ? -100 : 100;
    const cp1x = sx + sideOffset,
      cp1y = sy + (ey - sy) * 0.2;
    const cp2x = ex + sideOffset,
      cp2y = ey - (ey - sy) * 0.2;

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${ey}`,
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#586e75");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", "url(#arrowhead)");
    edgesContainer.appendChild(path);
  });
}

// ── Game phases ───────────────────────────────────────────────────────────────

function startGame() {
  triggerHaptic();
  document.getElementById("intro-panel").classList.add("hidden");
  edgeLayer.classList.remove("hidden");
  nodeLayer.classList.remove("hidden");
  timerContainer.classList.remove("hidden");

  let name = NETWORKS[0];
  graphs[name] = generateGraph(name);
  questions = generateQuestionsForGraph(graphs[name]);

  showNextGraph();
}

function resetGame() {
  triggerHaptic();
  document.body.classList.remove("results-mode");
  document.getElementById("game-area").style.height = "";
  document.getElementById("results-section").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
  clearTimeout(graphTimerId);
  clearTimeout(distractorTimerId);
  cancelAnimationFrame(animationId);

  questions = [];
  graphs = {};
  score = 0;
  currentQuestionIndex = 0;

  startGame();
}

function showNextGraph() {
  let name = NETWORKS[0];
  const statusEl = document.getElementById("status-text");
  statusEl.innerText = `Ingesting: Network ${name}`;
  statusEl.style.color = "var(--text-bright)";

  drawGraph(graphs[name]);

  progressBar.style.transition = "none";
  progressBar.style.width = "100%";
  void progressBar.offsetWidth;
  progressBar.style.transition = `width ${INGEST_TIME_MS}ms linear`;
  progressBar.style.width = "0%";

  graphTimerId = setTimeout(startDistractor, INGEST_TIME_MS);
}

function startDistractor() {
  edgeLayer.classList.add("hidden");
  nodeLayer.classList.add("hidden");
  distractorLayer.classList.remove("hidden");

  const statusEl = document.getElementById("status-text");
  statusEl.innerText = "Flush Phase";
  statusEl.style.color = "var(--text)";

  progressBar.style.transition = "none";
  progressBar.style.width = "100%";
  void progressBar.offsetWidth;
  progressBar.style.transition = `width ${DISTRACTOR_TIME_MS}ms linear`;
  progressBar.style.width = "0%";

  distractorLayer.innerHTML = "";
  const bounds = document.getElementById("game-area").getBoundingClientRect();
  let balls = [];

  for (let i = 0; i < 8; i++) {
    let el = document.createElement("div");
    el.className = "ball";
    el.style.backgroundColor = COLORS[i % COLORS.length].hex;

    let size = 20;
    let x = Math.random() * (bounds.width - size);
    let y = Math.random() * (bounds.height - size);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    distractorLayer.appendChild(el);

    balls.push({
      el,
      size,
      x,
      y,
      dx: (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random() * 2),
      dy: (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random() * 2),
    });
  }

  function animate() {
    let w = bounds.width;
    let h = bounds.height;
    balls.forEach((b) => {
      b.x += b.dx;
      b.y += b.dy;
      if (b.x <= 0 || b.x >= w - b.size) b.dx *= -1;
      if (b.y <= 0 || b.y >= h - b.size) b.dy *= -1;
      b.el.style.left = `${b.x}px`;
      b.el.style.top = `${b.y}px`;
    });
    animationId = requestAnimationFrame(animate);
  }
  animate();

  distractorTimerId = setTimeout(() => {
    cancelAnimationFrame(animationId);
    distractorLayer.classList.add("hidden");
    startInterrogation();
  }, DISTRACTOR_TIME_MS);
}

function startInterrogation() {
  timerContainer.classList.add("hidden");
  const statusEl = document.getElementById("status-text");
  statusEl.innerText = "Interrogation";
  statusEl.style.color = "#dc322f";
  document.getElementById("question-panel").classList.remove("hidden");

  currentQuestionIndex = 0;
  score = 0;
  showNextQuestion();
}

function showNextQuestion() {
  if (currentQuestionIndex >= questions.length) {
    showResults();
    return;
  }
  let q = questions[currentQuestionIndex];
  document.getElementById("q-network").innerText = `Network ${q.network}`;
  document.getElementById("q-text").innerHTML = q.text;
}

function answer(userAns) {
  let correctAns = questions[currentQuestionIndex].answer;
  let isCorrect = userAns === correctAns;
  questions[currentQuestionIndex].userCorrect = isCorrect;

  if (isCorrect) {
    triggerHaptic();
    score++;
  } else {
    triggerHapticError();
  }

  currentQuestionIndex++;
  showNextQuestion();
}

function showResults() {
  document.getElementById("question-panel").classList.add("hidden");

  const statusEl = document.getElementById("status-text");
  statusEl.innerText = "Complete";
  statusEl.style.color = "var(--text)";

  edgeLayer.classList.remove("hidden");
  nodeLayer.classList.remove("hidden");

  const total = questions.length;
  const acc = Math.round((score / total) * 100);
  document.getElementById("score-text").innerText =
    `${score} / ${total} (${acc}%)`;

  let recapHTML = "";
  questions.forEach((q) => {
    let cssClass = q.userCorrect ? "recap-correct" : "recap-incorrect";
    let icon = q.userCorrect
      ? `<i class="ph-light ph-check-circle" style="color:#8AC926"></i>`
      : `<i class="ph-light ph-x-circle" style="color:#FF595E"></i>`;
    recapHTML += `
            <div class="recap-item ${cssClass}">
                <div style="margin-bottom: 4px;">${icon} ${q.text}</div>
                <small style="color: var(--border);">Answer was: <strong>${q.answer}</strong></small>
            </div>
        `;
  });
  document.getElementById("recap-list").innerHTML = recapHTML;

  const gameArea = document.getElementById("game-area");
  gameArea.style.height = gameArea.getBoundingClientRect().height + "px";
  document.body.classList.add("results-mode");
  document.getElementById("results-section").classList.remove("hidden");
  document
    .getElementById("results-section")
    .scrollIntoView({ behavior: "smooth" });

  saveSessionRecord({ accuracy: acc, score, total });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  initHaptic();

  document.getElementById("start-btn").addEventListener("click", () => {
    triggerHaptic();
    startGame();
  });
  document
    .getElementById("play-again-btn")
    .addEventListener("click", resetGame);
  document
    .getElementById("true-btn")
    .addEventListener("click", () => answer(true));
  document
    .getElementById("false-btn")
    .addEventListener("click", () => answer(false));

  document.getElementById("stats-btn").addEventListener("click", () => {
    triggerHaptic();
    openHistoryModal();
  });

  const historyModal = document.getElementById("history-modal");
  document.getElementById("close-history-btn").addEventListener("click", () => {
    triggerHaptic();
    historyModal.classList.add("hidden");
  });
  historyModal.addEventListener("pointerdown", (e) => {
    if (e.target === historyModal) {
      triggerHaptic();
      historyModal.classList.add("hidden");
    }
  });
}

init();
