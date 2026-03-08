# Session Compaction Summary

## User Intent

- Polish and complete the bt monorepo: fix bugs, improve UX, add stats tracking, add navigation back to hub
- Make all apps consistent (brain fill, shared storage, history UI)
- Clean up the hub index page visually

## Contextual Work Summary

### Stop App Fixes

- Brain fill now tracks current session progress (0→1 over trials), not historical accuracy — matched summum/nb behaviour
- Removed horizontal progress bar (brain is sufficient)
- Added calibration info (`calib-info` div) above display area showing "warming up X/5"
- Response buttons taller (5rem→7rem); stop signal repositioned at `top: 22%` to avoid overlapping arrow
- Idle text rewritten to be clearer

### Tanmateix — Major Additions

- Added `storage.js` + `history.js` using shared modules; session saved at game over (score, accuracy, maxStreak, finalLevel)
- Added `faker.js` for console-injectable fake history (`injectFakeHistory()`, `clearHistory()`)
- Added brain/fire fill in header (replaces static icon.png); fills as questions progress
- Restart button (`ph-arrow-clockwise`) added to header stats row
- Brain container is the stats button (opens history modal); dedicated chart-bar icon removed
- History modal added to HTML with full calendar/trend CSS in `logic.css`
- Fixed stuck-at-Q30 bug: `setTimeout` callbacks in `handleAnswer`/`handleTimeout` now `async` with try/catch
- Session length reduced from 50 → 30 questions; all labels updated
- Difficulty caps reverted (not wanted); round limit is the soft cap instead
- `MAX_LEVEL`/`MAX_PATHS`/`MAX_ENTITIES` constants removed

### Hub Index Page

- App cards now show each app's `icon.png` (48px, rounded) instead of colored left-border strip
- App name color unified (all `var(--text)`, not per-app color)
- Background changed to pure black (`#000`)
- Stats button uses `ph-chart-bar` Phosphor icon instead of 📊 emoji; Phosphor CSS loaded in hub
- App order changed to: nb, clauer, tanmateix, summum, stop
- Tanmateix entry in hub updated with `storageKey`, `keyMetric`, and `metricDefs`

### Back-to-Hub Navigation

- **Summum**: app name in header is a link to `../`
- **Stop**: app name in header is a link to `../`
- **nb**: `(nb)` in instructions modal links to `../`; also small "nb" link in `.round-wrap` wrapper below `#round-display` in top-bar (flex column, centered)
- **Tanmateix**: `<h1>` on start screen and `<h2>` in info modal both link to `../`; thin `app-title-bar` with version in header links to `../`
- **Clauer**: `app-title-bar` fixed to top of viewport (`position: fixed; top: 0`), centered, links to `../`; uses `.with-version` template

### nb Back-link Structure

- `#round-display` wrapped in `.round-wrap` (flex column, `align-items: center`)
- `.nb-home-link` sits as normal flow sibling below `#round-display` inside wrapper
- Width constraint moved from `#round-display` to `.round-wrap`
- Top-bar `align-items: center` unchanged

### Version Bump

- Hub `manifest.json` and `sw.js` bumped to `0.1.2`
- Master `README.md` created with icon + per-app blurbs + directory tree

## Files Touched

### Hub

- **index.html**: Added Phosphor CSS link
- **app.js**: App icons, unified name color, reordered APPS, tanmateix stats enabled, ph-chart-bar icon
- **style.css**: Black bg, unified app-name color, icon/info-wrap card layout
- **manifest.json**: Version 0.1.2
- **sw.js**: Cache version 0.1.2
- **README.md**: New master README with icon

### Stop

- **stop/index.html**: Removed progress bar, added calib-info div, updated idle text, app-name→link, larger buttons, stop-signal top
- **stop/app.js**: Brain fill from session progress, calib-info wiring, removed updateBrain/progressBar
- **stop/style.css**: Removed progress bar CSS, added calib-info CSS, button height, stop-signal position

### Tanmateix

- **tanmateix/storage.js**: New — makeStorage wrapper
- **tanmateix/history.js**: New — makeHistoryUI wrapper
- **tanmateix/faker.js**: New — fake history injector
- **tanmateix/main.js**: Imports, brain fill, setBrainFill, async fix, saveSession, restart wiring, stats wiring, version-header population
- **tanmateix/index.html**: Brain container replaces app-icon, restart btn, stats-btn on brain, calib-info removed, history modal, app-title-bar, h1/h2 links
- **tanmateix/render/logic.css**: Brain/fire CSS, history/calendar/trend CSS, app-title-bar CSS

### nb

- **nb/index.html**: `(nb)` link in instructions modal; `.round-wrap` wrapping `#round-display` + `.nb-home-link`
- **nb/style.css**: `.round-wrap` flex column, `.nb-home-link` styles, `#round-display` width moved to wrapper

### Clauer

- **clauer/index.html**: `app-title-bar` at top of body (outside `#app`); help modal title links to `../`
- **clauer/style.css**: `app-title-bar` fixed+centered, `app-title-link` styles

### Summum

- **summum/index.html**: App name wrapped in `<a href="../">`
