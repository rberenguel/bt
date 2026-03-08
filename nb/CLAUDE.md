# Dual N-Back Game

Visual-only n-back cognitive training game. Mobile-first PWA with dual mode (position + color) and triple mode (+ letter).

## Files

```
nb/
├── index.html          # Main HTML
├── nb.js               # Core game logic
├── style.css           # All styling
├── haptic.js           # Haptic feedback (iOS workaround)
├── fire.js             # Canvas particle system
├── manifest.json       # PWA manifest
└── fonts/              # Inter + Phosphor icons
```

## Game States

**IDLE** → Click level display → **STARTING** (1s delay) → **WARMUP** (N rounds) → **RUNNING** → **END** (100 rounds)

**RUNNING** → Click center → **PAUSED** → Click anywhere → **WARMUP** (N rounds) → **RUNNING**

### Key State Variables

```javascript
active; // Is game running?
paused; // Is game paused?
starting; // Initial startup phase?
warmupRounds; // Explicit warmup countdown (resume only)
BACK; // N-back level (1-9)
triple; // Dual (false) or triple (true) mode
history; // Array<{position, color, letter}>
total; // Answerable rounds completed (0-100)
lastReply; // {position: bool, color: bool, letter: bool}
```

## Warmup System

**On start:** Implicit via `history.length <= BACK` check
**On resume:** Explicit via `warmupRounds = BACK` countdown

User cannot answer until `history.length > BACK` AND `warmupRounds === 0`. Button text hidden during warmup.

## Round Lifecycle

Each round in `nextRound()`:

1. **Check answers** from previous round (if not warmup)
2. **Unrender** previous square
3. **Generate** next step (30% chance to match N-back reference)
4. **Update UI** (button visibility, round display)
5. **Wait 300ms** (blank period)
6. **Render** new square with color/letter
7. **Auto-advance** after 3s (dual) or 5s (triple)

Answers checked at START of next round, not end of current round.

## Step Generation

When `history.length >= BACK`, 30% chance to attempt matches:

- Each dimension has 50% chance to match N-back reference
- Otherwise fully random
- Creates ~15% actual match rate (not too easy, not too hard)

## UI Components

### Grid (3×3)

- **IDLE:** Click square N to set level to N+1, click again to toggle dual/triple
- **RUNNING:** Timer animation grows from center (inset 43% → 0%)
- **Unrender:** Shake animation (0.15s) via `.was-active` class

### Buttons (invisible touch zones)

- **Left 25%:** Position (vertical text)
- **Right 25%:** Color (vertical text)
- **Bottom center 50%:** Letter (horizontal, triple only)
- **Center:** Pause (invisible)

Button text opacity: 0 during warmup, 1 when answerable.

### Top Bar

- **Round display:** Info icon (IDLE), round number (RUNNING), restart icon (PAUSED)
- **Level display:** "N₂" or "N₃", clickable to start
- **Progress:** Randomized icon (brain or battery) with gradient fill + fire particles

## Progress Indicator

Supports multiple icon sets (randomized on load):

- **Brain:** Single icon with 88%→8% fill range
- **Battery:** 5 icons (empty/low/med/high/full) switching at 20% thresholds, 100%→0% fill range

All use same gradient system (crimson → gold). Add new icons by extending `PROGRESS_ICON_SETS`.

## Feedback

### Haptic

- 50ms: Light (square click, button press, pause)
- 100ms: Medium (start, correct answer, resume)
- 150ms: Strong (incorrect answer, end)
- 200ms: Celebration (perfect round)

### Visual

- **Correct:** Green flash (500ms), medium haptic
- **Incorrect:** Red flash (500ms), strong haptic
- **Perfect round:** Brain pop animation (600ms delay), celebration haptic

## Modals

1. **Instructions:** Click info icon (IDLE)
2. **Pause stats:** Auto-opens on pause, closing resumes game
3. **Results:** Shows stats after 100 rounds with level suggestions:
   - ≥80%: "Consider advancing"
   - 50-79%: "Keep practicing"
   - <50%: "Try an easier level"

## Fire Particle System

Canvas-based particles rise from progress indicator. Intensity scales cubically with progress (`Math.pow(progress, 3)`). Particles transition: white → orange → red as they fade.

Max particles: `5 + Math.floor(130 * intensity)`

## Critical Implementation Details

### Timer Animation

Grows from small to large (not shrinking) so colored border always visible. Uses `inset: 43%` for 14% starting visibility. Desktop uses 6rem padding vs mobile 3rem for similar visual effect.

### Warmup Logic

Button guard: `if (!active || history.length <= BACK || warmupRounds > 0) return;`

Checks both implicit (initial) and explicit (resume) warmup.

### Pause Behavior

- Clears all timeouts/animations
- Preserves statistics and history
- Resets button states and lastReply
- Resume triggers BACK-round warmup

### Answer Checking

Only checks if `!lastRoundWasWarmup && history.length > BACK`

Correct = (match && userSaidMatch) || (!match && !userSaidMatch)

## Design Decisions

**No auto-leveling:** 100 rounds is enough; user controls progression with suggestions in results modal.

**Implicit vs explicit warmup:** Start uses history.length check (natural), resume uses counter (gives fresh start).

**Visual-only:** No audio requirement for accessibility and differentiation.

**Mobile-first:** Portrait layout, large touch targets, haptic feedback.

## Known Quirks

- Last warmup round: `warmupRounds` becomes 0 but buttons still disabled via `lastRoundWasWarmup` check
- Stats update at 300ms (before button flash completes at 500ms) - not noticeable
- Square shake uses `.was-active` class to trigger precisely when timer completes

---

_Total file size: ~32KB (excellent for PWA)_
