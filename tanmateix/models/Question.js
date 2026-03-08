/**
 * Question represents a single logic question with premises and a conclusion.
 */
export class Question {
  /**
   * @param {Object} data
   * @param {PremiseNetwork} data.network - The underlying network
   * @param {Relation[]} data.premises - Premises to show
   * @param {Relation} data.conclusion - The conclusion to evaluate
   * @param {boolean} data.isValid - Whether the conclusion is valid
   * @param {Object} data.metadata - Additional metadata
   */
  constructor(data) {
    this.network = data.network;
    this.premises = data.premises;
    this.conclusion = data.conclusion;
    this.isValid = data.isValid;
    this.isIndeterminate = data.isIndeterminate || false;
    this.metadata = data.metadata || {};
    this.timestamp = Date.now();
  }

  /**
   * Get premises (optionally scrambled)
   * @param {Object} options
   * @param {boolean} options.scramble - Whether to scramble
   * @returns {Relation[]}
   */
  getPremises(options = {}) {
    const { scramble = false } = options;

    if (!scramble) {
      return [...this.premises];
    }

    // TODO: Implement scrambling logic from v1
    return [...this.premises];
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      premises: this.premises.map((p) => this.serializeRelation(p)),
      conclusion: this.serializeRelation(this.conclusion),
      isValid: this.isValid,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }

  /**
   * Serialize a single relation
   */
  serializeRelation(relation) {
    return {
      type: relation.type.name,
      entities: relation.entities.map((e) => ({
        id: e.id,
        displayValue: e.displayValue,
      })),
      properties: relation.properties,
    };
  }
}
