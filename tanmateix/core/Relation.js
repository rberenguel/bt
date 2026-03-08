/**
 * Relation represents a typed relationship between entities.
 * Relations are immutable once created.
 */
export class Relation {
  /**
   * @param {RelationType} type - The type of this relation
   * @param {Entity[]} entities - Array of entities (usually 2, can be more)
   * @param {Object} properties - Type-specific properties
   */
  constructor(type, entities, properties = {}) {
    this.type = type;
    this.entities = entities;
    this.properties = properties;
    Object.freeze(this.entities);
    Object.freeze(this.properties);
    Object.freeze(this);
  }

  /**
   * Check if this relation is valid/consistent
   * @returns {boolean}
   */
  validate() {
    return this.type.validate(this);
  }

  /**
   * Get the inverse relation
   * @returns {Relation}
   */
  inverse() {
    return this.type.inverse(this);
  }

  /**
   * Check if this relation contradicts another
   * @param {Relation} otherRelation
   * @returns {boolean}
   */
  contradicts(otherRelation) {
    return this.type.contradicts(this, otherRelation);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      type: this.type.name,
      entities: this.entities.map((e) => e.toJSON()),
      properties: this.properties,
    };
  }
}
