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

const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_N = 5;

// ── Scoring ────────────────────────────────────────────────────────────────────
//
// Score = performancePercentile × recencyFactor
//   performancePercentile: where does the recent mean sit vs all history (0–1)
//   recencyFactor: 1.0 if played today, decays linearly to 0.0 at 7 days
//
// This makes the radar drop toward 0 both when a domain hasn't been trained
// recently and when recent scores are declining vs historical performance.

function computeGameScore(sessions, metricFn, invert) {
  if (!sessions || sessions.length === 0) return { score: null, lastTs: null };

  const pairs = sessions.flatMap(s => {
    try {
      const v = metricFn(s);
      return v != null && isFinite(v) ? [{ v, ts: s.timestamp }] : [];
    } catch { return []; }
  });

  if (pairs.length === 0) return { score: null, lastTs: null };

  const allValues = pairs.map(p => p.v);
  const lastTs = pairs[pairs.length - 1].ts;

  const recent = allValues.slice(-RECENT_N);
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;

  // Mid-rank percentile: ties count as 0.5 so a consistent performer
  // scores ~0.5 rather than collapsing to 0.
  const below = allValues.filter(v => v < recentMean).length;
  const equal = allValues.filter(v => v === recentMean).length;
  let pct = (below + equal * 0.5) / allValues.length;
  if (invert) pct = 1 - pct;

  const daysSinceLast = (Date.now() - lastTs) / (24 * 60 * 60 * 1000);
  const recency = Math.pow(0.5, daysSinceLast / 7); // halves every 7 days, never reaches 0

  return { score: 1 - pct * recency, lastTs };
}

function computeDomains(appDataMap) {
  return DOMAINS.map(domain => {
    let bestScore = null;
    let bestTs = null;

    for (const g of domain.games) {
      const { score, lastTs } = computeGameScore(
        appDataMap.get(g.id) || [],
        g.metric,
        g.invert,
      );
      if (score !== null && (bestScore === null || score > bestScore)) {
        bestScore = score;
        bestTs = lastTs;
      }
    }

    return {
      label: domain.label,
      score: bestScore ?? 1,
      stale: bestTs === null || Date.now() - bestTs > STALE_MS,
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
      stroke: frac === 1.0 ? "#555" : "#404040",
      "stroke-width": frac === 1.0 ? "1" : "0.5",
    }));
  }

  // Spoke lines
  for (const [x, y] of spokePoints(R)) {
    svg.appendChild(el("line", { x1: CX, y1: CY, x2: x.toFixed(2), y2: y.toFixed(2), stroke: "#404040", "stroke-width": "0.5" }));
  }

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

  for (const [x, y] of dataPts) {
    svg.appendChild(el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: "3", fill: "#818cf8" }));
  }

  // Labels
  for (const [i, [x, y]] of spokePoints(LABEL_R).entries()) {
    const { label, stale } = domains[i];
    const anchor = x < CX - 4 ? "end" : x > CX + 4 ? "start" : "middle";
    const fill = "#999";

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

  document.getElementById("radar-modal").classList.remove("hidden");
}
