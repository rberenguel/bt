# Safata — Next

## [DONE] Anti-cycling: prevent cherry-picking a small subset of tiles

### Problem

A player can defeat the point of the game by cycling between only 2 (or few) tiles they
have already memorised. If tiles A and B are both red (rule hidden) and the player keeps
alternating A → B → A → B, they only ever need to hold 2 rules in memory — regardless of
how many other active tiles exist. The session still ends after 10 red completions, but the
cognitive load never scales beyond 2. The "parallel context maintenance" construct is not
being trained at breadth.

The "no immediate re-light" rule (justProcessed guard + pendingRelight) prevents trivially
looping on a single tile, but does nothing against a 2-tile cycle.

### Fix ideas

**Option A — minimum distinct tiles before re-light**
Track a `recentlyVisited` ring buffer (e.g. last N tile IDs). A tile may only re-light
(pendingRelight fires) if it is not in the last K visits. K = 2 means the player must visit
2 other contexts before a tile can re-appear. This directly raises the minimum working set.
K could scale with N_ACTIVE_TILES (e.g. K = N_ACTIVE_TILES - 1).

**Option B — forced rotation**
Instead of probabilistic re-lighting, use a round-robin queue. Each tile that gains a red
visit goes into a FIFO. A tile may only re-light once all OTHER active red tiles ahead of it
in the queue have been visited at least once. Deterministic, but heavier to implement.

**Option C — per-tile cooldown count**
After completing tile T, set `T.cooldown = K` (e.g. K = 2). Each time any other tile is
completed, decrement all non-zero cooldowns. T can only re-light (pendingRelight eligible)
once `T.cooldown === 0`. Simple integer, no ring buffer needed. K can be a constant or
scale with the number of red tiles currently in the session.

**Recommendation**
Option C is the simplest and maps cleanly onto the existing pendingRelight mechanism:
change the pendingRelight check from `Math.random() < P_REWORK` to
`tile.cooldown === 0 && Math.random() < P_REWORK`, and decrement cooldowns in runTurnUpdate.
Start with K = 2. This guarantees the player must visit at least 2 other contexts before
any given tile can come back, raising the effective working set to 3 at minimum.
