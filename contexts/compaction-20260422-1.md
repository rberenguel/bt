# Session Compaction Summary

## User Intent
- Add a new verbal/word game ("Graner") to the BT battery by cannibalising Magrana's dictionary engine
- Fix two pre-existing bugs (safata README count, attn phase-3 scoring)
- Keep the PWA cache canonical and version-bumped

## Contextual Work Summary

### New Game: Graner (`bt/graner/`)
- 90-second anagram sprint: fixed 7-letter pool, find 5- and 6-letter words
- Tap-to-place interaction (tap pool tile → answer zone, tap answer tile → return); no drag-and-drop
- Valid words auto-submit on placement (no Check button); clear button uses Phosphor backspace icon
- Brain fill tracks `found / total_solutions` ratio; 90s linear CSS timer bar (blue→red)
- Pool generation retries up to 300× to guarantee ≥6 solutions; solver reuses Magrana's sorted-key dictionary
- `calibrateTiles()` dynamically sets `--tile-size` via `requestAnimationFrame` so 7 tiles always fill the row; wired to `resize`
- History + radar chart wired: storage key `graner_history`, contributes to **Verbal** domain as `(words/possible)*100`

### Bug Fixes
- **attn phase-3**: wrong tap no longer kills the round immediately — each tap (correct or wrong) consumes one slot; remaining targets revealed only when all slots used. Phases 1 & 2 (1 target) behaviour unchanged.
- **README safata**: "up to 6 active workstreams" → "up to 9" to match `N_ACTIVE_TILES = 9` in code

### Hub Integration
- `app.js`: graner added to `APP_ORDER` and `APPS` registry (orange `#f97316`, `keyMetric` = words found)
- `radar.js`: graner added to `Verbal` domain alongside mussol
- `README.md`: graner description added; safata count fixed

### Cache / Versioning
- `get_cache.go`: outputs only `CACHE_FILES` (static imports); dynamic fetch targets stay in `sw.js` by hand
- `sw.js`: bumped to `bt-hub-v0.8.0`; `DYNAMIC_FILES` const holds `./graner/dict/dictionary.json`; install handler uses `[...CACHE_FILES, ...DYNAMIC_FILES]`
- `manifest.json`: bumped to `0.8.0`

## Files Touched

### New Game
- **bt/graner/index.html**: BT-standard layout — header, timer bar, answer zone, pool, backspace button, modals, intro overlay
- **bt/graner/app.js**: full game logic — solver, pool generator, tap interaction, auto-submit, timer, session lifecycle, history
- **bt/graner/style.css**: dark BT theme with cream pool tiles, blue answer tiles, flash/shake animations, icon clear button
- **bt/graner/manifest.json**: v0.0.1
- **bt/graner/dict/dictionary.json**: copied from magrana (SCOWL levels 10–70, sorted-key format)
- **bt/graner/icon.png**: copied from magrana (placeholder)

### Bug Fixes
- **bt/attn/app.js**: `handleBallClick` — wrong tap decrements slot count instead of zeroing `expectedClicks`

### Hub / Radar
- **bt/app.js**: graner entry in `APP_ORDER` and `APPS`
- **bt/radar.js**: graner in `Verbal` domain
- **bt/README.md**: graner description; safata count corrected

### Cache
- **bt/sw.js**: v0.8.0, graner files in `CACHE_FILES`, dict in `DYNAMIC_FILES`
- **bt/manifest.json**: v0.8.0
- **bt/get_cache.go**: reverted to single-responsibility (CACHE_FILES only)
