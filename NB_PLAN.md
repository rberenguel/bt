# NB d-prime plan

## Problem

Current accuracy metric (`pctPos`, `pctCol`, etc.) is `correctC / total`, which conflates hits and correct rejections. A player who never presses scores ~76% (the lazy baseline given ~24% true match rate per dimension). d-prime fixes this by measuring sensitivity independently of response bias.

**d' = Z(hit rate) - Z(false alarm rate)**

- Hit rate (HR) = hits / matches (pressed when there was a match)
- False alarm rate (FAR) = false alarms / non-matches (pressed when there was no match)
- Z = inverse normal CDF
- d' = 0 → chance; plant scores exactly 0. d' > 0 → genuine detection.

## Changes

### `nb/nb.js`

**State variables** — replace the four `correctXxxC` counters with per-dimension signal detection counts:

```js
// Per dimension: pos, col, let, shape
let hits    = { pos: 0, col: 0, let: 0, shape: 0 };
let misses  = { pos: 0, col: 0, let: 0, shape: 0 };
let fas     = { pos: 0, col: 0, let: 0, shape: 0 };  // false alarms
let crs     = { pos: 0, col: 0, let: 0, shape: 0 };  // correct rejections
```

Add to `resetEverything()`: zero all four objects.

**`checkAnswers()`** — replace the `posCorrect`/`colCorrect` boolean logic with explicit signal detection branching per dimension:

```js
function tally(dim, matched, pressed) {
  if      ( matched &&  pressed) hits[dim]++;
  else if ( matched && !pressed) misses[dim]++;
  else if (!matched &&  pressed) fas[dim]++;
  else                           crs[dim]++;
}
```

Call `tally('pos', posMatch, lastReply.position)` etc. for each active dimension. Keep `flashButton` call using `matched === pressed` for visual feedback (unchanged).

Drop `correctPosC`, `correctColC`, `correctLetC`, `correctShapeC` and their incrementing.

**`addSession()`** — compute d-prime per dimension and an overall mean, then store alongside existing fields:

```js
function dprime(dim, matchTotal, nonMatchTotal) {
  // log-linear correction for boundary values
  const hr  = (hits[dim] + 0.5)  / (matchTotal + 1);
  const far = (fas[dim]  + 0.5)  / (nonMatchTotal + 1);
  return zInv(hr) - zInv(far);
}
```

`matchTotal` and `nonMatchTotal` per dimension are derivable from the tallies: `matchTotal = hits[dim] + misses[dim]`, `nonMatchTotal = fas[dim] + crs[dim]`.

Compute `dPos`, `dCol`, and conditionally `dLet`, `dShape`. Compute `dOverall` as the mean of active dimensions.

Add a minimal `zInv(p)` implementation (rational approximation, ~10 lines, sufficient precision for this use). Clamp input to [0.001, 0.999] as a safety net before the log-linear correction already handles extremes.

**Keep** `pctPos`, `pctCol`, `pctLet`, `pctShape` in the stored session — computed from hits+misses vs total — for backwards compatibility with the results modal display and history charts. Total answerable rounds = `hits[dim] + misses[dim] + fas[dim] + crs[dim]`.

**Session record** gains new fields:

```js
{
  // existing
  level, triple, quad, pctPos, pctCol, pctLet, pctShape, date, roundResults,
  // new
  dPos, dCol,
  dLet:   triple ? dLet   : null,
  dShape: quad   ? dShape : null,
  dOverall,
}
```

Old sessions without d-prime fields are handled gracefully downstream (null-check before use).

### `nb/modals.js`

Results modal currently shows pctPos/pctCol and a level suggestion based on ≥80%/50-79%/<50% thresholds. Add a d-prime row per dimension below the accuracy rows. Revise the level suggestion thresholds to use `dOverall`: e.g. d' ≥ 1.5 → advance, 0.5–1.5 → keep practicing, < 0.5 → drop a level.

### `app.js` — `loadNbSessions()`

Add `dPos`, `dCol`, `dLet`, `dShape`, `dOverall` to the normalised metrics object (pass through as-is, null if absent).

### `radar.js`

Update the nb metric to use `dOverall` when present, falling back to the current accuracy-based composite for old sessions:

```js
metric: s => {
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
},
```

### `app.js` — nb `metricDefs`

Add `dOverall` as a displayed metric in the history trend chart, labelled "d' (sensitivity)". Keep existing pct metrics.

## What does NOT change

- Match generation (`generateStep`) — the ~24% true match rate is fine
- Round timing, button layout, warmup logic, fire/fireworks, service worker
- Storage key (`"sessions"`) and overall session array structure
- `roundResults` bit-packing (encodes correctness, not hit/FA — leave as-is)
