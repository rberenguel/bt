# Session Compaction Summary

## User Intent
- Design and build **Precís**, a new brain-training PWA for the bt battery that trains literal compliance and ambiguity detection ("human compiler" mindset)
- Iterate on Precís based on playtesting and analysis (Gemini review)
- Plan two follow-on apps: **Exploit** (loophole finding) and **Llei** (rule writing from examples)
- Fix missing "Back to hub" links across all apps in the battery

## Contextual Work Summary

### Precís — Initial Build
- New PWA at `/Users/ruben/code/bt/precis/`
- Two alternating drill phases: **Scope** (Phase A — identify parse tree or flag ambiguity) and **Literal** (Phase B — evaluate rule against entity payload, ALLOW/DENY)
- AST engine: `genAST`, `evalAST`, `renderAST` — pure boolean logic over 5 abstract attributes (active, approved, flagged, premium, urgent)
- Phase A generates 3-term sentences with mixed operators; disambiguation via comma placement or "either/both" phrasing; 30% chance of genuinely ambiguous sentence
- Phase B uses `genTrapPayload` — generates 12 candidates, prefers those that contradict the naive "all-positive = passes" assumption
- Tau Prolog not used — pure JS boolean evaluation is sufficient for this app
- Timings calibrated against Tanmateix: L1=14s, scaling to 6s at L6; Phase A gets +4s bonus

### Precís — Iteration Fixes
- **Option B render bug**: `renderOptionHtml` was passing wrong args for option B, causing both parse options to show the same group. Fixed to show `[b op2 c]` for option B
- **Color as hint**: Removed green/grey chip color distinction — all chips now visually neutral; state encoded in text only (`approved` vs `unapproved`)
- **Phase A gating**: Removed `level >= 2` requirement; Phase A available from question 1
- **Phase mix**: Increased `phaseARate` from 0.35 to 0.50
- **Negation**: Added `NOT` leaves (30% chance at level 2+) with red/bold rendering
- **UNLESS**: Re-enabled at level 3+ (45% chance) — the key "catch" mechanic
- **Chained mode**: Correct Phase A → immediately chains into Phase B using the same rule's AST (same question slot); badge shows "→ APPLY IT". Pre-generates `linkedLiteral` in `genScopeQuestion`
- **Distractors**: `genLiteralFromAST` adds 1–2 extra attributes not in the rule; dimmer opacity
- **Disambiguation parens**: `renderAST` takes `unambiguous` flag — standalone Phase B shows `(b OR c)` grouping; linked Phase B omits parens (player just parsed the structure)
- **UI framing**: Added `section-label` divs ("valid if" / "entity" / "sentence" / "which parse is correct?"); DENY/ALLOW buttons have sublabels ("fails rule" / "passes rule")

### Plans Written
- `precis/EXPLOIT_PLAN.md`: Exploit app — inverse of Literal; player toggles entity attributes to find payload that satisfies rule letter while violating intent. Reuses full Precís engine. UI: toggleable chips + SUBMIT. Loophole reveal on correct answer. Recommended as standalone app
- `llei/PLAN.md`: Llei app — player sees labeled valid/invalid entity examples, writes the separating rule. Generation follows Murder It Wrote approach (truth first → Gini-scored population → essentiality pruning to minimal examples). Rule input via condition selector or pseudocode. Recursive descent parser grammar documented. Key pitfalls from this session recorded in plan

### Hub Integration
- Precís added to `app.js` APPS registry with `precis_history` storage key; metrics: score, overall accuracy, scope accuracy, literal accuracy, final level

### Back-to-Hub Fix (all apps)
- All apps had header link (`href="../"`) but results modals covered it
- Added `← Back to hub` anchor link inside results modals for: **rot, attn, stop, summum, mussol, dotmatrix, clauer**
- **tanmateix**: added to JS-injected end-screen template in `main.js`
- **regles**: added to overlay HTML; `showOverlay` toggles visibility — only shown when `btn === "Play Again"` (not on start screen)
- **nb**: skipped (different modal architecture)
- CSS class `.modal-hub-link` appended to each app's stylesheet

## Files Touched

### New App — Precís
- **precis/index.html**: Full game UI; two phase display areas; labeled sections; DENY/ALLOW with sublabels
- **precis/app.js**: AST engine, trap payload generator, Phase A/B question generation, chained mode, timer, brain fill/fire, all event handlers
- **precis/style.css**: Full stylesheet; neutral chips, parse-group highlighting, section labels, feedback states
- **precis/storage.js**: Saves score, accuracy, scopeAcc, literalAcc, finalLevel
- **precis/history.js**: History UI with all 5 metrics
- **precis/manifest.json**: PWA manifest

### New Plans
- **precis/EXPLOIT_PLAN.md**: Full design plan for Exploit app
- **llei/PLAN.md**: Full design plan for Llei app including generation algorithm, parser grammar, Gini scoring, pitfall notes

### Hub
- **app.js**: Added Precís entry to APPS registry

### Back-to-Hub Fixes
- **rot/index.html**, **attn/index.html**, **stop/index.html**, **summum/index.html**, **mussol/index.html**: Hub link + "Play again" label in results modal
- **dotmatrix/index.html**: Hub link + inline CSS for `.modal-hub-link`
- **clauer/index.html**: Hub link in results-screen buttons div
- **tanmateix/main.js**: Hub link in JS end-screen template string
- **regles/index.html**: Hub link element (hidden by default) in overlay
- **regles/game.js**: `showOverlay` toggles hub link visibility based on session state
- **rot, attn, stop, summum, mussol, regles, clauer style.css**: `.modal-hub-link` CSS appended
