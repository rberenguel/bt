# Session Compaction Summary

## User Intent

- Wire up the already-added update banner so users are notified when a new PWA version is available
- Prevent consecutive repeated symbols in generated puzzle sequences (within a batch)

## Contextual Work Summary

### PWA Update Flow

- The HTML already had `#update-banner` (hidden) and `#update-link` added in unsubmitted changes
- Expanded the inline SW registration script in `index.html` to detect waiting/installing workers and show the banner
- Added `SKIP_WAITING` message handler in `sw.js` so clicking "reload" triggers the new SW to activate
- On `controllerchange`, the page reloads automatically to load fresh cached assets

### Sequence Generation Fix

- Added `pickNonRepeating(pool, prev)` helper in `game.js` — retries random pick until it differs from the previous item
- Applied to both generation paths: normal mode (full sequence) and hard mode (per-batch)
- `prev` resets to `null` at each hard mode batch boundary, so cross-batch repetition is not prevented (by design)

### Version Bump

- Bumped from 0.3.1 → 0.3.2 (already in unsubmitted changes) → 0.3.3 (this session)
- Updated in `manifest.json` and `sw.js` cache name

## Files Touched

### Core Logic

- **js/game.js**: Added `pickNonRepeating()` helper; replaced raw `Math.random()` picks in both sequence generation loops

### PWA / Service Worker

- **sw.js**: Added `message` event listener for `{ type: "SKIP_WAITING" }` to support update flow; cache name bumped to v0.3.3
- **manifest.json**: Version bumped to 0.3.3

### UI / Shell

- **index.html**: Expanded SW registration block to handle `registration.waiting`, `updatefound`/`statechange`, banner display, `SKIP_WAITING` postMessage on link click, and `controllerchange` reload; update banner div was already present
- **style.css**: (pre-existing change) Added `max-height: 90vh` + `overflow-y: auto` to modal for small-screen overflow fix
