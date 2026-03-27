# Flux — Design Plan

## Concept

Rapid stream classification with dormant intentions. The player maintains a fast tap-based classification task while holding 1–3 PM rules in mind. Targets matching those rules require the **center zone** instead of left or right. Trains the ability to sustain a dormant intention across absorbing ongoing activity — the gap between "I need to do X when Y happens" and actually doing it.

---

## Stimuli

A fixed set of **8 Phosphor icons**, split into two categories of four. The set is identical every session so recognition becomes automatic within a few sessions, keeping decoding cost low.

**Category A — Natural:** `ph-leaf`, `ph-cloud`, `ph-drop`, `ph-moon`

**Category B — Crafted:** `ph-gear`, `ph-wrench`, `ph-house`, `ph-lightning`

Each icon is rendered in one of **three colors**: neutral (white/dim), amber, or cyan. Color is chosen independently of category and is irrelevant to the ongoing classification task — making it a clean non-focal property for PM rules.

---

## Input: Touch Zones

The bottom 25% of the screen is divided into three fixed tap zones, always visible. No gestures, no swipe detection. The intro modal explains the zone mapping once; no labels needed during play.

```
┌──────────────────────────────────┐
│                                  │
│         stimulus area            │
│                                  │
├─────────┬────────────┬───────────┤  ← 75% mark
│  LEFT   │   CENTER   │   RIGHT   │
│  (25%)  │   (50%)    │   (25%)   │
└─────────┴────────────┴───────────┘
```

| Zone | Meaning |
|---|---|
| Left | Category A (natural) |
| Center | PM response — fire the dormant intention |
| Right | Category B (crafted) |

Center is wider to give the PM tap a generous target without increasing false alarm risk from near-misses on the side zones.

---

## Timing & Deadline

The baseline block establishes the player's personal mean RT and standard deviation. Each subsequent trial has a deadline of **baseline mean + k·σ**, where k starts larger and tightens as the player is correct (TBD; similar to stop's SSD adaptation). If the player does not respond before the deadline, the trial is marked as a **miss** (wrong) and the next stimulus appears automatically — same behaviour as Stop.

The stimulus is shown with a thin progress bar (like dotmatrix) counting down to the deadline. This keeps time pressure visible without requiring the player to count mentally.

---

## Progress: Brain Battery

Session progress is shown via the shared brain battery icon, filled proportionally to trials completed vs total trials (baseline + PM block combined). Same mechanic as summum — it reflects how far through the session you are, not score. Fire particles appear in the upper fill range.

---

## Session Structure

### 1. Intro modal (first session, or via info button)
Explains zones, icon categories, and the PM mechanic. Tapping play dismisses it and starts the session.

### 2. Baseline block
~10 trials, no intentions loaded. Left/right zones only — center does nothing. Computes personal mean RT and σ, which set the deadline for the PM block.

### 3. Intention screen
Player is shown 1–3 rules to memorize. Rules are hidden during the block. A confirmation tap per rule is required before the block starts, forcing at least one deliberate pass over each intention. Examples:

- *"If you see the gear, tap center."* (focal)
- *"If anything is amber, tap center."* (non-focal)
- Both simultaneously (dual)

### 4. PM block
~30 trials. 85% standard stimuli (left/right), 15% PM targets (~4–5 targets). Targets distributed evenly — never clustered. Deadline active throughout.

### 5. Results modal
Metrics for the block. Hub link. Option to play again.

---

## PM Rule Types

**Focal targets** — trigger is a property already processed for classification.
- Specific icon identity: *"tap center if you see the wrench"*

**Non-focal targets** — trigger is orthogonal to classification.
- Color: *"tap center if anything is amber"*
- Compound: *"tap center if you see a cyan cloud"* (both properties must match)

Focal targets are easier because monitoring piggybacks on ongoing processing. Non-focal targets require active background vigilance — the harder and more ecologically valid condition.

---

## Difficulty Progression

| Level | Intentions | Target type | Target frequency |
|---|---|---|---|
| 1 | 1 | Focal | 15% |
| 2 | 1 | Non-focal | 15% |
| 3 | 2 | 1 focal + 1 non-focal | 15% |
| 4 | 2 | Both non-focal | 12% |
| 5 | 3 | Mix | 10% |

Rarer targets are harder: more non-target trials pass between triggers, letting the intention fade from active memory.

---

## Metrics

**PM hit rate** — hits / total targets. Primary skill measure.

**False alarm rate** — center taps on non-targets / total non-targets. Separates genuine monitoring from over-firing. Required to interpret hit rate correctly.

**Miss rate** — deadline-expired trials / total trials. Reflects overall speed compliance.

**RT cost** — mean RT on non-target trials in PM block minus baseline mean RT. The monitoring tax: how much classification speed you give up to stay vigilant.

**d′ (optional)** — sensitivity index from hit rate and false alarm rate. Single quality score, removes response bias.

---

## Storage

Per session:
```
pmHitRate       float  (0–1)
falseAlarmRate  float  (0–1)
missRate        float  (0–1)
rtCost          int    (ms, signed)
level           int    (1–5)
intentions      int    (1–3)
```

Key metric for hub card: PM hit rate.

---

## Open Questions

- **Deadline k and tightening rate**: start at k=2 or k=3 (generous), tighten on correct streaks. Needs playtesting — too tight and the task degrades into pure speed; too loose and there's no pressure.
- **Intention fade on backgrounding**: re-show intentions on resume, or don't — since forgetting under interruption is exactly what the task trains. Probably a setting.
- **False alarm feedback**: brief red flash on the center zone itself (not the stimulus) to avoid disrupting the classification rhythm.
