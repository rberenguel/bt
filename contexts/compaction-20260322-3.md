# Session Compaction Summary

## User Intent

- Add Exploit as Phase C inside Precís (not a standalone app — corrected mid-session)
- Remove Scope (Phase A) from Precís — it had no real challenge once patterns are learned
- Polish across the battery: favicons, hub links, session lengths, timer visibility

## Contextual Work Summary

### Precís — Phase C (Exploit) Added

- New drill type: player toggles entity attributes to get ALLOW while satisfying a "malicious objective" (e.g. get ALLOW for a flagged, non-premium entity)
- Engine: `genPassingTrapPayload` (guaranteed-passing trap), `hasChoice` (ensures OR/UNLESS in AST), `genExploitQuestion`, `findLoophole` (identifies which clause clinched the pass)
- Phase C always uses `effectiveLevel = max(level, 2)` — 3-term rules minimum, must have OR or UNLESS
- Score penalty: wrong SUBMIT = `-1` from score; correct = `+1`; timer +8s bonus
- Loophole reveal on correct: chips that "clinched" the pass light up green with a label
- Phase mix: 25% Literal / 75% Exploit (via `phaseBRate: 0.25`)

### Precís — Scope (Phase A) Removed

- `genScopeQuestion`, `renderOptionHtml`, all Phase A UI/events/CSS removed
- Reasoning: comma/either-both disambiguation is learnable in 30s, then purely mechanical
- Removed `scopeAcc` from state, modal, storage, history
- Cleaned dead CSS: `.scope-sentence`, `.parse-options`, `.parse-option`, `.parse-group`, etc.

### Session Length Reductions

- Precís: 15 → **10 questions** (~3–4 min)
- Llei: 10 → **6 puzzles** (~4–5 min)

### Timer Hidden Until Play

- Both Precís and Llei: `timer-track` starts with `.hidden`, shown on `startSession()`, hidden again on `resetSession()`

### Favicon Standardisation

- All apps now use `<link rel="icon" href="icon.png" type="image/png" />`
- Updated: attn, llei, mussol, precis, rot, stop, summum (added), dotmatrix, tanmateix (changed from favicon.ico)
- clauer, regles were already correct

### Regles Polish

- Replaced bare arrow back-link with standard app name + version header (matches other apps)
- Version loaded from `manifest.json` in `game.js`
- Splash screen REGLES title is now a hub link (same pattern as Tanmateix) — removed separate "← Back to hub" overlay link

### Copy / Metadata

- Precís idle overlay: removed "Train to read language like a compiler" subtext
- README: Precís description updated to describe Literal + Exploit only
- Precís manifest description updated

## Files Touched

### Precís — Core

- **precis/app.js**: Phase A removed; Phase C engine + question gen + chip render + submit + loophole reveal added; phase mix, timer, scoring updated
- **precis/index.html**: Phase A area + ambig-btn removed; Phase C area + SUBMIT button added; scope acc removed from modal; idle text updated; favicon added
- **precis/style.css**: Phase A CSS removed; Phase C styles added (chip-toggle, chip-on, chip-loophole, feedback-bar, reveal-area, submit-btn)
- **precis/storage.js**: `scopeAcc` removed, `exploitAcc` kept
- **precis/history.js**: `scopeAcc` metric removed
- **precis/manifest.json**: version 0.1.0 → 0.2.0; description updated

### Llei

- **llei/app.js**: `puzzlesPerSession` 10 → 6; `timer-track` show/hide on start/reset
- **llei/index.html**: `timer-track` starts hidden; favicon added

### Regles

- **regles/index.html**: Header replaced with app-name link; overlay title wrapped in hub `<a>`; overlay-hub-link element removed
- **regles/style.css**: `.back-link` → `.app-name` + `.version-text`; dead overlay-hub-link CSS removed
- **regles/game.js**: Version loading added; hub link toggle logic removed

### Other Apps (favicon only)

- **attn/index.html**, **mussol/index.html**, **rot/index.html**, **stop/index.html**, **summum/index.html**: favicon link added
- **dotmatrix/index.html**, **tanmateix/index.html**: favicon updated from `.ico` to `icon.png`
