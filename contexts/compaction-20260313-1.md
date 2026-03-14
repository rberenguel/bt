# Session Compaction Summary

## User Intent

- Build `attn` — a new subgame based on Adrian Wells' Attention Training Technique (ATT) — as a first-class bt citizen with full history, haptics, brain fill, and uniform UI
- Integrate it into the bt hub (app registry, service worker cache)
- Discuss mussol (analogy quiz) as a potential addition to bt; trim its dataset selection

## Contextual Work Summary

### attn — New Subgame

- Three-phase session: selective attention (track 1 ball, 30s), attention switching (6 sequential flashes every 5s, track the last, 30s), divided attention (track 3 simultaneous balls, 30s)
- Ball count configurable 3–15 on intro screen (default 7); minimum 3 balls
- Bouncing arena is 90vw × flex:1 (~90% viewport height); ball bounds computed dynamically from container size and ball radius so edges touch walls cleanly
- Straight-line physics only (Brownian jitter removed as a bug)

### attn — Brain Fill & Fire

- Continuous RAF-based fill loop tied to active session time (`Date.now() - sessionStartTime - fillPausedTotal`)
- Fill pauses during verification phases (`pauseFill` / `resumeFill`) so the brain doesn't advance while user is tapping balls
- Fill resumes at the start of each subsequent phase; `stopFillLoop` + `setBrainFill(1)` at session end

### attn — Phase 2 Mechanics

- Phase 2 uses sequential flashes (6 balls, every 5s) — not persistent highlighting
- Repeats allowed but never two consecutive identical balls
- Verification asks for the last flashed ball only

### attn — Metrics & History

- Stores all raw data: `balls`, `accuracy`, `eb` (effective balls = balls × accuracy/100), `score` (0–5), `phase1`, `phase2`, `phase3`
- Headline metric: **effective balls (EB)** — rewards both accuracy and difficulty
- Hub card shows latest EB; results modal shows EB, score/5, balls, accuracy, per-phase breakdown
- History trends chart EB, balls, accuracy; day details show all 7 metrics

### bt Hub Integration

- `attn` added to APPS registry in `app.js` (sky blue `#38bdf8`, `keyMetric` = EB)
- `sw.js` updated via `get_cache.go` output: added attn files, `./icon.png`, `./shared/idb-keyval.js`, new tanmateix files; bumped to `bt-hub-v0.2.5`
- Hub `manifest.json` bumped 0.2.4 → 0.2.5
- README updated with attn description and directory tree entry

### Version Alignment (wrap-up)

- All manifests and SW cache names confirmed in sync at session end; no additional bumps needed

### Mussol (discussed, not integrated)

- Analogy quiz PWA; fits bt as relational/analogical reasoning (distinct cognitive domain)
- Dataset trimmed to SAT-style only: `sat`, `sat_metaphor`, `u2`, `u4` (1,261 questions total)
- Full dataset list preserved in `_allDatasets` unused variable; no folders deleted
- Not yet integrated into bt hub (needs shared haptic, history, brain fill)

## Files Touched

### attn/ (all new)

- **attn/index.html**: Uniform UI — header with back link + brain/fire stats button, canvas arena, intro overlay (ball picker), instruction bar, results + history modals
- **attn/app.js**: Full ES module rewrite — ball picker, 3-phase session, dynamic bounds, continuous brain fill with pause/resume, haptics on click, history save
- **attn/style.css**: Uniform dark theme matching stop; canvas-container 90vw × flex:1
- **attn/storage.js**: Saves all 7 metrics to IndexedDB via `makeStorage("attn_history")`
- **attn/history.js**: Calendar + trends via shared `makeHistoryUI`; 7 metricDefs
- **attn/manifest.json**: v0.0.1

### bt Hub

- **app.js**: Added attn to APPS registry; updated metricDefs and keyMetric
- **sw.js**: Regenerated CACHE_FILES from get_cache.go; bumped to bt-hub-v0.2.5
- **manifest.json**: Bumped 0.2.4 → 0.2.5
- **README.md**: Added attn to apps list and directory tree

### Mussol

- **mussol/js/main.js**: `datasetMapping` restricted to sat/sat_metaphor/u2/u4; `_allDatasets` added with full list
