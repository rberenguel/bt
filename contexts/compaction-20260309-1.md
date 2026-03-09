# Session Compaction Summary

## User Intent
- Fix tanmateix stats being silently dropped (missing `total` field + wrong storage backend)
- Migrate all games from localStorage to IndexedDB (idb-keyval) with legacy data migration
- Fix duplicate syllogistic clues appearing at higher difficulty in tanmateix

## Contextual Work Summary

### Storage Migration (All Games)
- Created `shared/idb-keyval.js` (copied from `nb/lib/idb-keyval.js`) as the shared library
- Rewrote `shared/storage.js` to use idb-keyval async API; `getHistory()` auto-migrates existing localStorage data on first call, then removes the localStorage key
- `shared/history.js` `open()` now wraps `getHistory()` in `Promise.resolve()` to handle async transparently

### Hub Fix
- `app.js` was still reading localStorage directly via `readLocalStorage()` — replaced with `makeStorage(key).getHistory()` calls via `Promise.all`, so hub triggers migration for all games on load
- Import updated from `nb/lib/idb-keyval.js` to `shared/idb-keyval.js`

### Tanmateix Stats Fix
- `tanmateix/storage.js` was dropping `total` from saved metrics; added `total: data.total`
- `tanmateix/history.js` and `app.js` both filter sessions by `s.metrics.total !== undefined` — without this fix all sessions were invisible

### Tanmateix Duplicate Clue Fix
- Root cause: at `numPaths >= 4`, generator exhausted the 3 relation types and reused Syllogistic with same entity pairs, producing logically identical premises with different wording
- Fix: replaced `usedTypes` tracking with an `oncePool` approach — Spatial and Syllogistic each consumed at most once, Linear always available for remaining paths; each path picks randomly from remaining candidates
- `numPaths` cap in `increaseDifficulty()` restored to 5 (was briefly capped at 3)

### Version Bumps
- All manifests and service workers bumped one patch version

## Files Touched

### Shared
- **shared/idb-keyval.js**: New file, copied from nb/lib
- **shared/storage.js**: Full rewrite — idb-keyval async, localStorage migration on first read
- **shared/history.js**: `open()` made async-compatible via `Promise.resolve()`

### Hub
- **app.js**: Removed `readLocalStorage()`, switched to `makeStorage().getHistory()` with `Promise.all`

### Tanmateix
- **tanmateix/storage.js**: Added `total` to saved metrics
- **tanmateix/generators/PathBasedQuestionGenerator.js**: Replaced type-dedup logic with `oncePool` pattern
- **tanmateix/main.js**: `numPaths` cap restored to 5 in `increaseDifficulty()`

### Versions
- **manifest.json** + **sw.js**: hub, nb, clauer, summum, stop, tanmateix all bumped one patch
