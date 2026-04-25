// ── Domain definitions ─────────────────────────────────────────────────────────

const DOMAINS = [
  {
    label: "Speed",
    games: [
      { id: "clauer", metric: (s) => s.metrics.cpm, invert: false },
      { id: "summum", metric: (s) => s.metrics.bestPace, invert: true },
    ],
  },
  {
    label: "Memory",
    games: [
      {
        id: "nb",
        metric: (s) => {
          if (s.metrics.dOverall != null) {
            const streams = s._quad ? 4 : s._triple ? 3 : 2;
            return s.metrics.dOverall * s.metrics.level * streams;
          }
          // legacy fallback
          const dims = [s.metrics.pctPos, s.metrics.pctCol];
          if (s.metrics.pctLet != null) dims.push(s.metrics.pctLet);
          if (s.metrics.pctShape != null) dims.push(s.metrics.pctShape);
          const meanAcc = dims.reduce((a, b) => a + b, 0) / dims.length;
          return s.metrics.level * dims.length * (meanAcc / 100);
        },
        invert: false,
      },
      { id: "regles", metric: (s) => s.metrics.errorRate, invert: true },
      { id: "safata", metric: (s) => s.metrics.redAccuracy, invert: false },
      // accuracy weighted by number of graphs (total / 5 questions per graph)
      {
        id: "topos",
        metric: (s) => s.metrics.accuracy * ((s.metrics.total ?? 5) / 5),
        invert: false,
      },
    ],
  },
  {
    label: "Spatial",
    games: [
      { id: "rot", metric: (s) => s.metrics.score, invert: false },
      { id: "entrellat", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "dotmatrix", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "falla", metric: (s) => s.metrics.accuracy, invert: false },
    ],
  },
  {
    label: "Reasoning",
    games: [
      { id: "tanmateix", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "precis", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "llei", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "fil", metric: (s) => s.metrics.accuracy, invert: false },
      { id: "falla", metric: (s) => s.metrics.accuracy, invert: false },
      // graph traversal inference, weighted by complexity (see Memory)
      {
        id: "topos",
        metric: (s) => s.metrics.accuracy * ((s.metrics.total ?? 5) / 5),
        invert: false,
      },
    ],
  },
  {
    label: "Inhibition",
    games: [
      { id: "stop", metric: (s) => s.metrics.stopAcc, invert: false },
      { id: "flux", metric: (s) => s.metrics.pmHitRate, invert: false },
    ],
  },
  {
    label: "Attention",
    games: [
      { id: "attn", metric: (s) => s.metrics.eb, invert: false },
      { id: "safata", metric: (s) => s.metrics.redAccuracy, invert: false },
      { id: "flux", metric: (s) => s.metrics.pmHitRate, invert: false },
      { id: "clauer", metric: (s) => s.metrics.cpm, invert: false },
    ],
  },
  {
    label: "Verbal",
    games: [
      { id: "mussol", metric: (s) => s.metrics.accuracy, invert: false },
      {
        id: "graner",
        metric: (s) =>
          s.metrics.possible > 0
            ? (s.metrics.words / s.metrics.possible) * 100
            : null,
        invert: false,
      },
    ],
  },
];

const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000; // "this week"
const WINDOW_MS = 21 * 24 * 60 * 60 * 1000; // baseline window

// ── Scoring ────────────────────────────────────────────────────────────────────
//
// score = 1 − (perf × recency)^1.5
//
// The exponent > 1 amplifies small values of perf×recency so that stale or
// low-performing items push harder outward.  Values near 1 (played today,
// great performance) are barely affected; values near 0 (not played in weeks)
// are pulled closer to 0 so 1 − result approaches 1 more aggressively.
//
// perf:    compares recentMean (last 7 days) to windowMean (last 21 days).
//          perf = min(1, ratio) anchors at 1 when recent == baseline, so a
//          game played today at normal level scores ≈ 0 (no attention needed).
//          At 0.5× baseline → perf = 0.5 → score ≈ 0.65 (needs attention).
//          If no sessions in the last 7 days, perf defaults to 0.5 and
//          recency alone drives the score up.
//
// recency: halves every 7 days. Played today → ~1. Two weeks ago → ~0.25.

function computeDomains(appDataMap) {
  const now = Date.now();

  return DOMAINS.map((domain) => {
    // Normalize each game's values to its own baseline so sessions from
    // different games are comparable. Pool everything at the domain level,
    // then derive a single perf + recency for the whole domain.
    const allPairs = []; // { normalizedV, ts }
    let latestTs = null;

    for (const g of domain.games) {
      const sessions = appDataMap.get(g.id) || [];
      const pairs = sessions.flatMap((s) => {
        try {
          const v = g.metric(s);
          return v != null && isFinite(v) ? [{ v, ts: s.timestamp }] : [];
        } catch {
          return [];
        }
      });
      if (pairs.length === 0) continue;

      const windowPairs = pairs.filter((p) => p.ts >= now - WINDOW_MS);
      const baselinePairs = windowPairs.length > 0 ? windowPairs : pairs;
      const windowMean =
        baselinePairs.reduce((s, p) => s + p.v, 0) / baselinePairs.length;
      if (windowMean === 0) continue;

      for (const { v, ts } of pairs) {
        const normalizedV = g.invert
          ? v > 0 ? windowMean / v : 1
          : v / windowMean;
        allPairs.push({ normalizedV, ts });
        if (latestTs === null || ts > latestTs) latestTs = ts;
      }
    }

    if (allPairs.length === 0) {
      return { label: domain.label, score: 1, stale: true };
    }

    const recentNorm = allPairs
      .filter((p) => p.ts >= now - RECENT_MS)
      .map((p) => p.normalizedV);

    const perf =
      recentNorm.length === 0
        ? 0.5
        : Math.min(1, recentNorm.reduce((a, b) => a + b, 0) / recentNorm.length);

    const daysSinceLast = (now - latestTs) / (24 * 60 * 60 * 1000);
    const recency = Math.pow(0.5, daysSinceLast / 7);

    return {
      label: domain.label,
      score: 1 - Math.pow(perf * recency, 1.5),
      stale: latestTs === null || Date.now() - latestTs > STALE_MS,
    };
  });
}

// ── SVG radar ──────────────────────────────────────────────────────────────────

const NS = "http://www.w3.org/2000/svg";
const CX = 150,
  CY = 150,
  R = 100,
  N = 7;
const LABEL_R = 128;

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function spokePoints(r) {
  return Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  });
}

function ptsAttr(pts) {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function buildSVG(domains) {
  const svg = el("svg", {
    viewBox: "-105 -20 510 340",
    width: "100%",
    style: "display:block;margin:0 auto",
  });

  // Grid rings
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    svg.appendChild(
      el("polygon", {
        points: ptsAttr(spokePoints(R * frac)),
        fill: "none",
        stroke: frac === 0.5 ? "#166534" : frac === 1.0 ? "#555" : "#404040",
        "stroke-width": frac === 0.5 ? "1.5" : frac === 1.0 ? "1" : "0.5",
      }),
    );
  }

  // Spoke lines
  for (const [x, y] of spokePoints(R)) {
    svg.appendChild(
      el("line", {
        x1: CX,
        y1: CY,
        x2: x.toFixed(2),
        y2: y.toFixed(2),
        stroke: "#404040",
        "stroke-width": "0.5",
      }),
    );
  }

  // Top 3 worst domains
  const sorted = [...domains].sort((a, b) => b.score - a.score);
  const top3 = new Set(sorted.slice(0, 3).map((d) => d.label));

  // Data polygon
  const dataPts = domains.map(({ score }, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const r = score * R;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  });

  svg.appendChild(
    el("polygon", {
      points: ptsAttr(dataPts),
      fill: "rgba(129,140,248,0.18)",
      stroke: "#818cf8",
      "stroke-width": "1.5",
      "stroke-linejoin": "round",
    }),
  );

  for (const [i, [x, y]] of dataPts.entries()) {
    const bad = top3.has(domains[i].label);
    svg.appendChild(
      el("circle", {
        cx: x.toFixed(2),
        cy: y.toFixed(2),
        r: bad ? "4" : "3",
        fill: bad ? "#c4b5fd" : "#818cf8",
      }),
    );
  }

  // Labels
  for (const [i, [x, y]] of spokePoints(LABEL_R).entries()) {
    const { label } = domains[i];
    const anchor = x < CX - 4 ? "end" : x > CX + 4 ? "start" : "middle";
    const bad = top3.has(label);
    const fill = bad ? "#c4b5fd" : "#999";

    svg.appendChild(
      el("text", {
        x: x.toFixed(2),
        y: y.toFixed(2),
        "text-anchor": anchor,
        "dominant-baseline": "middle",
        "font-size": "14",
        "font-family": "Inter Display, Inter, system-ui, sans-serif",
        fill,
      }),
    ).textContent = label;

    const gameNames = DOMAINS[i].games
      .map((g) => g.id[0].toUpperCase() + g.id.slice(1))
      .join(" · ");
    svg.appendChild(
      el("text", {
        x: x.toFixed(2),
        y: (y + 15).toFixed(2),
        "text-anchor": anchor,
        "dominant-baseline": "middle",
        "font-size": "9",
        "font-family": "Inter Display, Inter, system-ui, sans-serif",
        fill: "#666",
      }),
    ).textContent = gameNames;
  }

  return svg;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function openRadarModal(appData) {
  const appDataMap = new Map(
    appData.map(({ app, sessions }) => [app.id, sessions]),
  );
  const domains = computeDomains(appDataMap);

  const container = document.getElementById("radar-chart-container");
  container.innerHTML = "";
  container.appendChild(buildSVG(domains));

  const desc = document.createElement("p");
  desc.textContent =
    "Larger spokes mean an area needs more attention — either recent performance is below your usual or you haven't trained it lately. The green ring marks your average baseline. Highlighted labels are the top 3 areas to focus on.";
  desc.style.cssText =
    "margin:12px 16px 0;font-size:14px;color:#666;line-height:1.5;text-align:center;";
  container.appendChild(desc);

  document.getElementById("radar-modal").classList.remove("hidden");
}
