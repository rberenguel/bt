/**
 * RandomUtils provides random number generation utilities.
 * Could be extended to support seeded RNG for reproducibility.
 */
export class RandomUtils {
  /**
   * @param {number|null} seed - Optional seed for reproducibility (not implemented yet)
   */
  constructor(seed = null) {
    this.seed = seed;
    // TODO: Implement seeded RNG if needed
  }

  /**
   * Get random number between 0 and 1
   * @returns {number}
   */
  random() {
    return Math.random();
  }

  /**
   * Random boolean (50/50 chance)
   * @returns {boolean}
   */
  coinFlip() {
    return this.random() < 0.5;
  }

  /**
   * Random integer between min and max (inclusive)
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Pick a random element from an array
   * @param {Array} array
   * @returns {*}
   */
  pickRandom(array) {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Pick N random elements from an array (without replacement)
   * @param {Array} array
   * @param {number} n
   * @returns {Array}
   */
  pickRandomN(array, n) {
    if (n > array.length) {
      throw new Error(
        `Cannot pick ${n} items from array of length ${array.length}`,
      );
    }

    const copy = [...array];
    const picked = [];

    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(this.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }

    return picked;
  }

  /**
   * Weighted random selection
   * @param {Array} items
   * @param {number[]} weights
   * @returns {*}
   */
  weightedPick(items, weights) {
    if (items.length !== weights.length) {
      throw new Error("Items and weights arrays must have same length");
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let randomNum = this.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      randomNum -= weights[i];
      if (randomNum <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }

  /**
   * Shuffle an array (returns new array)
   * @param {Array} array
   * @returns {Array}
   */
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate a random normalized vector for spatial relations
   * @param {number} dimensions
   * @returns {number[]} Array of -1, 0, or 1 values
   */
  randomVector(dimensions) {
    const vector = new Array(dimensions).fill(0);
    const nonZeroDim = this.randomInt(0, dimensions - 1);
    vector[nonZeroDim] = this.pickRandom([-1, 1]);
    return vector;
  }

  /**
   * Random chance (1 in N)
   * @param {number} n
   * @returns {boolean}
   */
  oneOutOf(n) {
    return this.random() < 1 / n;
  }
}
