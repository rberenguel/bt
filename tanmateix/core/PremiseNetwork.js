/**
 * PremiseNetwork is a graph structure containing entities and their relations.
 * This is the core data structure that allows mixing different relation types.
 */
export class PremiseNetwork {
  constructor() {
    this.entities = new Map(); // id -> Entity
    this.relations = []; // Array of Relation instances
    this.adjacency = new Map(); // id -> Set of related entity ids
  }

  /**
   * Add an entity to the network
   * @param {Entity} entity
   */
  addEntity(entity) {
    this.entities.set(entity.id, entity);
    if (!this.adjacency.has(entity.id)) {
      this.adjacency.set(entity.id, new Set());
    }
  }

  /**
   * Add a relation to the network
   * @param {Relation} relation
   * @throws {Error} If relation is invalid or contradicts existing relations
   */
  addRelation(relation) {
    // Validate before adding
    if (!relation.validate()) {
      throw new Error("Invalid relation");
    }

    // Check for contradictions
    for (const existing of this.relations) {
      if (relation.contradicts(existing)) {
        throw new Error("Relation contradicts existing relation");
      }
    }

    this.relations.push(relation);

    // Update adjacency
    for (let i = 0; i < relation.entities.length - 1; i++) {
      const from = relation.entities[i].id;
      const to = relation.entities[i + 1].id;
      this.adjacency.get(from).add(to);
      this.adjacency.get(to).add(from);
    }
  }

  /**
   * Get all relations involving an entity
   * @param {string} entityId
   * @returns {Relation[]}
   */
  getRelationsFor(entityId) {
    return this.relations.filter((rel) =>
      rel.entities.some((e) => e.id === entityId),
    );
  }

  /**
   * Get all relations of a specific type
   * @param {RelationType} relationType
   * @returns {Relation[]}
   */
  getRelationsByType(relationType) {
    return this.relations.filter((rel) => rel.type === relationType);
  }

  /**
   * Get relation between two entities (any type)
   * @param {string} entityId1
   * @param {string} entityId2
   * @returns {Relation|null}
   */
  getRelationBetween(entityId1, entityId2) {
    return (
      this.relations.find(
        (rel) =>
          rel.entities.some((e) => e.id === entityId1) &&
          rel.entities.some((e) => e.id === entityId2),
      ) || null
    );
  }

  /**
   * Get relation between two entities of specific type
   * @param {string} entityId1
   * @param {string} entityId2
   * @param {RelationType} relationType
   * @returns {Relation|null}
   */
  getRelationBetweenOfType(entityId1, entityId2, relationType) {
    return (
      this.relations.find(
        (rel) =>
          rel.type === relationType &&
          rel.entities.some((e) => e.id === entityId1) &&
          rel.entities.some((e) => e.id === entityId2),
      ) || null
    );
  }

  /**
   * Find path between two entities using BFS
   * @param {string} fromId
   * @param {string} toId
   * @returns {string[]|null} Array of entity IDs forming the path, or null if no path
   */
  findPath(fromId, toId) {
    const visited = new Set();
    const queue = [[fromId]];

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === toId) {
        return path;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const neighbors = this.adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push([...path, neighbor]);
          }
        }
      }
    }

    return null;
  }

  /**
   * Get relations along a path
   * @param {string[]} path - Array of entity IDs
   * @returns {Relation[]}
   */
  getRelationsAlongPath(path) {
    const relations = [];
    for (let i = 0; i < path.length - 1; i++) {
      const rel = this.getRelationBetween(path[i], path[i + 1]);
      if (rel) {
        relations.push(rel);
      }
    }
    return relations;
  }

  /**
   * Infer new relations using relation type inference rules
   * @returns {Relation[]} Array of inferred relations
   */
  inferRelations() {
    const byType = new Map();

    // Group relations by type
    for (const rel of this.relations) {
      if (!byType.has(rel.type)) {
        byType.set(rel.type, []);
      }
      byType.get(rel.type).push(rel);
    }

    // Run inference for each type
    const inferred = [];
    for (const [type, rels] of byType) {
      const newRels = type.infer(rels);
      for (const newRel of newRels) {
        // Only add if not already present
        const exists = this.relations.some(
          (r) =>
            r.type === newRel.type &&
            r.entities[0].id === newRel.entities[0].id &&
            r.entities[1].id === newRel.entities[1].id,
        );
        if (!exists) {
          inferred.push(newRel);
        }
      }
    }

    return inferred;
  }

  /**
   * Get all entity pairs that are not directly related
   * @returns {Array<[Entity, Entity]>}
   */
  getUnrelatedPairs() {
    const pairs = [];
    const entityIds = Array.from(this.entities.keys());

    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const id1 = entityIds[i];
        const id2 = entityIds[j];

        if (!this.getRelationBetween(id1, id2)) {
          pairs.push([this.entities.get(id1), this.entities.get(id2)]);
        }
      }
    }

    return pairs;
  }

  /**
   * Clone the network
   * @returns {PremiseNetwork}
   */
  clone() {
    const network = new PremiseNetwork();
    for (const entity of this.entities.values()) {
      network.addEntity(entity);
    }
    for (const relation of this.relations) {
      network.addRelation(relation);
    }
    return network;
  }

  /**
   * Get statistics about the network
   * @returns {Object}
   */
  getStats() {
    const typeCount = new Map();
    for (const rel of this.relations) {
      const name = rel.type.name;
      typeCount.set(name, (typeCount.get(name) || 0) + 1);
    }

    return {
      entityCount: this.entities.size,
      relationCount: this.relations.length,
      relationsByType: Object.fromEntries(typeCount),
      averageDegree:
        this.relations.length > 0
          ? (this.relations.length * 2) / this.entities.size
          : 0,
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      entities: Array.from(this.entities.values()).map((e) => e.toJSON()),
      relations: this.relations.map((r) => r.toJSON()),
      stats: this.getStats(),
    };
  }
}
