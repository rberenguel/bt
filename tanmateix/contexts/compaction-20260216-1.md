# Session Compaction Summary

## User Intent

- Implement PWA update detection and caching (matching Tasca's implementation)
- Revamp difficulty progression to be more punishing but fair (every 2 correct vs every 10)
- Make timing dynamic based on question complexity, relation type, and difficulty level
- Add scroll discount for mobile UX when many premises require scrolling

## Contextual Work Summary

### PWA Update Detection

- Created service worker with file caching and update detection
- Implemented update banner UI that appears when new version is available
- Users now get prompted to reload when updates are deployed
- Change cache version in `sw.js` to trigger updates

### Difficulty System Overhaul

- **Progression:** Changed from every 10 correct → every 2 correct answers
- **Regression:** Added difficulty decrease on every failure (wrong answer or timeout)
- **Weighted randomness:** 50% level, 25% entities, 25% paths (biased toward time pressure)
- **No double-punishment:** Only one dimension changes at a time (prevents oscillation loop)
- Removed fixed `timeLimit` from difficulty object, replaced with dynamic `level` property

### Dynamic Timing System

- **Interpolated timing:** Linear interpolation between milestone levels (1, 4, 7, 10)
- Every level increase smoothly tightens timing (no more tier jumps)
- Four milestone anchors: L1 (Learning), L4 (Flow), L7 (Hardcore), L10+ (Grandmaster)
- Different TPP for Linear (faster) vs Spatial (slower) relation types
- Formula: `totalTime = (numPremises × TPP) + setupBuffer`
- **Scroll discount:** Premises 11+ count at 75% TPP (acknowledges scrolling/scanning on mobile)
- Example: L2 uses 3.67s TPP (interpolated between L1's 4.0s and L4's 3.0s)

### UI & Testing

- Added maxStreak tracking for accurate game-over stats
- Enhanced console logging with timing breakdown and scroll indicator (📜)
- Existing test functions (`window.tanmateix.testLongPath()`, etc.) work for mobile testing
- Version bumped to 0.5.0

## Files Touched

### PWA Implementation

- **sw.js** (new): Service worker with v0.5.0 cache, file list, update lifecycle
- **index.html**: Added update banner div and service worker registration script
- **render/logic.css**: Styling for fixed bottom update banner with accent colors

### Core Game Logic

- **main.js**: Major refactor of difficulty system
  - Added `TIERS` array with milestone levels (1, 4, 7, 10) and TPP values
  - Added `getTimingConfig(level)` function for linear interpolation between milestones
  - Added `calculateTimeLimit(question, level)` function with scroll discount
  - Rewrote `increaseDifficulty()` with weighted random selection
  - Added `decreaseDifficulty()` for failures
  - Updated `handleAnswer()`, `handleTimeout()`, `newQuestion()` to use new system
  - Simplified `updateLevel()` to use `difficulty.level` directly
  - Added `maxStreak` tracking in game state
  - Enhanced console logging to show interpolated TPP values

### Configuration

- **manifest.json**: Version 0.4.0 → 0.5.0
