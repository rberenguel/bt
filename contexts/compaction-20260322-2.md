# Session Compaction Summary

## User Intent
- Iterate on the new **Llei** app (inductive rule learning): puzzle difficulty, UI clarity, and UX polish
- Fix **Rot** round transition (add fade between rounds)
- Wrap up: README descriptions, version bump, cache regeneration

## Contextual Work Summary

### Llei — Puzzle Difficulty
- `genAST` now always uses **3 attributes minimum** (removed level-1 two-attr shortcut)
- `hasSingleDiscriminator` filter rejects any example set where a single attribute perfectly separates LEGAL from ILLEGAL
- Population size bumped to 50; example count raised to 8 (4+4); minimum invalids raised to 3
- **UNLESS operator fully removed** from AST gen, evaluator, renderer, parser, token builder, HTML, and CSS — user preferred `A AND NOT B`

### Llei — Display: Anti-Pattern-Matching
- Each example card now stores its own `attrOrder` (per-card independent shuffle at generation time), stable across re-renders
- Cards render **only active (on) icons** — no placeholder slots for off attributes
- LEGAL cards flush icons **left**, ILLEGAL cards flush icons **right** — breaks matrix geometric comparison

### Llei — UX Polish
- Column headers renamed: VALID→**LEGAL**, INVALID→**ILLEGAL**; section label "your rule:"→**"your law:"**; idle copy updated
- Timeout: instead of auto-advancing after 1.5s, CHECK button becomes **"Next →"** — player reads at own pace
- Timeout feedback renders the law as **icon tokens** (via `astToTokens` + `renderTokenHTML`), not text — player has no text→icon mapping
- CLR button now also **clears ex-correct/ex-wrong card markers** (calls `renderExamples` without playerAST)
- Operator/paren/CLR/backspace buttons now uniform height (`min-height: 2.8rem`, `align-items: stretch`)
- Backspace button stretches to match rule builder height; both backspace and CLR have border
- CHECK button taller (`min-height: 3.5rem`)
- ✕ → **CLR** label
- Timer: restored to `[0, 60, 50, 42, 35, 28, 22]`; rounds: 5→**10**

### Rot — Round Transition
- Added `.fading` CSS class with `opacity: 0; transition: opacity 0.35s ease` on `.shape-grid`
- On correct answer: fade out (350ms) → `startRound()` → fade in

### Wrap-Up
- README: added **Precís** and **Llei** descriptions
- Hub manifest + SW bumped to **0.4.0** (minor bump)
- `go run get_cache.go` regenerated — llei and precis files now in SW cache

## Files Touched

### Llei — Core Logic
- **llei/app.js**: `genAST` (always 3 attrs), `hasSingleDiscriminator`, `astToTokens`, UNLESS removal, per-card `attrOrder`, active-only icon rendering, flush alignment classes, timeout icon feedback, CLR clears markers, 10 rounds, timer restored, `onCheck`/`onTimeout` button wiring

### Llei — UI
- **llei/index.html**: LEGAL/ILLEGAL headers, "your law:" label, idle copy, UNLESS button removed, ✕→CLR
- **llei/style.css**: `card-valid`/`card-invalid` flush alignment, active-only slots, `.fb-label`/`.fb-tokens` for icon feedback, button heights, backspace stretch, CLR border, CHECK height, UNLESS CSS removed
- **llei/manifest.json**: version set to `0.1.0`

### Rot
- **rot/app.js**: fade out/in around `startRound()` on correct answer
- **rot/style.css**: `.shape-grid` transition + `.fading` class

### Hub
- **manifest.json**: `0.3.1` → `0.4.0`
- **sw.js**: CACHE_NAME `bt-hub-v0.4.0`, CACHE_FILES updated with llei and precis entries
- **README.md**: Precís and Llei app descriptions added
