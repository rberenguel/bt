import { RelationType } from "../core/RelationType.js";
import { Relation } from "../core/Relation.js";

/**
 * SpatialRelationType handles directional/positional relationships in N-dimensional space.
 * Contains only logic - vocabulary for directions is handled at rendering time.
 *
 * Properties:
 * - vector: Array of normalized coordinates [-1, 0, or 1] in each dimension
 *   - 2D: [x, y] e.g., [1, 0] = east, [0, 1] = north
 *   - 3D: [x, y, z] e.g., [0, 0, 1] = above
 *   - 4D: [x, y, z, t] e.g., [1, 0, 0, -1] = east in past
 */
export class SpatialRelationType extends RelationType {
  /**
   * @param {number} dimensions - Number of dimensions (2, 3, or 4)
   */
  constructor(dimensions = 2) {
    super("Spatial");
    this.dimensions = dimensions;
  }

  /**
   * Create a spatial relation
   * @param {Entity[]} entities - [from, to]
   * @param {Object} properties - { vector: number[] }
   */
  createRelation(entities, properties) {
    return new Relation(this, entities, properties);
  }

  /**
   * Validate relation
   * Now accepts raw (unnormalized) vectors for correct transitive inference
   */
  validate(relation) {
    return (
      relation.entities.length === 2 &&
      Array.isArray(relation.properties.vector) &&
      relation.properties.vector.length === this.dimensions &&
      relation.properties.vector.every((v) => Number.isInteger(v))
    );
  }

  /**
   * Get inverse relation (invert vector and swap entities)
   */
  inverse(relation) {
    const invertedVector = relation.properties.vector.map((v) => -v);
    return new Relation(this, [relation.entities[1], relation.entities[0]], {
      vector: invertedVector,
      vocabStyle: relation.properties.vocabStyle, // Preserve vocabulary style
    });
  }

  /**
   * Check contradiction
   * Same entities with different vectors = contradiction
   * Only applies within the same relation type
   */
  contradicts(rel1, rel2) {
    // Different relation types don't contradict - they're different aspects
    if (rel1.type.name !== rel2.type.name) {
      return false;
    }

    // Same type: check if same entities have different vectors
    if (this.sameEntities(rel1, rel2)) {
      // Safety check: both must have vectors
      if (!rel1.properties.vector || !rel2.properties.vector) {
        return false;
      }
      return !this.vectorsEqual(rel1.properties.vector, rel2.properties.vector);
    }
    return false;
  }

  /**
   * Infer relations through vector addition
   * A ->[1,0] B, B ->[0,1] C => A ->[1,1] C
   */
  infer(relations) {
    const inferred = [];

    for (let i = 0; i < relations.length; i++) {
      for (let j = 0; j < relations.length; j++) {
        if (i === j) continue;

        const r1 = relations[i];
        const r2 = relations[j];

        // Check if chainable (r1.end === r2.start)
        if (r1.entities[1].id === r2.entities[0].id) {
          const sumVector = r1.properties.vector.map(
            (v, idx) => v + r2.properties.vector[idx],
          );

          // Normalize the result
          const normalized = this.normalize(sumVector);

          inferred.push(
            this.createRelation([r1.entities[0], r2.entities[1]], {
              vector: normalized,
              vocabStyle: r1.properties.vocabStyle, // Preserve vocabulary style from first relation
            }),
          );
        }
      }
    }

    return inferred;
  }

  /**
   * Normalize vector to -1, 0, or 1 in each dimension
   */
  normalize(vector) {
    return vector.map((v) => {
      if (v === 0) return 0;
      return v / Math.abs(v);
    });
  }

  /**
   * Check if two vectors are equal
   */
  vectorsEqual(v1, v2) {
    return v1.every((val, idx) => val === v2[idx]);
  }

  /**
   * Check if two relations have same entities (in any order)
   */
  sameEntities(rel1, rel2) {
    return (
      (rel1.entities[0].id === rel2.entities[0].id &&
        rel1.entities[1].id === rel2.entities[1].id) ||
      (rel1.entities[0].id === rel2.entities[1].id &&
        rel1.entities[1].id === rel2.entities[0].id)
    );
  }
}
