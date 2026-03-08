/**
 * Entity represents a logical object in the premise network.
 * Entities are immutable once created.
 */
export class Entity {
  /**
   * @param {string} id - Unique identifier
   * @param {string} displayValue - What gets shown to the user (or icon name for icon entities)
   * @param {string|null} iconName - Phosphor icon name (e.g. "acorn"), or null for text entities
   */
  constructor(id, displayValue, iconName = null) {
    this.id = id;
    this.displayValue = displayValue;
    this.iconName = iconName;
    Object.freeze(this);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      displayValue: this.displayValue,
      iconName: this.iconName,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    return new Entity(data.id, data.displayValue, data.iconName ?? null);
  }
}
