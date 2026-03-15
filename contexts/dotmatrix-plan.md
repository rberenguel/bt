# Dot Matrix — Implementation Plan

## Overview

A new bt subgame based on the dot matrix puzzle from puzzling/dotmatrix.html.
Self-contained, dark-themed, no canvas, no book generation.
Location: `bt/dotmatrix/` following the bt sub-app pattern.

## What It Is

A visual sequence puzzle. A dot grid (e.g. 7×7) evolves over time according to
a hidden rule. The player sees 4 frames (steps 1–4) and must identify which of
four option grids is the correct step 5.

Rules (carried over from puzzling, 4 types):

- **move_simple** — entire pattern shifts by (dx, dy) each tick (wrapping)
- **move_dual** — two overlaid patterns each shifting in different directions
- **rotate** — pattern rotates 90° CW each tick
- **xor_accumulate** — static map XOR'd with a column-mask that shifts right each tick

## Key Design Decisions

### Drop the canvas

All dot grids rendered as HTML/CSS: a `div.dot-grid` with CSS Grid of `div.dot`
circles. Option cards are real `<button>` elements with proper touch targets.
No coordinate hit-testing, works cleanly on mobile.

### 4 frames shown (generate 5, display 4, answer is 5th)

Currently puzzling shows 3 frames. Showing 4 reduces difficulty and gives more
context to infer the rule. Layout: 2×2 grid of numbered frames (1–4), then
2×2 grid of option cards (A–D).

### Rule-aware wrong answers (critical fix)

Current puzzling mutates 1–2 random dots — nearly indistinguishable from correct.
New approach: each wrong option is a semantically different mis-application of
the rule. Per rule:

**move_simple** (shift dx, dy):

- Wrong 1: frame 4 repeated (no advance)
- Wrong 2: shifted in opposite direction (−dx, −dy)
- Wrong 3: shifted perpendicular (dy, −dx)

**rotate** (90° CW):

- Wrong 1: frame 4 repeated (no rotation)
- Wrong 2: rotated CCW (= 3× CW)
- Wrong 3: rotated 180° (= 2× CW)

**move_dual** (two patterns, independent shifts):

- Wrong 1: only pattern 1 advances, pattern 2 stays
- Wrong 2: only pattern 2 advances, pattern 1 stays
- Wrong 3: both advance but directions swapped

**xor_accumulate** (static XOR column-mask at index i):

- Wrong 1: mask at index 3 (one step back)
- Wrong 2: mask at index 5 (one step forward = overshoot)
- Wrong 3: mask at index 2 (two steps back)

After generating 3 wrong options, shuffle all 4 (correct + 3 wrong) and place
correct at a random index.

### Colour scheme

Pure black background, amber/orange accent — not full solarized, just inspired:

- `--bg`: #000
- `--surface`: #111
- `--border`: #222
- `--text`: #e8e8e8
- `--muted`: #555
- `--amber`: #d97706 ← dots-on, option labels, title accent
- `--green`: #22c55e ← correct answer highlight
- `--red`: #ef4444 ← wrong answer highlight

### Answer reveal

On selection: selected card gets red/green border immediately. The correct card
is always revealed green after a wrong guess (unlike mussol — here seeing the
right answer teaches the rule). A "Next" button appears. Auto-advance after ~1s
on correct, wait for Next on wrong.

## File Structure

```
bt/dotmatrix/
  index.html     — self-contained (inline <style> + <script>)
  icon.png       — to be added
  manifest.json
```

No separate app.js / style.css — keeping it one file for simplicity since there
is no history, no storage, no brain fill. Just the puzzle game.

## Hub Integration

Add to bt/app.js APPS registry:

- id: "dotmatrix", name: "Dot Matrix", path: "./dotmatrix/", color: "#d97706"
- No storageKey (no session history for now)
- No keyMetric

Update sw.js via get_cache.go after creating the files.

## bt-pattern Header

Standard bt header: "Dot Matrix vX.X.X" as a back-link to "../", no brain/fire
(no session tracking yet). May add later if scoring is introduced.

## Potential Future Additions (not in scope now)

- Session scoring + history + brain fill
- Additional rules (e.g. invert, mirror, grow/shrink)
- Difficulty setting (grid size, or simpler/harder rule selection)
- Timer per puzzle
