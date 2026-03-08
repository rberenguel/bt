import { RelationType } from "../core/RelationType.js";
import { Relation } from "../core/Relation.js";

/**
 * SyllogisticRelationType - Aristotelian syllogism relations
 *
 * Two relation kinds:
 * - subset (A ⊂ B): "All FOBIX are GAKUN"
 * - disjoint (A ∩ B = ∅): "No FOBIX are GAKUN"
 *
 * Valid inference rules:
 *   A ⊂ B, B ⊂ C  →  A ⊂ C   [Barbara]
 *   A ⊂ B, B ∩ C = ∅  →  A ∩ C = ∅   [Celarent]
 */
export class SyllogisticRelationType extends RelationType {
  constructor() {
    super("Syllogistic");
  }

  createRelation(entities, properties) {
    return new Relation(this, entities, properties);
  }

  validate(relation) {
    return (
      relation.entities.length === 2 &&
      ["subset", "disjoint"].includes(relation.properties.relationType) &&
      relation.properties.direction === 1
    );
  }

  /**
   * Inverse: disjoint is symmetric (A∩B=∅ ↔ B∩A=∅).
   * Subset has no meaningful inverse in this game's flow.
   */
  inverse(relation) {
    if (relation.properties.relationType === "subset") {
      throw new Error("subset has no inverse");
    }
    // disjoint is symmetric: swap entities, keep same relationType
    return new Relation(this, [relation.entities[1], relation.entities[0]], {
      ...relation.properties,
    });
  }

  /**
   * subset + disjoint for the same entity pair is a contradiction.
   */
  contradicts(rel1, rel2) {
    if (rel1.type.name !== rel2.type.name) return false;

    const sameEntities =
      (rel1.entities[0].id === rel2.entities[0].id &&
        rel1.entities[1].id === rel2.entities[1].id) ||
      (rel1.entities[0].id === rel2.entities[1].id &&
        rel1.entities[1].id === rel2.entities[0].id);

    if (!sameEntities) return false;

    const types = [rel1.properties.relationType, rel2.properties.relationType];
    return types.includes("subset") && types.includes("disjoint");
  }

  infer(relations) {
    // Inference is handled in Path.getInferredRelation()
    return [];
  }
}
