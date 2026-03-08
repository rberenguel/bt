// All 8 unit directions: [dx, dy]
const UNIT_DIRECTIONS = [
  [-1, 1], [0, 1], [1, 1],
  [-1, 0],         [1, 0],
  [-1,-1], [0,-1], [1,-1],
];

/**
 * SpatialGrid - tracks entity positions in 2D space.
 *
 * For path-based questions, entities are placed via a unit-step walk:
 * each consecutive pair is exactly 1 step apart in any of 8 directions.
 * This makes every direction clue ("northeast of") unambiguous regardless
 * of how many steps apart entities are.
 */
export class SpatialGrid {
  constructor() {
    this.entityPositions = new Map(); // entity.id -> [x, y]
    this.entityObjects = new Map();   // entity.id -> entity (for toString)
  }

  /**
   * Place entities using a unit-step walk.
   * Each consecutive pair is exactly 1 step apart (any of 8 directions).
   * The reverse of the previous step is excluded to avoid trivial cancellation.
   */
  placeEntitiesAsWalk(entities) {
    let x = 0, y = 0;
    this.entityPositions.set(entities[0].id, [x, y]);
    this.entityObjects.set(entities[0].id, entities[0]);

    let prevDir = null;

    for (let i = 1; i < entities.length; i++) {
      const available = prevDir
        ? UNIT_DIRECTIONS.filter(([dx, dy]) => !(dx === -prevDir[0] && dy === -prevDir[1]))
        : UNIT_DIRECTIONS;

      const [dx, dy] = available[Math.floor(Math.random() * available.length)];
      x += dx;
      y += dy;
      prevDir = [dx, dy];
      this.entityPositions.set(entities[i].id, [x, y]);
      this.entityObjects.set(entities[i].id, entities[i]);
    }
  }

  /**
   * Place entities randomly on a 3x3 grid (legacy, used by generateSpatialGraphQuestion)
   */
  placeEntitiesRandomly(entities) {
    if (entities.length > 9) {
      throw new Error("Cannot place more than 9 entities on 3x3 grid");
    }

    const grid = Array(3).fill(null).map(() => Array(3).fill(null));

    // Place first entity in center
    grid[1][1] = entities[0];
    this.entityPositions.set(entities[0].id, [1, 1]);
    this.entityObjects.set(entities[0].id, entities[0]);

    const availablePositions = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (x === 1 && y === 1) continue;
        availablePositions.push([x, y]);
      }
    }
    this.shuffleArray(availablePositions);

    for (let i = 1; i < entities.length; i++) {
      const [x, y] = availablePositions.pop();
      grid[y][x] = entities[i];
      this.entityPositions.set(entities[i].id, [x, y]);
      this.entityObjects.set(entities[i].id, entities[i]);
    }
  }

  /**
   * Get the spatial vector from one entity to another
   * Returns RAW vector (not normalized) to preserve magnitude for inference
   */
  getVector(fromEntity, toEntity) {
    const fromPos = this.entityPositions.get(fromEntity.id);
    const toPos = this.entityPositions.get(toEntity.id);

    if (!fromPos || !toPos) {
      throw new Error("Entity not found in grid");
    }

    // Calculate raw vector (difference in positions)
    // DON'T normalize here - we need magnitude for correct transitive inference
    const rawVector = [
      toPos[0] - fromPos[0], // x difference
      toPos[1] - fromPos[1], // y difference
    ];

    return rawVector;
  }

  /**
   * Get the position of an entity
   */
  getPosition(entity) {
    return this.entityPositions.get(entity.id);
  }

  /**
   * Normalize a vector to [-1, 0, 1] in each dimension
   */
  normalize(vector) {
    return vector.map((v) => {
      if (v === 0) return 0;
      return v / Math.abs(v);
    });
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Get a visual representation of the entity positions (for debugging)
   */
  toString() {
    if (this.entityPositions.size === 0) return "Empty grid\n";

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const posToLabel = new Map();

    for (const [id, [x, y]] of this.entityPositions.entries()) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const entity = this.entityObjects.get(id);
      posToLabel.set(`${x},${y}`, entity ? entity.displayValue.substring(0, 5) : id.substring(0, 5));
    }

    let result = "Grid (y increases upward):\n";
    for (let y = maxY; y >= minY; y--) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        const label = posToLabel.get(`${x},${y}`);
        row.push(label ? label.padEnd(5) : "  .  ");
      }
      result += row.join(" ") + "\n";
    }
    return result;
  }

  /**
   * Get debug info about entity positions
   */
  getDebugInfo() {
    const info = {};
    for (const [entityId, position] of this.entityPositions.entries()) {
      info[entityId] = position;
    }
    return info;
  }
}
