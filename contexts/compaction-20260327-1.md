# Session Compaction Summary

## User Intent

- Integrate the `entrellat` game (from `../misc-pwas/entrellat`) into the `bt` hub following established patterns
- Track session history (solved/failed/total counts per visit)
- Identify genuine gaps in the current brain training coverage

## Contextual Work Summary

### Entrellat Integration

- Copied game wholesale from `misc-pwas/entrellat` into `bt/entrellat/`
- Adapted `index.html`: title as hub back-link, added stats button, history modal HTML, Phosphor CSS
- Adapted `game.js`: added haptics (`triggerHaptic` on correct/skip, `triggerHapticError` on wrong), session tracking (solved/failed/total), save on `visibilitychange`/`pagehide`; kept importmap + bare `'three'` specifier for libs compatibility
- Created `storage.js` and `history.js` following rot pattern
- Updated `manifest.json` (start_url, maskable icon)

### Bug Fix

- Removing the importmap broke the three.js lib files (`LineSegmentsGeometry`, `LineMaterial`, `LineSegments2`), which all import from bare specifier `'three'` internally
- Fix: restored importmap in `index.html`, reverted `game.js` to `import * as THREE from 'three'`

### Hub Registration

- Added entrellat to `APPS` array in `app.js` (color `#22d3ee`, storageKey `entrellat_history`, keyMetric: solved count)
- Added entrellat files to `sw.js` cache list, bumped cache version to `bt-hub-v0.4.1`
- Added paragraph to `README.md`

### Gap Analysis

- Corrected misreading of dotmatrix (it's Raven-style inductive pattern completion, not visual memory) and summum (it's 1-back running addition with adaptive pacing, not verification)
- Identified **prospective memory** as the most meaningful and practical gap
- Documented in `GAP.md` with full paradigm description, metrics, and difficulty levers
- Task-switching with RT cost (switch cost measurement) also noted as a real gap
- Temporal estimation dismissed as low-value for stated goals

## Files Touched

### New: bt/entrellat/

- **index.html**: Adapted from source; importmap retained, hub back-link, stats button, history modal
- **game.js**: Haptics, session tracking, save-on-hide, openHistoryModal wired up
- **style.css**: Original styles + modal styles + `.icon-btn` / `.header-actions` / `.intro-hub-link`
- **storage.js**: Standard `makeStorage` wrapper, saves solved/failed/total
- **history.js**: Standard `makeHistoryUI` wrapper
- **manifest.json**: Updated start_url and icon purpose
- **icon.png**, **libs/**: Copied verbatim from source

### Modified: bt root

- **app.js**: Entrellat entry appended to `APPS` array
- **sw.js**: Cache version bumped, 12 entrellat files added
- **README.md**: Entrellat paragraph added before regles section
- **GAP.md**: New file — prospective memory gap description with paradigm, metrics, difficulty levers
