/**
 * MultiQuestion represents multiple questions based on the same premise network.
 */
export class MultiQuestion {
  /**
   * @param {PremiseNetwork} network
   * @param {Question[]} questions
   */
  constructor(network, questions) {
    this.network = network;
    this.questions = questions;
    this.timestamp = Date.now();
  }

  /**
   * Get a specific question
   * @param {number} index
   * @returns {Question}
   */
  getQuestion(index) {
    if (index < 0 || index >= this.questions.length) {
      throw new Error(`Question index ${index} out of bounds`);
    }
    return this.questions[index];
  }

  /**
   * Get all questions
   * @returns {Question[]}
   */
  getAllQuestions() {
    return [...this.questions];
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      questions: this.questions.map((q) => q.toJSON()),
      timestamp: this.timestamp,
    };
  }
}
