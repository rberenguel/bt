# Session Compaction Summary

## User Intent
- Consolidate five brain-training PWAs (summum, stop, clauer, nb, tanmateix) into a single monorepo with shared infrastructure
- Build a hub PWA at the root linking all apps and aggregating stats
- Ensure everything works offline from a single root service worker

## Contextual Work Summary

### Shared Infrastructure (`shared/`)
- Created `shared/fire.js` — canonical fire particle system (was duplicated in summum, stop, nb)
- Created `shared/haptic.js` — canonical haptic module (was duplicated in summum, clauer; nb had a different API)
- Created `shared/storage.js` — `makeStorage(key)` factory returning `{ save(record), getHistory() }`; all per-app save logic remains in each app's own storage.js
- Created `shared/history.js` — `makeHistoryUI({getHistory, metricDefs, listElId, modalElId, openModal, sessionTitle})` factory; drives calendar, trend charts (with tap-to-see tooltip), and day-detail cards; clauer gains tooltip feature it was missing
- Created `shared/fonts/` — one canonical copy of all fonts (iconoir, phosphor, inter, monoid, cinzel, etc.); removed the 5 duplicate per-app `fonts/` directories (~27MB saved)

### Per-app Migration
- **summum**: `storage.js` and `history.js` replaced with thin wrappers using shared modules; `app.js` imports point to `../shared/`; local `fire.js` and `haptic.js` deleted
- **stop**: Same pattern; additionally fixed brain/fire offset bug (was using 0–100 range instead of correct 8–88 range matching summum/nb)
- **clauer**: `js/storage.js` and `js/history.js` replaced; `js/ui.js` haptic import updated to `../../shared/haptic.js`; local `haptic.js` deleted; `sw.js` cache paths updated
- **nb**: `nb.js` imports updated (`triggerHaptic as haptic` alias kept; `initHaptic()` call added to `init()`); `sw.js` cache paths updated; local `fire.js` and `haptic.js` deleted
- **tanmateix**: Font links updated; `sw.js` cache paths updated; no JS changes (no shared storage/history in this app)

### Hub PWA (`/bt/` root)
- `index.html` — hub page with header, cross-app streak, app-card grid, shared history modal
- `app.js` — reads all session data (localStorage for summum/stop/clauer; IndexedDB via `nb/lib/idb-keyval.js` for nb); normalises nb sessions into standard format so `makeHistoryUI` works for all four apps; renders cards with last-played, sessions-this-week, key metric; 📊 button opens history modal per app
- `style.css` — dark theme hub styles + all CSS needed by `shared/history.js` output (calendar, trends, tooltips, day details)
- `manifest.json` — installable PWA (borrows `summum/icon.png` until a proper hub icon is created)
- `sw.js` — caches all 87 files across all sub-apps; generated via `get_cache.go`

### Service Worker Strategy
- Root SW (scope `/`) caches everything; sub-app SWs take precedence for their scope once registered
- summum and stop have no own SW — they rely entirely on the root SW for offline use
- Visiting the hub once is sufficient to make all sub-apps available offline

### `get_cache.go` (copied from magrana, modified)
- Seeds crawl from root `index.html` **and** every immediate `*/index.html` automatically
- `findDependencies` now falls back to `.js` / `/index.js` for bare imports (no extension)
- `os.Stat` skips directories (fixes `start_url: "./"` false positive)
- JS regex broadened to catch relative imports without `.js` extension
- Run `go run get_cache.go` from `bt/` after adding files; paste output into `sw.js`

### Bug Fix
- **stop `setBrainFill`**: was mapping progress to 0–100 inset range; corrected to 88–8 (matching summum/nb); fire particles were spawning off-canvas when brain was empty

## Files Touched

### New — Shared
- **shared/fire.js**: Canonical fire particle system
- **shared/haptic.js**: Canonical haptic module (`initHaptic`, `triggerHaptic`, `triggerHapticError`)
- **shared/storage.js**: Parameterised localStorage factory
- **shared/history.js**: Parameterised history UI (calendar + trends + day details)
- **shared/fonts/**: Single copy of all fonts

### New — Hub
- **index.html**: Hub entry point
- **app.js**: Hub logic (data loading, card rendering, cross-app streak, stats modal)
- **style.css**: Hub styles including all history-modal CSS
- **manifest.json**: Hub PWA manifest
- **sw.js**: Root service worker caching all 87 files
- **get_cache.go**: Modified crawl tool (multi-entry-point, bare-import resolution)

### Modified — summum
- **summum/app.js**: Import paths → `../shared/`
- **summum/storage.js**: Thin wrapper around `makeStorage`
- **summum/history.js**: Thin wrapper around `makeHistoryUI`
- **summum/index.html**: Font links → `../shared/fonts/`
- Deleted: `summum/fire.js`, `summum/haptic.js`, `summum/fonts/`

### Modified — stop
- **stop/app.js**: Import path for FireSystem → `../shared/`; `setBrainFill` range fix
- **stop/storage.js**: Thin wrapper around `makeStorage`
- **stop/history.js**: Thin wrapper around `makeHistoryUI`
- **stop/index.html**: Font links → `../shared/fonts/`
- Deleted: `stop/fire.js`, `stop/fonts/`

### Modified — clauer
- **clauer/js/ui.js**: Haptic import → `../../shared/haptic.js`
- **clauer/js/storage.js**: Uses `makeStorage`
- **clauer/js/history.js**: Uses `makeHistoryUI` (gains tooltip on trend bars; `openModal` uses `classList.add("visible")`)
- **clauer/index.html**: Font links → `../shared/fonts/`
- **clauer/sw.js**: Cache paths updated; version bumped
- Deleted: `clauer/haptic.js`, `clauer/fonts/`

### Modified — nb
- **nb/nb.js**: Imports `initHaptic`+`triggerHaptic` from `../shared/haptic.js`; `FireSystem` from `../shared/fire.js`; `initHaptic()` called in `init()`
- **nb/index.html**: Font links → `../shared/fonts/`
- **nb/sw.js**: Cache paths updated; version bumped
- Deleted: `nb/fire.js`, `nb/haptic.js`, `nb/fonts/`

### Modified — tanmateix
- **tanmateix/index.html**: Font links → `../shared/fonts/`
- **tanmateix/sw.js**: Cache paths updated; version bumped
- Deleted: `tanmateix/fonts/`
