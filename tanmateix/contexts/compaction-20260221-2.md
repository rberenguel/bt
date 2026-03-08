# Session Compaction Summary

## User Intent

- Add a third answer state ("indeterminate / cannot be determined") for logic questions where the premises don't connect the conclusion entities
- Polish the answer buttons to use Phosphor icons and a whimsical shrug emoji for the indeterminate option
- Bump minor version and document the new feature

## Contextual Work Summary

### Indeterminate Question Generation

- New `generateIndeterminateLinearQuestion(entitiesPerPath)` in `PathBasedQuestionGenerator.js`
- Hub-merge topology: left chain → hub ← right leaf; the two outer leaves have no transitive connection, making any conclusion between them genuinely unprovable
- Wired in at 25% probability for `numPaths === 1 && entitiesPerPath >= 3`

### Question Model

- Added `isIndeterminate: boolean` field to `Question.js` (default `false`)
- `isValid` stays `false` for indeterminate questions; correct answer requires explicitly selecting the shrug button

### Verification

- `verifyLinearQuestion` in `QuestionVerifier.js` short-circuits for `isIndeterminate` questions: confirms neither `c1 < c2` nor `c2 < c1` is reachable via transitive closure

### Game Logic (main.js)

- `handleAnswer`: `answerStr` is now `"true" | "false" | "indeterminate"`; indeterminate questions score correct only on `"indeterminate"`
- Timeout handler updated to record `correctAnswer: "indeterminate"` for indeterminate questions
- `calculateTimeLimit`: +20% time bonus for indeterminate questions

### UI (Renderer.js + logic.css)

- Third answer button always rendered: Phosphor `ph-question-mark` icon + `¯\_(ツ)_/¯` shrug in Monoid font
- True/False buttons use `ph-check` / `ph-x` Phosphor icons with `btn-icon` class (1.3em)
- Shrug text is 0.75em and hidden on mobile (≤480px); only the `?` icon shows
- Purple (`#7c3aed`) color scheme for the indeterminate button
- `flex-wrap` added to `.answer-buttons` for three-button layout

### Fonts & Assets

- `fonts/monoid.css` linked in `index.html` for the shrug text
- Backslash in shrug emoji fixed via `¯\\_(ツ)_/¯` in JS template literal

### Version & Docs

- `manifest.json`: `0.6.0` → `0.7.0`
- `README.md`: added "Indeterminate Questions" section explaining the shrug mechanic

## Files Touched

### Core Logic

- **`models/Question.js`**: Added `isIndeterminate` field
- **`generators/PathBasedQuestionGenerator.js`**: New `generateIndeterminateLinearQuestion`, 25% branch in `generateMultiPathQuestion`
- **`verification/QuestionVerifier.js`**: Indeterminate short-circuit in `verifyLinearQuestion`

### Game Entry

- **`main.js`**: Updated `handleAnswer` and timeout handler for three-state answers; +20% time for indeterminate in `calculateTimeLimit`

### UI

- **`render/Renderer.js`**: Three answer buttons with Phosphor icons; shrug text on indeterminate
- **`render/logic.css`**: `.btn-indeterminate`, `.btn-shrug` (Monoid, 0.75em, hidden on mobile), `flex-wrap` on `.answer-buttons`

### Assets & Docs

- **`index.html`**: Added `fonts/monoid.css` link
- **`manifest.json`**: Version bump to 0.7.0
- **`README.md`**: Documented indeterminate question type
