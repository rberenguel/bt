# Session Compaction Summary

## User Intent

- Implement the last remaining planned feature: distractor premises (noise filtering)
- Evaluate the negations plan and a new temporal logic proposal to decide whether to pursue them
- Close out the feature development phase entirely

## Contextual Work Summary

### Distractor Premises Implementation

- New `injectDistractors(coreEntities, conclusionPath, numDistractors)` method in `PathBasedQuestionGenerator.js`
- Creates brand-new dead-end entities (via `entityFactory.createEntity()`) related to safe middle-entity anchors — never to conclusion endpoints
- Always uses Linear relations for distractors; randomises dimension, direction, and vocabulary text per distractor
- Called inside `generateMultiPathQuestion()` after core premises are built, before shuffling; injected premises merged into `shuffledPremises`
- `distractorCount` and `distractorEntityIds` stored in `question.metadata`

### Difficulty Gating (main.js)

- `newQuestion()` computes `numDistractors` from `gameState.difficulty.level` before calling the generator
- Level < 3: 0 distractors; Level 3–5: 50% chance of 1; Level ≥ 6: 1 or 2 (50/50)
- `calculateTimeLimit()` adds `0.5 × TPP` per distractor on top of normal premise time

### Plan Evaluations — Both Cut

- **Negations (Idea #4):** Rejected. The only interesting case (all-non-strict chain, strict conclusion → False) is too rare to emerge naturally, the vocabulary ("not larger than") is ambiguous under time pressure, one of the plan's two examples is actually an indeterminate question (already handled), and implementation cost is high for marginal gain.
- **Temporal Logic (new idea):** Rejected. Pure temporal sequencing is already covered by the existing `temporal` dimension in LinearRelationType. Allen's Interval Algebra (the novel part) is incompatible with the True/False/Indeterminate model because composition yields disjunctions. Spatiotemporal mixing is two disconnected puzzles, not one richer one.

### Cleanup

- Deleted `plans/` directory and all four plan files
- Memory updated: feature development marked complete
- README updated: added Distractor Premises section with example
- Version bumped to `0.8.0` in `manifest.json`

## Files Touched

### Core Logic

- **`generators/PathBasedQuestionGenerator.js`**: New `injectDistractors()` method; `generateMultiPathQuestion()` updated to call it when `options.numDistractors > 0`; distractor debug log added; `distractorMeta` spread into question metadata

### Game Entry

- **`main.js`**: `newQuestion()` computes level-based `numDistractors` and passes via options; `calculateTimeLimit()` adds `0.5 × TPP` per distractor

### Docs & Config

- **`README.md`**: Added Distractor Premises section (before "Advanced: Multi-Path Questions")
- **`manifest.json`**: Version bumped to `0.8.0`
