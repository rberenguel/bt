# Safata — Game Design & Implementation Plan

**Catalan**: safata = tray (as in an in-tray). Multiple trays of work, each with its own ongoing task.

---

## 1. What is Safata?

Safata is a cognitive training game that simulates managing multiple parallel workstreams — like having several tmux windows open at once, each doing different work, needing to remember what you were doing in each context when you return to it.

The mental model: you are an SRE with N terminal sessions open. Each session has an active task governed by its own rule. You switch between sessions continuously. The game tests whether you can maintain each session's rule context in memory across switches to other sessions.

### The cognitive construct: parallel context maintenance

Safata trains **parallel context maintenance** — the ability to hold N independent rule contexts simultaneously in working memory and re-enter each one correctly after a period of interference from the other contexts.

This is deliberately distinct from:

- **Serial task-switching** (A/B alternation): in classic set-shifting paradigms (and in Regles), one context is active at a time and is replaced. The cost measured is the switch cost. Safata has no switch cost in that sense — all contexts remain active at all times; the cost is the binding load.
- **Working memory updating** (n-back / NB): NB asks you to update a single rolling buffer. Safata asks you to maintain N separate, stable rule–context bindings simultaneously.
- **Prospective memory** (Flux): Flux asks you to remember to do something when a specific future cue appears. Safata asks you to remember *what you were doing* when you return to a context that has been interrupted.

The specific binding challenge: each tmux tile has a rule. When you return to tile #4 (the database tile, lit red), you must recall: "database tile = tap odds." You learned it on the first visit. You have since been to three other tiles. Now you must retrieve it from memory, not from a visible cue.

---

## 2. How Safata fits the training battery

The battery at `/Users/ruben/code/bt/` currently covers:

| Game | Construct |
|------|-----------|
| Clauer, Summum | Processing speed |
| NB | Working memory (updating / n-back) |
| Rot, Entrellat, Dotmatrix | Spatial rotation speed |
| Tanmateix, Precis, Llei | Reasoning |
| Stop | Inhibition |
| Attn | Attention control |
| Regles | Set-shifting under growing memory load |
| Flux | Prospective / episodic memory |
| **Safata** | **Parallel context maintenance / multi-task rule memory** |

Safata is the only game in the battery explicitly targeting multi-context binding in working memory.

---

## 3. Relationship to Regles

Regles (`/regles/`) is a set-shifting game. Its mechanic:
- 10 levels; each level adds one rule to a growing stack.
- At each level, the player clears a board of number+icon+color tiles by applying the rules in stack order (top rule first; when all matching tiles are gone, drop to next rule).
- Only the newly added rule is shown between levels; all prior rules must be recalled from memory.

**Key distinction**: In Regles, there is one active context at a time. The player is always in one mode. The challenge is that the rule stack grows, but you are never simultaneously managing multiple independent streams.

**What Safata borrows from Regles**:
1. The rule definitions (BASE_RULES, FILTER_RULES, DIM_SIZE, COLORS, ICONS).
2. The board generation logic (12 tiles, numbers 1–9, random color and icon, guarantee ≥1 matching tile per rule in the stack).
3. The task screen UI (the 3×3 grid of tiles, the tap handler, the cleared/error animation states).
4. The `forceTileToMatchRule` logic to ensure playability.

**What Safata does not borrow**:
- The multi-level progression structure (Safata uses a CC grid instead).
- The rule stack (in Safata, each tile has exactly one rule — a single filter or base rule assigned at the start of the session).
- The rule-shown-once-per-new-level mechanic (Safata uses the visit count threshold).

Because both games share rule machinery and task UI, that code must be extracted into shared ES modules. See Section 8.

---

## 4. Game Screens

### 4.1 Command Centre (CC)

The top-level screen. Shows a grid of up to 9 tiles. Each tile represents a tmux-window-like workstream.

**Tile properties**:
- `id`: integer 0–8, stable for the session
- `icon`: a Phosphor icon class (e.g. `ph-terminal`, `ph-bug`, `ph-clock`) — *semantic*, representing the type of work
- `rule`: the Regles filter or base rule assigned to this tile at session start, fixed for the entire session
- `visitCount`: how many times the player has completed a task screen for this tile
- `hasWork`: boolean — whether this tile currently has pending work
- `justProcessed`: boolean — cleared after the next turn update; prevents immediate re-lighting

**Tile color states**:
- **Yellow** (`--cc-yellow`): `hasWork === true` AND `visitCount < 3`. The rule will be shown on entry. The player is still learning this tile's rule. Yellow = "safe to enter."
- **Red** (`--cc-red`): `hasWork === true` AND `visitCount >= 3`. The rule will NOT be shown on entry. The player must recall it. Red = "memory required."
- **Blue/neutral dark** (`--cc-idle`): `hasWork === false`. No pending work; tile is dimmed and non-interactive.

**Why these colors**: Yellow/Red mirrors a real traffic-light / priority inbox metaphor. Yellow = you have a cheat sheet available. Red = you're on your own. Blue = nothing to do here. The color transition from yellow to red is the game's core tension ratcheting up as learning gives way to pure recall.

**Grid size**: Always a 3×3 grid (9 tile positions). Not all tiles need to be active — a session might start with 3–5 active tiles and grow. The number of active tiles is the maximum number of parallel contexts to maintain.

**Icon set for the CC** (distinct from Regles task icons):
```
ph-terminal       ph-bug           ph-clock
ph-database       ph-file-code     ph-gear
ph-robot          ph-cloud         ph-git-branch
```
These are semantic icons chosen to evoke distinct workstream identities (terminal session, bug report, cron job, database, code review, config, automation, cloud, version control). They are deliberately different from the `ph-alien`, `ph-ghost`, etc. icons used inside the task screen tiles — the CC icons identify the context; the task tile icons are part of the classification task.

### 4.2 Task Screen

Shown when the player taps a lit CC tile. This is a reused Regles-style screen.

**Contents** (top to bottom):
1. **Context header**: the CC tile's icon + label ("terminal", "database", etc.) so the player always knows which context they're in.
2. **Rule display** (conditional): if `visitCount < 3` at the time of entry (i.e. this is visit 1 or 2), show the rule in the same styled box as Regles (`overlay-rule`). If `visitCount >= 3`, hide it entirely — no rule, no hint.
3. **Board**: 12 tiles in a 3×4 grid (same as Regles), each tile having a number (1–9), a color (Red/Blue/Green/Yellow), and an icon (alien/bug/ghost/robot/rocket/skull).
4. **Task**: tap all tiles that satisfy the tile's rule. Wrong taps flash an error; correct taps clear the tile. Board is complete when all matching tiles are removed (same as Regles "rule cleared" logic for a single-rule scenario).

**Why a single rule per tile** (not a stack as in Regles): Safata's working memory load comes from holding N separate bindings simultaneously, not from holding a stack depth for a single context. Stacking rules within a tile would compound the difficulty in an uncontrolled way and obscure the clean parallel-binding measure. One rule per tile keeps the per-context task easy once you know the rule; the difficulty is purely the retrieval.

**When the task screen ends**: when the board is cleared (all tiles matching the active rule are tapped). The player returns to the CC automatically.

**Error tracking per visit**: record `totalTaps` and `wrongTaps` separately for rule-visible visits and rule-hidden visits. This gives the `yellowAccuracy` and `redAccuracy` metrics.

---

## 5. Session Flow

### 5.1 Session Initialization

1. Choose N active tiles from the 9 positions. Suggested starting N: 4 tiles. (Can be tuned; a session parameter.)
2. Assign each active tile a rule from FILTER_RULES or BASE_RULES. Constraints:
   - No two tiles may have the same rule.
   - Use the same dimension-diversity heuristic as Regles: prefer rules from dimensions not yet used; never exhaust a dimension (keep DIM_SIZE[dim] - 1 limit per the Regles logic).
3. Set all active tiles to `hasWork = true`, `visitCount = 0`, `justProcessed = false`.
4. Show the CC.

### 5.2 Turn Cycle

A "turn" is defined as: player taps one lit CC tile → completes the task screen → returns to CC. At that point the CC runs its update step.

**Turn update algorithm**:
```
1. Find the tile T that was just processed.
2. Increment T.visitCount.
3. Set T.justProcessed = true.
4. T.hasWork = false  (work was completed).
5. Work re-lighting: with some probability, set T.hasWork = true again —
   BUT: only if T.justProcessed is false. Since we just set it to true,
   T cannot re-light this turn.
6. New-work injection:
   - Collect all idle tiles (hasWork === false) except T.
   - With probability P_new (e.g. 0.5), pick one idle tile at random and set hasWork = true.
   - Never inject into more than 1 tile per turn (avoid flooding).
   - If after this step there are no lit tiles at all (all hasWork === false),
     force-light one tile that is not T. (Invariant: there must always be
     at least one lit tile.)
7. Clear T.justProcessed = false at the END of the update (it is only
   a guard for this single turn).
8. Re-compute tile colors (yellow/red based on visitCount vs. threshold=3).
```

**Why turn-based and not timer-based**: The load on parallel context maintenance grows with the number of interfering visits to other contexts, not with elapsed time. A turn-based model makes the interference count precise and reproducible. It also keeps the game feel controlled — the player is never rushed.

**Why never immediately re-light the just-processed tile**: If tile A could re-light immediately after processing, the player could develop a strategy of single-tapping tile A repeatedly, cycling through its visit count with no genuine parallel context interference. Blocking immediate re-lighting forces the player to visit at least one other context before returning, which is the entire point of the game.

**Why inject work sparingly (0 or 1 tile per turn)**: If many tiles could light up simultaneously, the player would face a flood of yellow (easy, rule-shown) tiles and could always cherry-pick them, deferring red tiles. Sparse injection means the set of red tiles grows naturally as yellow tiles mature through their 2-visit learning period. The difficulty curve is driven by visit count accumulation, not by sudden work floods.

**Re-lighting of processed tile**: On the turn after the player visits tile T, T may re-light. The game should decide this probabilistically or based on a work queue. A simple model: each non-lit, non-justProcessed tile has a 40% chance of gaining work each turn. This keeps the player busy but does not overwhelm. Tune as needed.

### 5.3 Session End Condition

The session ends after **10 red-tile completions** — 10 task screens completed where the rule was NOT shown (i.e. `visitCount >= 3` at time of entry).

**Why 10 red completions**: This is the primary measure of genuine memory recall events. Yellow completions are warm-up / learning. The session is done when the player has demonstrated 10 successful memory-guided task completions. It is not a fixed-time session (which would penalise thinking) or a fixed-tap-count session (which would include too many easy yellow completions). 10 is calibrated to give a meaningful but not exhausting session (~5–10 minutes depending on speed).

### 5.4 Session End Screen

Shown as an overlay (same pattern as Regles end session). Stats displayed:
- Red completions: always 10 (the end condition)
- Red accuracy: `redCorrect / redTotal` taps on rule-hidden screens
- Yellow accuracy: `yellowCorrect / yellowTotal` taps on rule-visible screens
- Tiles reached red state: how many distinct tiles accumulated ≥3 visits
- Average visits per tile: total visits / active tiles

---

## 6. Metrics

All metrics are saved via the shared storage module.

### 6.1 Primary metric

**`redCompletions`**: count of task screens completed with rule hidden. Always 10 at session end (the end condition). Stored to confirm the session was a genuine red session, not aborted.

### 6.2 Accuracy metrics

**`redAccuracy`**: accuracy percentage on rule-hidden task screens.
- Computed as: `(1 - redWrongTaps / redTotalTaps) * 100`, rounded to integer.
- A high-value metric: improving red accuracy means better rule recall and better context maintenance.
- **Trend direction: higher is better.**

**`yellowAccuracy`**: accuracy percentage on rule-visible task screens.
- Same formula for yellow screens.
- This is a baseline / calibration metric. High yellow accuracy means the player can apply the rule correctly when shown. If yellow accuracy is low, the player has a basic rule-application problem separate from the memory challenge.
- **Trend direction: higher is better.**

### 6.3 Session profile metrics

**`tilesReachedRed`**: count of distinct tiles that were visited ≥3 times during the session.
- A higher number means the player managed more parallel contexts reaching memory-only state.
- **Trend direction: higher is better** (more contexts maintained).

**`avgVisitsPerTile`**: total visits across all tiles / number of active tiles.
- Indicates how many rounds the player completed on average per context.
- Contextual metric, not trended directly.

### 6.4 Storage record shape

```js
{
  timestamp: Date.now(),            // Unix ms
  dateStr: "YYYY-MM-DD",            // ISO date string
  metrics: {
    redCompletions: 10,             // always 10
    redAccuracy: 87,                // % integer
    yellowAccuracy: 94,             // % integer
    tilesReachedRed: 5,             // count
    avgVisitsPerTile: 3.2,          // float
  }
}
```

### 6.5 History UI metric definitions

For `makeHistoryUI` in `history.js`:

```js
const metricDefs = [
  { key: "redAccuracy",      label: "Red accuracy",       unit: "%",  invertColor: false },
  { key: "yellowAccuracy",   label: "Yellow accuracy",    unit: "%",  invertColor: false },
  { key: "tilesReachedRed",  label: "Contexts memorised", unit: "",   invertColor: false },
];
```

---

## 7. Visual Design

### 7.1 Dark mode

Match the aesthetic of the existing games (Regles, NB). CSS variables:

```css
:root {
  --bg:              #000;
  --surface:         #1a1a1f;
  --surface-active:  #2a2a30;
  --text-main:       #f2f2f7;
  --text-dim:        #8e8e93;
  --accent:          #5e5ce6;
  --error:           #ff453a;

  /* CC tile state colors */
  --cc-yellow:       #FFCA3A;   /* work pending, rule visible */
  --cc-red:          #FF595E;   /* work pending, rule hidden  */
  --cc-idle:         #1a1a1f;   /* no work                    */
}
```

### 7.2 Command Centre grid

- 3×3 grid, tiles roughly square, filling most of the screen below the header.
- Idle tiles: dark (`--surface`), dimmed, not tappable.
- Yellow tiles: bright yellow border + subtle yellow background tint, fully tappable.
- Red tiles: bright red border + subtle red background tint, fully tappable.
- Each tile contains the Phosphor icon (large, centered) and a small label below it.
- Tiles pulse or glow subtly to draw attention when they have work.

### 7.3 Task screen

Reused from Regles. Additions:
- Context header at top of task screen (icon + name of the current CC tile).
- Rule box: shown only if visit count < 3, same style as Regles `overlay-rule`.
- "Return to command centre" happens automatically on board clear.

### 7.4 Fonts

- Body: Inter (same as rest of battery — `shared/fonts/` or system-ui fallback).
- Icons: Phosphor Light (`shared/fonts/phosphor/Phosphor-Light.woff2`, loaded via `phosphor.css`).

### 7.5 Animations

- CC tile tap: scale down on `:active` (same as Regles tile).
- Yellow→Red transition: when a tile's `visitCount` reaches 3, animate the color change (CSS transition on border-color / background).
- Task screen entry: slide up or fade in.
- Task completion: brief success flash before returning to CC.

---

## 8. Code Architecture

### 8.1 File structure

```
/safata/
  index.html        Main entry point
  game.js           CC logic, session state, turn management
  style.css         Game-specific styles (CC grid, tile states)
  storage.js        Thin wrapper around shared/storage.js
  history.js        History modal (uses shared/history.js)
  manifest.json     PWA manifest
  icon.png          Game icon (to be created)

/shared/
  storage.js        (existing) makeStorage factory
  history.js        (existing) makeHistoryUI factory
  haptic.js         (existing) initHaptic, triggerHaptic, triggerHapticError
  fire.js           (existing) FireSystem
  idb-keyval.js     (existing) IndexedDB key-value
  fonts/
    phosphor/       (existing) Phosphor icon font
  rules/            *** NEW — extracted from Regles ***
    engine.js       Rule definitions, board generation, rule application
    ui.js           Task screen UI component
```

### 8.2 Shared rules module: `/shared/rules/engine.js`

This module is extracted from `regles/game.js`. It must export everything that is pure logic (no DOM, no state):

```js
// Constants
export const COLORS;        // [{ id, hex }, ...]
export const ICONS;         // ["ph-alien", ...]
export const BASE_RULES;    // [{ id, text, isValid }, ...]
export const FILTER_RULES;  // [{ id, text, dim, isValid }, ...]
export const DIM_SIZE;      // { parity, color, icon, number }
export const TILE_COUNT;    // 12
export const MAX_NUM;       // 9

// Functions
export function generateBoard(rules);
// Returns an array of TILE_COUNT tile objects:
// [{ id, number, color, icon }, ...]
// Guarantees ≥1 matching tile per rule in the rules array.

export function forceTileToMatchRule(tile, rule);
// Mutates tile to match rule. Used by generateBoard internally
// but exported for flexibility.

export function pickRules(count, existingRules = []);
// Returns `count` new rules selected from FILTER_RULES (or BASE_RULES
// if count === 1 and no existing rules), respecting dimension constraints.
// Used by Regles to grow its stack and by Safata to assign one rule per tile.
```

**Why extract**: both Regles and Safata need the same rule definitions and board generation. Duplicating them would create maintenance debt. The extraction is a prerequisite for Safata to share task screen logic cleanly.

### 8.3 Shared rules module: `/shared/rules/ui.js`

This module provides the task screen as a reusable component. It handles DOM manipulation for a single task screen instance.

```js
export function makeTaskScreen({
  containerEl,      // HTMLElement to render the board into
  rule,             // rule object { id, text, isValid }
  showRule,         // boolean — whether to display the rule label
  contextIcon,      // string — Phosphor class for the current CC tile (e.g. "ph-terminal")
  contextLabel,     // string — human label for the CC tile (e.g. "terminal")
  onComplete,       // (result: { totalTaps, wrongTaps }) => void — called when board is cleared
});
// Returns { destroy }
```

Internally `makeTaskScreen`:
1. Generates a board via `generateBoard([rule])`.
2. Optionally renders the rule label.
3. Renders the context header.
4. Renders the tile grid (same HTML/CSS structure as Regles).
5. Handles taps: correct = clear tile; wrong = shake + error flash, count wrong tap.
6. When all rule-matching tiles are cleared, calls `onComplete` with tap stats.
7. Calls `triggerHaptic()` on each tap, `triggerHapticError()` on wrong tap.

**Why a factory function, not a class**: consistent with the existing codebase style (makeStorage, makeHistoryUI are also factory functions).

### 8.4 Regles refactor

When the shared modules are created, `regles/game.js` must be updated to import from them instead of defining the rule machinery inline. Specifically:

1. Remove the `COLORS`, `ICONS`, `BASE_RULES`, `FILTER_RULES`, `DIM_SIZE`, `TILE_COUNT`, `MAX_NUM` declarations and replace with imports from `../shared/rules/engine.js`.
2. Remove `generateBoard`, `forceTileToMatchRule` and replace with imports.
3. The `renderBoard`, `handleTap`, `checkBoardState` logic is more Regles-specific (multi-rule stack, shift tracking) and does NOT need to move to the shared module. It remains in `regles/game.js`.
4. The shared `ui.js` is used by Safata's single-rule-per-tile scenario. Regles retains its own tap/render loop because it manages a rule stack which is fundamentally different from a single-rule board.

**Practical implication**: the refactor of Regles is **step 1** of the Safata implementation. Safata cannot be built without it. The refactor must not break Regles.

### 8.5 `safata/game.js` responsibilities

This file orchestrates the entire Safata session. It does NOT import the Regles game.js directly; it imports from shared modules.

```
Imports:
  ../shared/rules/engine.js   — COLORS, ICONS, FILTER_RULES, BASE_RULES, pickRules, generateBoard
  ../shared/rules/ui.js       — makeTaskScreen
  ../shared/haptic.js         — initHaptic, triggerHaptic
  ../shared/fire.js           — FireSystem
  ./storage.js                — saveSessionRecord

State:
  tiles[]         — array of 9 tile descriptors (see Section 5.1)
  sessionMetrics  — running totals (see Section 6)
  currentTile     — which tile the player is currently in (null when at CC)
  screen          — "CC" | "TASK"

Key functions:
  initSession()           — assign rules, set initial hasWork flags, render CC
  renderCC()              — draw the 3×3 grid with current tile states
  handleCCTap(tileId)     — enter task screen for a lit tile
  runTurnUpdate(tileId)   — post-task update: increment visitCount, re-light logic
  enterTaskScreen(tile)   — instantiate makeTaskScreen, switch view
  onTaskComplete(result)  — record metrics, run turn update, return to CC
  checkSessionEnd()       — if redCompletions >= 10, end session
  endSession()            — show end overlay with stats, save record
```

### 8.6 `safata/storage.js`

```js
import { makeStorage } from "../shared/storage.js";

const storage = makeStorage("safata_history");

export function saveSessionRecord(data) {
  const now = Date.now();
  storage.save({
    timestamp: now,
    dateStr: new Date(now).toISOString().split("T")[0],
    metrics: {
      redCompletions:   data.redCompletions,
      redAccuracy:      data.redAccuracy,
      yellowAccuracy:   data.yellowAccuracy,
      tilesReachedRed:  data.tilesReachedRed,
      avgVisitsPerTile: data.avgVisitsPerTile,
    },
  });
}

export const getHistory = () => storage.getHistory();
```

### 8.7 `safata/history.js`

Follows the pattern of other games (flux/history.js, etc.). Uses `makeHistoryUI` from `../shared/history.js`.

```js
import { makeHistoryUI } from "../shared/history.js";
import { getHistory } from "./storage.js";

export const historyUI = makeHistoryUI({
  getHistory,
  metricDefs: [
    { key: "redAccuracy",     label: "Red accuracy",       unit: "%",  invertColor: false },
    { key: "yellowAccuracy",  label: "Yellow accuracy",    unit: "%",  invertColor: false },
    { key: "tilesReachedRed", label: "Contexts memorised", unit: "",   invertColor: false },
  ],
  sessionTitle: (s, i) => `Session ${i + 1}`,
});
```

The history button in `index.html` calls `historyUI.open()`.

### 8.8 `safata/index.html`

Follows the structure of `regles/index.html`:
- Imports `../shared/fonts/phosphor/phosphor.css`
- Imports `style.css`
- Contains the CC grid div, header, overlay div, history modal div
- `<script type="module" src="game.js"></script>`

The CC grid is a `<div id="cc-grid">` with 9 child `<button class="cc-tile">` elements (populated dynamically by `game.js`).

### 8.9 `safata/manifest.json`

```json
{
  "name": "Safata",
  "version": "0.1.0",
  "short_name": "Safata",
  "description": "Parallel context maintenance training",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "icon.png",
      "sizes": "256x256",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

---

## 9. Detailed State Machine

### 9.1 Session state

```
IDLE   → (tap Start)  → ACTIVE
ACTIVE → (task entry) → IN_TASK
IN_TASK → (board cleared) → ACTIVE
ACTIVE → (10 red completions) → DONE
DONE   → (tap Play Again) → IDLE
```

`IDLE`: start overlay shown.
`ACTIVE`: CC visible, player choosing which lit tile to tap.
`IN_TASK`: task screen visible, player tapping tiles.
`DONE`: end overlay shown with session stats.

### 9.2 Per-tile state transitions

```
UNLIT (visitCount=0, hasWork=false)
  → (session init with N active tiles) → YELLOW_PENDING (hasWork=true, visitCount=0)

YELLOW_PENDING (hasWork=true, visitCount < 3)
  → (player taps tile, completes task)
    visitCount becomes 1 or 2: stays yellow if re-lit, becomes YELLOW_PENDING again
    visitCount becomes 3: if re-lit, becomes RED_PENDING
  → if not re-lit after task: UNLIT (temporarily)

RED_PENDING (hasWork=true, visitCount >= 3)
  → (player taps tile, completes task) → UNLIT or RED_PENDING again

UNLIT: can gain work in turn update (0 or 1 per turn, not the just-processed tile)
```

### 9.3 Visit count and rule visibility

| visitCount at entry | Rule shown | CC tile color before entry |
|---------------------|-----------|---------------------------|
| 0 (first visit) | YES | Yellow |
| 1 (second visit) | YES | Yellow |
| 2 (third visit) | NO | Red |
| 3+ | NO | Red |

Note: the color shown in the CC *before* the player enters reflects the rule visibility they will experience *inside* the task. Yellow = rule will be shown; red = rule will not be shown.

The threshold is `visitCount < 2` for showing the rule (0-indexed: visits 0 and 1 show the rule, visit 2 and above do not). A tile becomes red after completing its second visit (visitCount incremented to 2). This means:
- First visit: rule visible (learning)
- Second visit: rule visible (consolidation)
- Third visit onward: rule hidden (recall)

---

## 10. Implementation Order

The following sequence is recommended to avoid blocking dependencies:

### Step 1: Extract shared rule engine

Create `/shared/rules/engine.js`:
- Copy COLORS, ICONS, BASE_RULES, FILTER_RULES, DIM_SIZE, TILE_COUNT, MAX_NUM from `regles/game.js`.
- Extract `generateBoard` and `forceTileToMatchRule` into exported functions.
- Add `pickRules(count, existingRules)` (generalized from the Regles level-setup logic).

### Step 2: Refactor Regles to import from shared

Update `regles/game.js` to import all the above from `../shared/rules/engine.js`. Remove the inline definitions. Run Regles manually to verify nothing broke.

### Step 3: Create shared task screen UI

Create `/shared/rules/ui.js` with the `makeTaskScreen` factory. This is a clean extraction of the board rendering and tap-handling logic for the single-rule case.

Test it in isolation by temporarily wiring it into Regles for a single level.

### Step 4: Scaffold Safata

Create the directory structure and stub files:
- `safata/index.html` (full HTML, with `<div id="cc-grid">`, overlays, etc.)
- `safata/style.css` (CSS variables, CC grid styles, tile state styles)
- `safata/manifest.json`
- `safata/storage.js` (thin wrapper)
- `safata/history.js` (history UI wiring)
- `safata/game.js` (stub with initSession, renderCC)

### Step 5: Implement CC logic

- Tile assignment (9 positions, N active tiles, one rule each)
- CC rendering (3×3 grid, color-coded)
- Turn update algorithm (re-lighting, injection, just-processed guard)
- Tap handler (transitions to task screen)

### Step 6: Implement task screen integration

- Wire `makeTaskScreen` into the task screen flow
- Handle context header, rule visibility toggle
- Collect tap stats per visit (yellow vs. red)
- Return to CC on completion

### Step 7: Implement session end and storage

- Count red completions; trigger end at 10
- Compute all metrics
- Save via `saveSessionRecord`
- Show end overlay with stats

### Step 8: Implement history UI

- Wire `historyUI.open()` to the history button
- Verify trends render correctly for all three tracked metrics

### Step 9: Polish

- Animations (tile state transitions, task entry/exit)
- Brain progress fill (fill based on redCompletions / 10)
- Haptic feedback wiring
- PWA icon (create `icon.png`)
- Version in header (fetch from manifest.json)

---

## 11. Edge Cases and Rules

### 11.1 Guaranteeing ≥1 lit tile at all times

After every turn update, assert that at least one tile has `hasWork === true`. If this invariant would be violated (all tiles idle), force-light the non-just-processed tile with the lowest recent visit count. This prevents a deadlock state where the player has nothing to do.

### 11.2 Handling the just-processed tile re-lighting

The `justProcessed` flag is transient: set to `true` when the tile is processed, cleared to `false` at the end of the same turn update. It is not persisted. It is only a guard during the current turn's work injection step.

### 11.3 Rule assignment at session start

Each of the N active tiles gets a unique rule. Use `pickRules(N, [])` from `engine.js`. The dimension-diversity heuristic in that function will ensure the N rules span different dimensions where possible, which makes the rules more visually distinct and easier to associate with their tiles.

The rule assigned to a tile is fixed for the entire session. It does not change. This is essential for the game to measure memory binding — if rules shifted, the game would measure something different (possibly updating or re-learning, not binding).

### 11.4 Board generation per task visit

Each time the player enters a tile's task screen, a fresh board is generated (new random tile values, same rule). The board is NOT the same between visits. This prevents the player from remembering the specific board layout from a previous visit as a shortcut around the rule recall challenge.

### 11.5 Inactive tiles (positions 0–8 with no rule assigned)

Tiles not included in the session's active set are rendered as fully dark/inert CC tiles with no icon. They are never lit and never tapped. In the first version, the active set is fixed at session start. A future enhancement could add new tiles mid-session (introducing new contexts), but this is not in scope for v1.

### 11.6 Session with fewer than 9 tiles

The 3×3 grid always shows all 9 positions. Inactive positions are rendered as empty/dark tiles. The visual symmetry of the grid is maintained regardless of how many are active. This makes the game field consistent and avoids layout reflow.

---

## 12. Tuning Parameters (document and expose as constants)

```js
// safata/game.js
const N_ACTIVE_TILES        = 4;    // Number of tiles active at session start
const RULE_VISIBLE_VISITS   = 2;    // Visits where rule is shown (0..N-1 inclusive)
const RED_COMPLETIONS_TARGET = 10;  // Session ends after this many red completions
const P_REWORK              = 0.60; // Probability a just-completed tile gets re-lit next turn
const P_NEW_WORK            = 0.45; // Probability a random idle tile gains work per turn
```

These are grouped as named constants at the top of `game.js` so they can be adjusted during calibration without hunting through logic.

---

## 13. Example Session Trace

To validate understanding of the flow, here is a sample session trace with 3 active tiles (A=terminal/tap-odds, B=bug/tap-reds, C=clock/tap-5s):

```
Turn 0 (init):
  A: hasWork=true, visitCount=0  → YELLOW
  B: hasWork=true, visitCount=0  → YELLOW
  C: hasWork=true, visitCount=0  → YELLOW

Player taps A (visit 1, rule shown):
  Board clears. onTaskComplete: yellowTaps recorded.
  Turn update: A.visitCount=1, A.justProcessed=true, A.hasWork=false.
  Re-light: B or C may get work. A cannot. A.justProcessed=false.
  State: A=UNLIT(visitCount=1), B=YELLOW, C=YELLOW (maybe one new idle→lit)

Player taps B (visit 1, rule shown):
  Board clears.
  Turn update: B.visitCount=1. A may re-light. B cannot.
  ...

[Several turns later]
  A.visitCount=2 (completed visit 2, rule still shown since visitCount<2 at entry)
  [A.visitCount incremented to 2 AFTER visit; next time A is entered visitCount=2 → rule hidden]

Player taps A (visit 3, visitCount=2 at entry → rule NOT shown → red completion):
  redCompletions += 1. redAccuracy updates.
  ...

[After 10 such events: session ends]
```

The key: the CC color at the moment of entry tells the player what to expect. `visitCount >= 2` before entering = red tile = rule hidden.

---

## 14. Service Worker / PWA

Safata should be added to the main service worker cache list (`/sw.js` at the repo root). Look at how other games are registered in `sw.js` and add the Safata files to the cache manifest. This is part of the wrap-up step (see the `wrap-up` skill).

---

## 15. Home Screen Integration

The main battery index (`/index.html`) lists all games. Safata must be added as a tile. The existing pattern: each game tile has an icon, name, and link. Add an entry for Safata using the same HTML structure as the other games.

---

## 16. Summary of Design Decisions

| Decision | Why |
|----------|-----|
| Turn-based (not timer-based) | Interference load is visit-count, not elapsed time. Keeps the measure precise. |
| Fixed rule per tile for full session | Measures stable binding, not re-learning. |
| Rule shown for first 2 visits | Allows learning before testing. 2 visits = one learning + one consolidation before pure recall. |
| Session ends at 10 red completions | Clean, skill-based end condition. Measures recall events directly. |
| Never re-light just-processed tile | Forces genuine parallel-context engagement; prevents single-tile cycling. |
| Inject ≤1 new work tile per turn | Avoids flooding with easy yellow tiles; lets red tiles accumulate naturally. |
| N=4 active tiles (default) | Enough parallel load to be challenging; not so many that the game becomes unlearnable in one session. |
| Semantic icons in CC (terminal, bug, etc.) | Give each context a distinct, memorable identity beyond a color. The icon is the context ID. |
| Task tile icons (alien, ghost, etc.) are different | Prevents confusion between context identity icons and classification task icons. |
| Shared rule engine with Regles | Single source of truth for rule definitions; changes propagate to both games. |
| Single rule per tile (not a stack) | The memory load in Safata is *breadth* (N contexts). Stacking within a tile would add *depth*, conflating two different constructs. |
