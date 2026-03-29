# Llei — Plan

**Concept:** You are the lawmaker. Given a set of labeled examples (valid/invalid entities), write the rule that cleanly separates them with the fewest possible words.

The inverse of Precís (which gives you the rule and asks you to evaluate). The inverse of Exploit (which gives you the rule and asks you to break it). Llei gives you the reality and asks you to legislate.

Direct analogy: writing a system prompt for an LLM. You have examples of outputs that should pass and outputs that should not. Your job is to write the constraint that covers them all — precisely, without loopholes, without bloat.

---

## Generation (Murder It Wrote approach)

Do NOT start from the UI and work backwards. Start from the truth.

### Step 1: Generate the universe

- Pick a rule AST using the same generator as Precís (`genAST`)
- This is the hidden ground truth — the player never sees it
- Generate N entities (e.g. 20–30) by random payload generation
- Evaluate each against the rule: label them VALID or INVALID

### Step 2: Find the cleanest separator

The generated rule IS the separator. But not all rules make for good puzzles.
Use **Gini impurity** (or information gain) to score each candidate rule:

- A rule that classifies 15 VALID and 15 INVALID out of 30 is maximally interesting
- A rule that classifies 29 VALID and 1 INVALID is degenerate — trivially gamed
- Target: roughly balanced split, no single attribute that trivially dominates

Reject and regenerate until a rule scores above a Gini threshold (e.g. impurity > 0.35 on the generated population).

### Step 3: Prune to minimal examples (essentiality loop)

Analogous to Murder It Wrote's clue pruning:

```
for each example in the set (reverse order):
  remove it temporarily
  check: does the remaining set still uniquely constrain the correct rule?
  (i.e. is there no simpler wrong rule that also fits?)
  if yes → discard it (redundant)
  if no → keep it (essential)
```

"Uniquely constrains" means: no alternative rule of equal or lower complexity fits all remaining examples. This requires enumerating candidate rules — feasible because the grammar is small (2–4 boolean conditions over 5 attributes).

Target: 4–6 examples total (3 valid, 2–3 invalid or similar), each essential.

### Step 4: Present

Show the minimal example set. Player writes the rule.

---

## The Rule-Writing UI

No snap-together builder needed. Two viable approaches:

**A) Pseudocode input (preferred)**
Player types something like:

```
approved AND NOT flagged, UNLESS urgent
```

The app parses this using the same grammar as Precís's `renderAST` output. Evaluate the player's rule against all examples. Score = correct classifications / total.

Parser grammar is small — only AND, OR, NOT, UNLESS, attribute names, parentheses. A recursive descent parser over a fixed vocabulary of ~10 terms is ~50 lines.

**B) Condition selector**
Player builds a rule by selecting from a list of atomic conditions (checkboxes or toggles): `approved`, `NOT approved`, `flagged`, etc., then connecting them with AND/OR/UNLESS buttons. Less expressive than text but touch-friendly and zero parsing complexity.

Recommendation: **start with B** (selector), ship it, then optionally add A as an advanced mode. The cognitive training is the same; the interface is secondary.

---

## Scoring

Primary score: **brevity × correctness**

- 1 point per correctly classified example
- Penalty for each extra token/condition beyond the minimum required
- Perfect score = correct on all examples using the fewest conditions possible
- "Bloated correct" (hard-codes every case individually) scores lower than "elegant correct"

Track per session:

- Classification accuracy (% examples correctly separated)
- Rule complexity (condition count vs. minimum possible)
- "Elegance delta" (how far from the optimal rule in token count)

---

## UI sketch

```
┌─────────────────────────────────┐
│ Llei              7    3/10     │
├─────────────────────────────────┤
│ VALID                INVALID    │
│ ┌──────────────┐ ┌────────────┐ │
│ │ approved     │ │ flagged    │ │
│ │ active       │ │ approved   │ │
│ │ non-urgent   │ │ urgent     │ │
│ └──────────────┘ └────────────┘ │
│ ┌──────────────┐ ┌────────────┐ │
│ │ approved     │ │ inactive   │ │
│ │ premium      │ │ standard   │ │
│ │ flagged      │ │ non-urgent │ │
│ └──────────────┘ └────────────┘ │
│ ┌──────────────┐                │
│ │ active       │                │
│ │ standard     │                │
│ │ urgent       │                │
│ └──────────────┘                │
├─────────────────────────────────┤
│ write the rule:                 │
│ ┌─────────────────────────────┐ │
│ │ approved AND NOT flagged    │ │
│ └─────────────────────────────┘ │
│ [      CHECK       ]            │
└─────────────────────────────────┘
```

After CHECK: show which examples pass/fail under the player's rule. Player can revise and resubmit. Timer runs. Score penalizes revisions.

---

## Key implementation notes (from Precís session)

### Reuse from Precís

- `genAST(level, allowNegation)` — identical
- `evalAST(node, payload)` — identical
- `renderAST(node)` — identical (for displaying the reveal at end)
- `collectAttrs(node)` — identical
- `ATTRS` domain (5 attributes: active, approved, flagged, premium, urgent)
- `makeStorage` / `makeHistoryUI` / `FireSystem` / haptics — all shared infrastructure

### Parser for pseudocode input (if going with option A)

Write a simple recursive descent parser over the fixed token set:

```
rule     → unless
unless   → or ("UNLESS" or)?
or       → and ("OR" and)*
and      → not ("AND" not)*
not      → "NOT" atom | atom
atom     → "(" rule ")" | ATTR_NAME
```

ATTR_NAME is any of the ~10 known positive forms (`approved`, `flagged`, etc.) or negative forms (`unapproved`, `unflagged`, etc. → desugared to `NOT approved`).
This is ~60 lines of JS, fully deterministic.

### Gini calculation

```js
function gini(rule, population) {
  const results = population.map((p) => evalAST(rule, p));
  const trueCount = results.filter(Boolean).length;
  const n = population.length;
  const p = trueCount / n;
  return 1 - (p * p + (1 - p) * (1 - p)); // 0 = degenerate, 0.5 = perfect split
}
```

Reject rules with gini < 0.3. Regenerate until gini > 0.35.

### Essentiality check

For each example, removing it and checking if the correct rule is still uniquely constrained requires enumerating alternatives. Simplification: instead of full enumeration, check if any _single-condition simplification_ of the correct rule still fits all remaining examples. If yes, the example was essential to rule out that simpler wrong rule.

### Things that burned time in Precís — avoid here

- **Option B render bug**: when showing two parse trees, make sure each tree uses its own inner group and outer operator. Don't copy the same args for both options.
- **Color as hint**: all entity chips should be visually neutral (same style regardless of true/false). State is in the text label, not the color.
- **Level gate on phase mixing**: don't gate any phase type behind a minimum level. Players can get stuck on level 1 and never see the more interesting phases.
- **Hub back-link**: every app needs a back-to-hub link in the header AND a "Back to hub" button in the results modal. The header app-name link covers mid-session; the modal button covers end-of-session. Both are required.
- **Timer calibration**: compare against Tanmateix tiers. Tanmateix L1 simplest question = 12s. Start generous (14s at L1) and scale. Phase types that require more reading get a bonus.
- **Haptics**: `initHaptic()` must be called at page load. First user interaction triggers it. Every tap that advances the game state calls `triggerHaptic()`. Wrong answers call `triggerHapticError()`.

---

## Open questions before building

1. **Condition selector vs. pseudocode input** — decide before starting UI. Selector is faster to ship; pseudocode is more powerful training. Could start with selector and add text input later.
2. **How many examples per puzzle?** — 5 (3+2) feels right for mobile. 6 (3+3) is the natural split but might crowd the screen.
3. **Reveal at end** — show the ground-truth rule? Or just show which examples passed/failed? Showing the rule closes the learning loop but removes the mystery for replay.
4. **Session length** — 10 puzzles (shorter than Precís's 15) because each puzzle takes longer. Revisit after first playtest.
5. **Catalan name confirmed**: Llei (law). Fits the battery: Tanmateix, Mussol, Regles, Precís, Llei.
