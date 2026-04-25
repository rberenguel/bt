# Session Compaction Summary

## User Intent
- Integrate the new `falla` game into the bt brain-training hub as a first-class citizen
- Match the visual/structural conventions of existing games (shared libs, brain accumulator, history, haptics)
- Polish the game experience: random roll animation, matrix-green glow timed to animation end, swastika pattern filter

## Contextual Work Summary

### New Game Integration
- Created all required files under `falla/`: `index.html`, `app.js`, `style.css`, `storage.js`, `history.js`, `manifest.json`
- Follows the `fil` game as structural template: ES module, shared fire/haptic/history/storage libs
- 10-round fixed session, 8-level difficulty table (maxRows 5→9, time 40s→11s), brain fill tracks score progress

### Hub Wiring
- Added `falla` to `APP_ORDER` and `APPS` registry in `app.js` (color `#ffd043`, amber)
- Added to `radar.js` in both **Spatial** domain (mental rotation) and **Reasoning** domain (logical rule verification), using `accuracy` metric
- Added 7 falla files to `sw.js` `CACHE_FILES`; bumped `CACHE_NAME` and root `manifest.json` from `0.8.4` → `0.8.5`

### Game Design
- Fit rows calculated via `Math.round` (not `Math.floor`) against available game-area height, capped by per-level `maxRows`
- Wrong tap flashes error but does not advance round; timeout reveals correct cell and advances; correct tap levels up
- Haptic: `triggerHaptic()` is always the first line of every click handler; `triggerHapticError()` called additionally on wrong/timeout

### Roll Animation
- Each shape starts at `rotation ± spin` where spin is randomly picked from `[-180, -90, 90, 180]` for organic per-shape direction

### Forbidden Pattern Filter
- `isNotAllowed(segs)` checks if active segments contain either of two 8-segment forbidden patterns (`FORBIDDEN_A`, `FORBIDDEN_B`) as a subset
- Both variants are self-invariant under 90° CSS rotation, so one logical check covers all displayed orientations
- Applied to initial state, every sequence step, and the anomaly state; logs to console when pruned
- Names deliberately opaque (`FORBIDDEN_A/B`, `isNotAllowed`)

### Matrix-Green Glow
- `.segment.active.glowing` applies `box-shadow` at 0.5 opacity (no glow during animation — causes repaint lag)
- Each `shape-container` registers a `transitionend` listener (`{ once: true }`) counting down `remaining`
- When `remaining` hits 0, `requestAnimationFrame` schedules the bulk `.classList.add("glowing")` at the next frame boundary
- Stale-board guard via `boardGen` counter (incremented each `buildBoard` call); both the `transitionend` and the `rAF` callback check `boardGen !== gen` and bail if a new board was built

## Files Touched

### New — falla/
- **falla/index.html**: Standard header (back link + brain button), timer bar, game area, results/history/help modals
- **falla/app.js**: Full game logic — generation, filtering, board build, timer, session flow, glow scheduling
- **falla/style.css**: Fil design system with amber accent; 12-segment figure CSS (h/v classes, success/error states, glowing class)
- **falla/storage.js**: Thin wrapper over `makeStorage("falla_history")`
- **falla/history.js**: Thin wrapper over `makeHistoryUI` with score/accuracy/level metric defs
- **falla/manifest.json**: PWA manifest v0.1.0

### Modified — Hub
- **app.js**: `falla` added to `APP_ORDER` and `APPS` array
- **radar.js**: `falla` added to Spatial and Reasoning domain game lists
- **sw.js**: 7 falla cache entries added; version bumped to `bt-hub-v0.8.5`
- **manifest.json**: Version bumped to `0.8.5`
