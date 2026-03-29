// ── Domain definitions ─────────────────────────────────────────────────────────

const DOMAINS = [
  {
    label: "Speed",
    games: [
      { id: "clauer",  metric: s => s.metrics.cpm,      invert: false },
      { id: "summum",  metric: s => s.metrics.bestPace,  invert: true  },
    ],
  },
  {
    label: "Memory",
    games: [
      { id: "nb",      metric: s => {
        if (s.metrics.dOverall != null) {
          const streams = s._quad ? 4 : s._triple ? 3 : 2;
          return s.metrics.dOverall * s.metrics.level * streams;
        }
        // legacy fallback
        const dims = [s.metrics.pctPos, s.metrics.pctCol];
        if (s.metrics.pctLet   != null) dims.push(s.metrics.pctLet);
        if (s.metrics.pctShape != null) dims.push(s.metrics.pctShape);
        const meanAcc = dims.reduce((a, b) => a + b, 0) / dims.length;
        return s.metrics.level * dims.length * (meanAcc / 100);
      }, invert: false },
      { id: "regles",  metric: s => s.metrics.errorRate, invert: true  },
      { id: "safata",  metric: s => s.metrics.redAccuracy, invert: false },
    ],
  },
  {
    label: "Spatial",
    games: [
      { id: "rot",       metric: s => s.metrics.score,    invert: false },
      { id: "entrellat", metric: s => s.metrics.accuracy, invert: false },
      { id: "dotmatrix", metric: s => s.metrics.accuracy, invert: false },
    ],
  },
  {
    label: "Reasoning",
    games: [
      { id: "tanmateix", metric: s => s.metrics.accuracy, invert: false },
      { id: "precis",    metric: s => s.metrics.accuracy, invert: false },
      { id: "llei",      metric: s => s.metrics.accuracy, invert: false },
    ],
  },
  {
    label: "Inhibition",
    games: [
      { id: "stop", metric: s => s.metrics.stopAcc,   invert: false },
      { id: "flux", metric: s => s.metrics.pmHitRate, invert: false },
    ],
  },
  {
    label: "Attention",
    games: [
      { id: "attn", metric: s => s.metrics.eb, invert: false },
      { id: "safata", metric: s => s.metrics.redAccuracy, invert: false },
      { id: "flux", metric: s => s.metrics.pmHitRate, invert: false },
      { id: "clauer",  metric: s => s.metrics.cpm, invert: false },
    ],
  },
  {
    label: "Verbal",
    games: [
      { id: "mussol", metric: s => s.metrics.accuracy, invert: false },
    ],
  },
];

const STALE_MS   = 7  * 24 * 60 * 60 * 1000;
const RECENT_MS  = 7  * 24 * 60 * 60 * 1000; // "this week"
const WINDOW_MS  = 21 * 24 * 60 * 60 * 1000; // baseline window

// ── Scoring ────────────────────────────────────────────────────────────────────
//
// score = 1 − perf × recency
//
// perf:    compares recentMean (last 7 days) to windowMean (last 21 days).
//          perf = min(1, ratio/2) anchors at 0.5 when recent == baseline.
//          At 2× baseline → perf = 1 → score ≈ 0 (no attention needed).
//          At 0.5× baseline → perf = 0.25 → score ≈ 0.75 (needs attention).
//          If no sessions in the last 7 days, perf defaults to 0.5 and
//          recency alone drives the score up.
//
// recency: halves every 7 days. Played today → ~1. Two weeks ago → ~0.25.

function computeGameScore(sessions, metricFn, invert) {
  if (!sessions || sessions.length === 0) return { score: null, lastTs: null };

  const pairs = sessions.flatMap(s => {
    try {
      const v = metricFn(s);
      return v != null && isFinite(v) ? [{ v, ts: s.timestamp }] : [];
    } catch { return []; }
  });

  if (pairs.length === 0) return { score: null, lastTs: null };

  const now = Date.now();
  const lastTs = pairs[pairs.length - 1].ts;

  // Baseline: last 21 days, falling back to all history if too few sessions
  const windowPairs = pairs.filter(p => p.ts >= now - WINDOW_MS);
  const baselinePairs = windowPairs.length > 0 ? windowPairs : pairs;
  const windowMean = baselinePairs.reduce((s, p) => s + p.v, 0) / baselinePairs.length;

  // Recent: last 7 days
  const recentValues = pairs.filter(p => p.ts >= now - RECENT_MS).map(p => p.v);

  let perf;
  if (recentValues.length === 0) {
    perf = 0.5; // no sessions this week; recency drives the score
  } else {
    const recentMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const ratio = invert
      ? (recentMean > 0 ? windowMean / recentMean : 1)
      : (windowMean > 0 ? recentMean / windowMean : 1);
    perf = Math.min(1, ratio / 2);
  }

  const daysSinceLast = (now - lastTs) / (24 * 60 * 60 * 1000);
  const recency = Math.pow(0.5, daysSinceLast / 7); // halves every 7 days

  return { score: 1 - perf * recency, lastTs };
}

function computeDomains(appDataMap) {
  return DOMAINS.map(domain => {
    const scores = [];
    let latestTs = null;

    for (const g of domain.games) {
      const { score, lastTs } = computeGameScore(
        appDataMap.get(g.id) || [],
        g.metric,
        g.invert,
      );
      if (score !== null) {
        scores.push(score);
        if (lastTs !== null && (latestTs === null || lastTs > latestTs)) {
          latestTs = lastTs;
        }
      }
    }

    const domainScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    return {
      label: domain.label,
      score: domainScore ?? 1,
      stale: latestTs === null || Date.now() - latestTs > STALE_MS,
    };
  });
}

// ── SVG radar ──────────────────────────────────────────────────────────────────

const NS = "http://www.w3.org/2000/svg";
const CX = 150, CY = 150, R = 100, N = 7;
const LABEL_R = 128;

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function spokePoints(r) {
  return Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / N;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  });
}

function ptsAttr(pts) {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function buildSVG(domains) {
  const svg = el("svg", { viewBox: "-55 -20 460 340", width: "100%", style: "display:block;margin:0 auto" });

  // Grid rings
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    svg.appendChild(el("polygon", {
      points: ptsAttr(spokePoints(R * frac)),
      fill: "none",
      stroke: frac === 0.5 ? "#166534" : frac === 1.0 ? "#555" : "#404040",
      "stroke-width": frac === 0.5 ? "1.5" : frac === 1.0 ? "1" : "0.5",
    }));
  }

  // Spoke lines
  for (const [x, y] of spokePoints(R)) {
    svg.appendChild(el("line", { x1: CX, y1: CY, x2: x.toFixed(2), y2: y.toFixed(2), stroke: "#404040", "stroke-width": "0.5" }));
  }

  // Top 3 worst domains
  const sorted = [...domains].sort((a, b) => b.score - a.score);
  const top3 = new Set(sorted.slice(0, 3).map(d => d.label));

  // Data polygon
  const dataPts = domains.map(({ score }, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / N;
    const r = score * R;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  });

  svg.appendChild(el("polygon", {
    points: ptsAttr(dataPts),
    fill: "rgba(129,140,248,0.18)",
    stroke: "#818cf8",
    "stroke-width": "1.5",
    "stroke-linejoin": "round",
  }));

  for (const [i, [x, y]] of dataPts.entries()) {
    const bad = top3.has(domains[i].label);
    svg.appendChild(el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: bad ? "4" : "3", fill: bad ? "#c4b5fd" : "#818cf8" }));
  }

  // Labels
  for (const [i, [x, y]] of spokePoints(LABEL_R).entries()) {
    const { label } = domains[i];
    const anchor = x < CX - 4 ? "end" : x > CX + 4 ? "start" : "middle";
    const bad = top3.has(label);
    const fill = bad ? "#c4b5fd" : "#999";

    svg.appendChild(el("text", {
      x: x.toFixed(2),
      y: y.toFixed(2),
      "text-anchor": anchor,
      "dominant-baseline": "middle",
      "font-size": "14",
      "font-family": "Inter Display, Inter, system-ui, sans-serif",
      fill,
    })).textContent = label;

    const gameNames = DOMAINS[i].games
      .map(g => g.id[0].toUpperCase() + g.id.slice(1))
      .join(" · ");
    svg.appendChild(el("text", {
      x: x.toFixed(2),
      y: (y + 15).toFixed(2),
      "text-anchor": anchor,
      "dominant-baseline": "middle",
      "font-size": "9",
      "font-family": "Inter Display, Inter, system-ui, sans-serif",
      fill: "#666",
    })).textContent = gameNames;
  }

  return svg;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function openRadarModal(appData) {
  const appDataMap = new Map(appData.map(({ app, sessions }) => [app.id, sessions]));
  const domains = computeDomains(appDataMap);

  const container = document.getElementById("radar-chart-container");
  container.innerHTML = "";
  container.appendChild(buildSVG(domains));

  const desc = document.createElement("p");
  desc.textContent = "Larger spokes mean an area needs more attention — either recent performance is below your usual or you haven't trained it lately. The green ring marks your average baseline. Highlighted labels are the top 3 areas to focus on.";
  desc.style.cssText = "margin:12px 16px 0;font-size:14px;color:#666;line-height:1.5;text-align:center;";
  container.appendChild(desc);

  document.getElementById("radar-modal").classList.remove("hidden");
}
