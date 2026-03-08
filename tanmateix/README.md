# <img src="icon.png" alt="Tanmateix Icon" width="32" height="32"> Tanmateix

A logic puzzle game where you evaluate whether conclusions logically follow from given premises.

Test your logical reasoning skills by analyzing relationships between entities and determining if conclusions are valid.

Inspired by [Syllogimous-v3](https://github.com/soamsy/Syllogimous-v3).

## About the Game

**Tanmateix** presents you with logical premises and asks you to determine if a conclusion follows logically. Each game consists of 100 questions testing your deductive reasoning abilities.

### Example Question

**Premises:**

- A is larger than B
- B is larger than C

**Conclusion:** A is larger than C?

**Answer:** True ✓

The game features various types of logical relationships including:

- **Linear relationships** (28 possible dimensions):
  - Physical: size, speed, brightness, temperature, weight, height, distance, depth, width, length, volume, density, hardness
  - Time: age, temporal
  - Value: cost, value, quality, rank
  - Capability: strength, power, difficulty
  - Quantity: quantity
  - Metrics: latency, throughput, availability, error_rate, reliability
- **Spatial relationships** (directional positioning: north, south, east, west, etc.)
- **Syllogistic relationships** (Aristotelian set-theory reasoning):
  - **Subset** — "FOBIX are a type of GAKUN" (A ⊂ B)
  - **Disjoint** — "FOBIX are never GAKUN" (A ∩ B = ∅)
  - Valid inferences: Barbara (A⊂B, B⊂C → A⊂C) and Celarent (A⊂B, B∩C=∅ → A∩C=∅)

### Indeterminate Questions ¯\_(ツ)\_/¯

Some questions are genuinely underdetermined — the premises don't establish any ordering between the conclusion entities. These require a third answer: **Cannot be determined** (the shrug button). Selecting True or False on an indeterminate question is wrong; selecting True or False on a normal question is also wrong — the shrug button is always visible to avoid revealing the question type.

### Distractor Premises

At higher difficulty levels (≥3), some questions include one or two extra premises about entities that are completely irrelevant to the conclusion. These distractors are valid statements — they're just about a different entity that doesn't connect to either conclusion endpoint. The player must identify which premises actually matter and ignore the rest.

**Example:**

- **Core premises:** "GAKUN is larger than FOBIX", "GAKUN is smaller than JEPOL"
- **Distractor:** "MIVAT is larger than GAKUN" ← irrelevant entity
- **Conclusion:** "Is JEPOL larger than FOBIX?" → True ✓ (MIVAT is a dead end)

### Advanced: Multi-Path Questions

The game supports generating questions with multiple premise paths over the **same entities**. Each path uses a different relationship type (linear, spatial, or syllogistic), and you can configure both the number of paths and the length of each path.

**Example 2-path question (default 3 entities):**

- **Entity Graph:** A, B, C
- **Path 1 (Linear):** "A is larger than B", "B is larger than C"
- **Path 2 (Spatial):** "A is north of B", "B is north of C"
- **Conclusion:** "A is larger than C?" (from Path 1)

**Example syllogistic question:**

- **Premises:** "FOBIX are a type of GAKUN", "GAKUN are never JEPOL"
- **Conclusion:** "FOBIX are never JEPOL?" → True ✓ (Celarent)

**Example long-path question (5 entities):**

- **Entity Graph:** A, B, C, D, E
- **Path 1 (Linear):** "A < B", "B < C", "C < D", "D < E"
- **Conclusion:** "A is less than E?"

**Try it in the browser console:**

```javascript
// Generate a 2-path question (4 premises over 3 entities)
window.tanmateix.test2Path();

// Generate a syllogistic question
window.tanmateix.testSyllogistic();

// Generate a long path (4 premises over 5 entities in one path)
window.tanmateix.testLongPath(5);

// Combine both: 2 paths with 4 entities each = 6 premises total
window.tanmateix.numPaths = 2;
window.tanmateix.entitiesPerPath = 4;
window.tanmateix.newQuestion();
```

Configuration options:

- `numPaths` - Number of different relationship paths (default: 1)
- `entitiesPerPath` - Number of entities in each path (default: 3)
- Total premises = `numPaths × (entitiesPerPath - 1)`

Examples:

- 1 path, 3 entities = 2 premises
- 2 paths, 3 entities = 4 premises
- 1 path, 5 entities = 4 premises
- 2 paths, 4 entities = 6 premises
- 3 paths, 4 entities = 9 premises

## Third-Party Libraries

This project uses [Tau Prolog](https://tau-prolog.org/) for logical inference and contradiction detection in Linear and Categorical relation types. Tau Prolog is licensed under the BSD 3-Clause License. See [lib/TAU-PROLOG-LICENSE](lib/TAU-PROLOG-LICENSE) for the full license text.

## Architecture

A modular architecture for generating logic questions with composable premise types.

### Logical Inference

Linear relation types use **Tau Prolog** for:

- Transitive inference (e.g., A>B, B>C ⇒ A>C)
- Contradiction detection (e.g., rejecting A>B>C>A cycles)
- Declarative logic rules instead of manual implementation

Spatial relations use custom vector arithmetic for 2D/3D positioning.

Syllogistic relations use pure JavaScript for:

- Subset transitive closure (Barbara: A⊂B, B⊂C → A⊂C)
- Disjoint expansion (Celarent: A⊂B, B∩C=∅ → A∩C=∅)

### Verification System

Spatial questions are automatically verified using Tau Prolog to ensure logical consistency:

- Questions are generated using fast vector arithmetic
- Each generated question is verified using Prolog rules
- If verification fails, a new question is generated (with retry limit)
- This provides automatic quality assurance for all spatial reasoning questions

See [verification/README.md](verification/README.md) for technical details.

## File Structure

```
├── core/
│   ├── Entity.js           - Immutable logical objects
│   ├── Relation.js         - Typed relationships
│   ├── RelationType.js     - Abstract domain logic
│   ├── PremiseNetwork.js   - Graph structure
│   ├── Path.js             - Path utilities
│   └── index.js

├── relations/
│   ├── LinearRelationType.js       - Ordered comparisons
│   ├── SpatialRelationType.js      - Directional relationships
│   ├── CategoricalRelationType.js  - Same/different (disabled)
│   ├── SyllogisticRelationType.js  - Subset/disjoint (Barbara & Celarent)
│   └── index.js

├── utils/
│   ├── RandomUtils.js      - Random number generation
│   ├── EntityFactory.js    - Entity creation
│   ├── SpatialGrid.js      - Spatial grid utilities
│   └── index.js

├── models/
│   ├── Question.js         - Question structure
│   ├── MultiQuestion.js    - Multi-question structure
│   └── index.js

├── generators/
│   ├── PremiseNetworkGenerator.js     - Network generation
│   ├── ConclusionGenerator.js         - Conclusion generation
│   ├── QuestionGenerator.js           - Main orchestrator
│   ├── PathBasedQuestionGenerator.js  - Path-based questions
│   └── index.js

├── render/
│   ├── Renderer.js         - Question rendering
│   ├── Vocabulary.js       - Vocabulary management
│   └── index.js

├── verification/
│   ├── SpatialVerifier.js  - Prolog-based spatial verification
│   └── README.md           - Verification documentation

├── tests/
│   ├── test-basic.js       - Basic tests
│   └── test-full.js        - Full integration tests

├── lib/
│   └── tau-prolog-core.js  - Tau Prolog library

├── fonts/
│   └── phosphor/           - Phosphor icon font

├── index.html              - Main game UI
├── index.js                - Main exports
├── manifest.json           - PWA manifest
└── README.md               - This file
```
