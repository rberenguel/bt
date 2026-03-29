# Session Compaction Summary

## User Intent

- Build a new brain training game (`rot`) for 3D spatial rotation — find the matching pair among 6 wobbling cubelet shapes
- Match the visual quality and feel of an existing C++/WASM version (`/Users/ruben/code/rotator`)
- Integrate cleanly into the existing `bt` hub (PWA, haptics, history, shared design language)

## Contextual Work Summary

### New Game: `rot/`

- 2-minute timed mode (score = correct matches found); no fixed round count
- 6 shapes per round in a 2×3 borderless grid; exactly one matching pair per round
- Shape generation is a faithful port of the C++ algorithm: 4 segments, perpendicular-axis turns only, 2-unit block spacing, self-intersection rejection with retry
- Canonicalisation uses all 24 cube rotation matrices (BFS over Rx/Ry/Rz 90° generators) to guarantee exactly one valid pair and no ambiguous problems
- Wobble animation: 3 independent sin-waves around random 3D unit vectors (bounded oscillation, no drift) — ported from C++ `Wobble` class
- Perspective projection with fixed per-shape scale (computed from bounding sphere radius, constant across frames to prevent zoom artefacts)
- Interior face culling (neighbours at ±2 units); painter's algorithm depth sort

### Rendering Quality

- Colors: exact hue ratios from C++ `GeneratedColors` (vh/vm/vl), brightness scaled from linear-0.51 to sRGB-equivalent `#cc` to match display appearance
- Edge/outline: bright orange `#c86400` (C++ `Orange` constant) at `lineWidth=2` — makes individual cubelets readable
- Ambient 0.75 + diffuse 0.25 lighting; light vector `[0.6, 1, 0.8]`

### UI / UX

- Timer bar (thin, drains left→right, turns red below 20%) replaces text timer
- Score counter top-right; controls row hidden during play (CSS `.app-container.playing`)
- Brain fill tracks score toward personal best+1 (loaded async from history; fallback target=10)
- Selected cells use `outline` (no layout impact); wrong answer dims opacity briefly; no correct-match highlight — haptics are the primary feedback
- No reset button on home screen; modal Close handles post-session reset

### Hub Integration

- Registered in `app.js` APPS registry (`rot_history` storage key, color `#f43f5e`)
- `manifest.json` and `sw.js` both bumped to `0.3.1` (were mismatched: 0.2.9 / 0.3.0)
- Rot files added to SW cache list
- README updated with description and directory tree entry

## Files Touched

### New: `rot/`

- **rot/app.js**: Full game logic — shape gen, canonicalisation, wobble, rendering, timed session, score/history
- **rot/index.html**: Layout — header, timer bar, score, borderless grid, modals
- **rot/style.css**: Styles matching shared design language; playing-state control hiding; timer bar; selected/wrong cell states
- **rot/manifest.json**: PWA manifest v0.1.0
- **rot/storage.js**: Persists `score` and `accuracy` per session
- **rot/history.js**: History UI wired to `makeHistoryUI` with score/accuracy metrics

### Modified: Hub

- **app.js**: Added `rot` entry to APPS registry
- **manifest.json**: Version bumped to `0.3.1`
- **sw.js**: Cache name bumped to `bt-hub-v0.3.1`; rot files added to `CACHE_FILES`
- **README.md**: `rot` added to Apps section and directory tree
