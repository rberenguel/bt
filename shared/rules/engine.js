// Shared rule engine — extracted from regles/game.js.
// Used by both Regles and Safata.

export const COLORS = [
  { id: "Red", hex: "var(--c-red)" },
  { id: "Blue", hex: "var(--c-blue)" },
  { id: "Green", hex: "var(--c-green)" },
  { id: "Yellow", hex: "var(--c-yellow)" },
];

export const ICONS = [
  "ph-alien",
  "ph-bug",
  "ph-ghost",
  "ph-robot",
  "ph-rocket",
  "ph-skull",
];

export const TILE_COUNT = 12;
export const MAX_NUM = 9;

// Hard constraint: never exhaust a dimension (always leave ≥1 option unused).
export const DIM_SIZE = { parity: 2, color: 4, icon: 6, number: 9 };

export const BASE_RULES = [
  {
    id: "ASC",
    text: "Tap Ascending",
    isValid: (t, b) => t.number === Math.min(...b.map((x) => x.number)),
  },
  {
    id: "DESC",
    text: "Tap Descending",
    isValid: (t, b) => t.number === Math.max(...b.map((x) => x.number)),
  },
];

export const FILTER_RULES = [
  {
    id: "ODD",
    text: "Tap Odds",
    dim: "parity",
    isValid: (t) => t.number % 2 !== 0,
  },
  {
    id: "EVEN",
    text: "Tap Evens",
    dim: "parity",
    isValid: (t) => t.number % 2 === 0,
  },
  ...COLORS.map((c) => ({
    id: `COL_${c.id}`,
    text: `Tap ${c.id}`,
    dim: "color",
    isValid: (t) => t.color.id === c.id,
  })),
  ...ICONS.map((ico) => ({
    id: `ICO_${ico}`,
    text: `Tap ${ico.replace("ph-", "")}`,
    dim: "icon",
    isValid: (t) => t.icon === ico,
  })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    id: `NUM_${n}`,
    text: `Tap ${n}s`,
    dim: "number",
    isValid: (t) => t.number === n,
  })),
];

export function forceTileToMatchRule(target, rule) {
  if (rule.id.startsWith("COL_")) {
    target.color = COLORS.find((c) => c.id === rule.id.replace("COL_", ""));
  } else if (rule.id.startsWith("ICO_")) {
    target.icon = rule.id.replace("ICO_", "");
  } else if (rule.id === "ODD") {
    const odds = [1, 3, 5, 7, 9];
    target.number = odds[Math.floor(Math.random() * odds.length)];
  } else if (rule.id === "EVEN") {
    const evens = [2, 4, 6, 8];
    target.number = evens[Math.floor(Math.random() * evens.length)];
  } else if (rule.id.startsWith("NUM_")) {
    target.number = parseInt(rule.id.replace("NUM_", ""), 10);
  }
}

export function generateBoard(rules) {
  const nums = Array.from(
    { length: TILE_COUNT },
    () => Math.floor(Math.random() * MAX_NUM) + 1,
  );

  const board = nums
    .sort(() => Math.random() - 0.5)
    .map((n, i) => ({
      id: "t" + i,
      number: n,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      icon: ICONS[Math.floor(Math.random() * ICONS.length)],
    }));

  for (const rule of rules) {
    if (rule.id === "ASC" || rule.id === "DESC") continue;
    if (!board.some((t) => rule.isValid(t, board))) {
      forceTileToMatchRule(
        board[Math.floor(Math.random() * board.length)],
        rule,
      );
    }
  }

  return board;
}

// Pick `count` unique rules respecting dimension-diversity constraints.
// existingRules: rules already assigned (to avoid duplicates and dim exhaustion).
export function pickRules(count, existingRules = []) {
  const result = [];
  const allUsed = [...existingRules];

  for (let i = 0; i < count; i++) {
    const dimCounts = {};
    for (const r of allUsed) {
      if (r.dim) dimCounts[r.dim] = (dimCounts[r.dim] || 0) + 1;
    }

    // Hard constraint: never exhaust a dimension.
    let available = FILTER_RULES.filter(
      (r) =>
        !allUsed.some((sr) => sr.id === r.id) &&
        (dimCounts[r.dim] || 0) < DIM_SIZE[r.dim] - 1,
    );

    // Prefer dimensions not yet used — keeps rules visually varied.
    const freshDim = available.filter((r) => !dimCounts[r.dim]);
    if (freshDim.length > 0) available = freshDim;

    // Fallback: relax constraints if pool is exhausted.
    if (available.length === 0) {
      available = FILTER_RULES.filter(
        (r) => !allUsed.some((sr) => sr.id === r.id),
      );
    }
    if (available.length === 0) break;

    const picked = available[Math.floor(Math.random() * available.length)];
    result.push(picked);
    allUsed.push(picked);
  }

  return result;
}
