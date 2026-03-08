import { Entity } from "../core/Entity.js";

// Curated phosphor icon names — visually distinct, non-directional, recognizable at small sizes
const ICON_POOL = [
  // Nature & sky
  "acorn", "butterfly", "cactus", "campfire", "cloud", "feather",
  "fire", "flower-tulip", "leaf", "lightning", "meteor", "moon",
  "mountains", "rainbow", "snowflake", "star", "sun", "tree-evergreen",
  "wind",
  // Animals
  "bird", "cat", "dog", "fish", "horse", "paw-print", "rabbit", "shrimp",
  // Food & drink
  "avocado", "bread", "cake", "carrot", "cheese", "cherries",
  "coffee", "cooking-pot", "egg-crack", "ice-cream", "orange", "pizza",
  // Tools & objects
  "anchor", "axe", "barbell", "bell", "binoculars", "bomb",
  "book-open", "boot", "brain", "camera", "crown",
  "flashlight", "gear-six",
  "hammer", "hourglass-simple", "jar", "key", "knife",
  "lamp", "lighthouse", "lock-simple", "magnet", "medal",
  "microscope", "paint-brush", "piano-keys",
  "piggy-bank", "puzzle-piece", "rocket", "sailboat",
  "skull", "sword", "target", "tent",
  "thermometer-simple", "treasure-chest", "trophy",
  "umbrella", "watch", "wrench",
  // Fun & misc
  "alien", "balloon", "bicycle", "bowling-ball", "castle-turret",
  "ghost", "graduation-cap", "guitar", "island", "joystick",
  "planet", "potted-plant", "soccer-ball", "sunglasses",
  "windmill", "yin-yang",
];

/**
 * EntityFactory creates unique entities with various display values.
 */
export class EntityFactory {
  /**
   * @param {Object} config
   * @param {boolean} config.useIcons - Use phosphor icons instead of nonsense words
   * @param {boolean} config.useNonsenseWords - Use nonsense word generation (legacy)
   * @param {number} config.nonsenseWordLength
   * @param {RandomUtils} random
   */
  constructor(config = {}, random = null) {
    this.config = {
      useIcons: config.useIcons || false,
      useNonsenseWords: config.useNonsenseWords !== false,
      nonsenseWordLength: config.nonsenseWordLength || 5,
      ...config,
    };
    this.random = random || { random: () => Math.random() };
    this.usedValues = new Set();
    this.counter = 0;
  }

  /**
   * Create N entities
   */
  createEntities(count) {
    const entities = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.createEntity());
    }
    return entities;
  }

  /**
   * Create a single entity
   */
  createEntity() {
    const value = this.generateUniqueValue();
    const id = `entity_${Date.now()}_${this.counter++}_${Math.random().toString(36).substr(2, 9)}`;
    const iconName = this.config.useIcons ? value : null;
    return new Entity(id, value, iconName);
  }

  /**
   * Generate a unique display value
   */
  generateUniqueValue() {
    let value;
    let attempts = 0;

    do {
      value = this.generateValue();
      attempts++;
      if (attempts > 1000) {
        throw new Error(
          "Could not generate unique entity value after 1000 attempts",
        );
      }
    } while (this.usedValues.has(value));

    this.usedValues.add(value);
    return value;
  }

  /**
   * Generate a single value (may not be unique)
   */
  generateValue() {
    if (this.config.useIcons) {
      return ICON_POOL[Math.floor(this.random.random() * ICON_POOL.length)];
    }
    return this.createNonsenseWord();
  }

  /**
   * Create a nonsense word (consonant-vowel pattern)
   */
  createNonsenseWord() {
    const vowels = ["A", "E", "I", "O", "U"];
    const consonants = [
      "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
      "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
    ];
    const bannedWords = [
      "DIC", "DIK", "COC", "COK", "FUC", "FUK", "FEC", "FEK",
      "NIG", "PIS", "TIT", "SEX", "GAY", "FAG", "CUM", "ASS",
      "FUCK", "SHIT", "DAMN", "HELL", "CRAP", "PISS",
    ];

    let word = "";
    const length = this.config.nonsenseWordLength;

    for (let i = 0; i < 100; i++) {
      word = "";
      for (let j = 0; j < length; j++) {
        if (j % 2 === 0) {
          word += consonants[Math.floor(this.random.random() * consonants.length)];
        } else {
          word += vowels[Math.floor(this.random.random() * vowels.length)];
        }
      }
      if (!bannedWords.some((banned) => word.includes(banned))) {
        return word;
      }
    }

    return word;
  }

  /**
   * Reset the factory (clear used values)
   */
  reset() {
    this.usedValues.clear();
    this.counter = 0;
  }
}
