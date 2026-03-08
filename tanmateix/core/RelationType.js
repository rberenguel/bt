/**
 * RelationType is an abstract class defining the behavior of a specific relation domain.
 * Subclasses implement domain-specific logic (validation, inference, contradiction).
 *
 * NOTE: RelationType contains ONLY logical behavior, no vocabulary/text.
 * Vocabulary is a rendering concern handled separately.
 */
export class RelationType {
  /**
   * @param {string} name - Name of this relation type
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Create a relation of this type
   * @param {Entity[]} entities - Array of entities involved in the relation
   * @param {Object} properties - Type-specific properties
   * @returns {Relation}
   */
  createRelation(entities, properties) {
    throw new Error("Must implement createRelation");
  }

  /**
   * Validate if a relation is logically consistent
   * @param {Relation} relation
   * @returns {boolean}
   */
  validate(relation) {
    throw new Error("Must implement validate");
  }

  /**
   * Get the inverse relation (e.g., "A > B" becomes "B < A")
   * @param {Relation} relation
   * @returns {Relation}
   */
  inverse(relation) {
    throw new Error("Must implement inverse");
  }

  /**
   * Check if two relations contradict each other
   * @param {Relation} relation1
   * @param {Relation} relation2
   * @returns {boolean}
   */
  contradicts(relation1, relation2) {
    throw new Error("Must implement contradicts");
  }

  /**
   * Infer new relations from existing ones
   * @param {Relation[]} relations
   * @returns {Relation[]} Array of inferred relations
   */
  infer(relations) {
    // Default: no inference
    return [];
  }
}
