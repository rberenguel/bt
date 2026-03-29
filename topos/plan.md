# topos — Topological Working Memory Training

## Core Objective

Train the specific working memory and inference pathways required for an SRE-SWE managing complex distributed systems and parallel coding agents.

Unlike linear memory training (e.g., the Major System), `topos` focuses on **structural graph retention** and **mental traversal**. It trains the ability to hold a complex system state, switch contexts, and accurately query that mental model for blast radius, reachability, and single points of failure.

## The Cognitive Loop (Target < 5 mins)

1. **Ingest:** Memorize 3 distinct abstract directed graphs (representing microservice clusters/agent states) sequentially.
2. **Context Switch (Flush):** Perform a high-load distractor task to clear the phonological loop and force reliance on structural memory.
3. **Interrogate:** Answer rapid-fire, abstract inference questions (True/False) about the graphs from memory.

---

## Iteration Roadmap

### Phase 1: MVP Validation (Current)

- [x] Implement zero-dependency vanilla JS/HTML/CSS prototype.
- [x] Generate abstract Directed Acyclic Graphs (DAGs) using Layered layouts.
- [x] Implement basic graph theory interrogation (Reachability, Sinks).
- [ ] **Action:** Playtest on mobile. Validate if the cognitive load feels aligned with SRE/architecture mental modeling.

### Phase 2: `bt` Monorepo Integration

- [ ] **UI Harmony:** Hook up `shared/fonts`, `shared/haptic.js`, and `shared/fire.js` for feedback.
- [ ] **Storage:** Integrate `shared/storage.js` and `shared/history.js` to log session scores and chart progress.
- [ ] **Offline PWA:** Add `topos` assets to the root `sw.js` cache manifest via `get_cache.go`.

### Phase 3: The "Context Switch" Implementation

- [ ] Import the logic from `summum` (arithmetic) or `clauer` (SDMT).
- [ ] Inject a mandatory 30–60 second distractor session between the Ingest phase and the Interrogation phase to prevent rote rehearsal.

### Phase 4: Dynamic Difficulty Scaling (Progressive Overload)

Dynamically adjust parameters based on player streak and historical accuracy:

- **Level 1-3 (Junior):** 5-6 nodes, strict DAGs, high density of forward edges, 15s ingest per graph.
- **Level 4-6 (Mid):** 7-9 nodes, sparser edges (harder to chunk), introduce multi-component graphs (isolated clusters).
- **Level 7-9 (Senior):** 10+ nodes, shorter ingest time (10s), introduce _bidirectional edges_ and _cycles_ (simulating data syncs / deadlocks).
- **Level 10 (Staff+):** Introduce "State Mutations" (e.g., "Assume the Green Circle goes down. Now, answer this question...").

### Phase 5: Advanced Query Generation

Expand the interrogation engine to test specific SRE mental models:

- **Blast Radius:** "If X is removed, does Y lose all inputs?" (Articulation Points)
- **Bottlenecks:** "Is Z the only bridge between the top half and bottom half?" (Cut Sets)
- **Shared Dependencies:** "Do A and B share a common downstream sink?" (Common Ancestor/Descendant)
- **False Injections:** Ask questions about node colors/shapes that didn't actually exist in that specific graph to test memory precision.

---

## Telemetry & Metrics to Track

- **Structural Accuracy:** Overall % correct.
- **Latency:** Time taken to mentally traverse the graph and answer the question.
- **Error Typology:** Track _what_ gets forgotten. Do we hallucinate paths that don't exist, or forget paths that do? Do we mix up the Alpha network with the Gamma network?
