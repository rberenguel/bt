import { Question } from "../models/Question.js";
import { MultiQuestion } from "../models/MultiQuestion.js";
import { PremiseNetworkGenerator } from "./PremiseNetworkGenerator.js";
import { ConclusionGenerator } from "./ConclusionGenerator.js";

/**
 * QuestionGenerator orchestrates the entire question generation process.
 * This is the main entry point for creating questions.
 */
export class QuestionGenerator {
  /**
   * @param {Object} config
   * @param {EntityFactory} config.entityFactory
   * @param {string[]} config.linearDimensions
   * @param {RandomUtils} config.random
   */
  constructor(config) {
    this.config = config;
    this.random = config.random;
    this.networkGenerator = new PremiseNetworkGenerator(config, this.random);
    this.conclusionGenerator = new ConclusionGenerator(this.random);
  }

  /**
   * Generate a single question
   *
   * @param {Object} spec
   * @param {number} spec.premiseCount - Number of premises
   * @param {Array} spec.relationTypes - [{ type: RelationType, weight: number }]
   * @param {boolean} spec.mixedTypes - Allow mixing relation types
   * @param {number} spec.branchingFactor - Graph branching (0-1)
   * @param {RelationType} spec.conclusionType - Force conclusion type
   * @returns {Question}
   */
  generateQuestion(spec) {
    // For 2-premise questions, retry until we get a valid inferred conclusion
    const maxAttempts = spec.premiseCount === 2 ? 10 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Build relation specs
        const relationSpecs = this.buildRelationSpecs(
          spec.premiseCount,
          spec.relationTypes,
          spec.mixedTypes,
        );

        // Generate network
        const network = this.networkGenerator.generate({
          entityCount: spec.premiseCount + 1,
          relationSpecs,
          branchingFactor: spec.branchingFactor || 0.3,
          allowInference: true,
        });

        // Get only the original premises (not inferred relations)
        // The first spec.premiseCount relations are the original premises
        const originalPremises = network.relations.slice(0, spec.premiseCount);

        // Generate conclusion
        // For 2-premise questions, force inferred-only to avoid trivial questions
        const conclusion = this.conclusionGenerator.generateConclusion(
          network,
          {
            relationType: spec.conclusionType || null,
            strategy: "random",
            inferredOnly: spec.premiseCount === 2,
          },
        );

        // Build question object
        return new Question({
          network,
          premises: originalPremises, // Only original premises, not inferred
          conclusion: conclusion.relation,
          isValid: conclusion.isValid,
          metadata: {
            premiseCount: originalPremises.length,
            entityCount: network.entities.size,
            relationTypes: this.getRelationTypeNames(originalPremises),
            conclusionStrategy: conclusion.strategy,
            isMixed: this.isMixedTypes(originalPremises),
          },
        });
      } catch (e) {
        // If no inferred relations available, retry
        if (attempt === maxAttempts - 1) {
          throw new Error(
            `Failed to generate valid question after ${maxAttempts} attempts: ${e.message}`,
          );
        }
        // Otherwise, continue to next attempt
      }
    }
  }

  /**
   * Generate multiple questions from same premise network
   *
   * @param {Object} spec
   * @param {number} spec.premiseCount
   * @param {Array} spec.relationTypes
   * @param {boolean} spec.mixedTypes
   * @param {number} spec.branchingFactor
   * @param {number} spec.questionCount
   * @param {Array} spec.conclusionTypes
   * @returns {MultiQuestion}
   */
  generateMultiQuestion(spec) {
    // Generate network
    const relationSpecs = this.buildRelationSpecs(
      spec.premiseCount,
      spec.relationTypes,
      spec.mixedTypes,
    );

    const network = this.networkGenerator.generate({
      entityCount: spec.premiseCount + 1,
      relationSpecs,
      branchingFactor: spec.branchingFactor || 0.4,
      allowInference: true,
    });

    // Generate multiple conclusions
    const questions = [];
    const questionCount = spec.questionCount || 2;

    for (let i = 0; i < questionCount; i++) {
      const conclusion = this.conclusionGenerator.generateConclusion(network, {
        relationType: spec.conclusionTypes ? spec.conclusionTypes[i] : null,
        strategy: "random",
      });

      questions.push(
        new Question({
          network,
          premises: network.relations,
          conclusion: conclusion.relation,
          isValid: conclusion.isValid,
          metadata: {
            premiseCount: network.relations.length,
            entityCount: network.entities.size,
            relationTypes: this.getRelationTypeNames(network.relations),
            conclusionStrategy: conclusion.strategy,
            isMixed: this.isMixedTypes(network.relations),
            questionIndex: i,
            totalQuestions: questionCount,
          },
        }),
      );
    }

    return new MultiQuestion(network, questions);
  }

  /**
   * Build relation specs from input
   */
  buildRelationSpecs(premiseCount, relationTypes, mixedTypes) {
    if (!mixedTypes || relationTypes.length === 1) {
      // Single type
      return [
        {
          type: relationTypes[0].type,
          count: premiseCount,
          weight: 1,
        },
      ];
    }

    // Mixed types - distribute premises
    const totalWeight = relationTypes.reduce((sum, rt) => sum + rt.weight, 0);
    const specs = [];

    for (const rt of relationTypes) {
      const proportion = rt.weight / totalWeight;
      const count = Math.max(1, Math.round(premiseCount * proportion));
      specs.push({
        type: rt.type,
        count,
        weight: rt.weight,
      });
    }

    return specs;
  }

  /**
   * Get relation type names from relations
   */
  getRelationTypeNames(relations) {
    const types = new Set();
    for (const rel of relations) {
      types.add(rel.type.name);
    }
    return Array.from(types);
  }

  /**
   * Check if relations are mixed types
   */
  isMixedTypes(relations) {
    return this.getRelationTypeNames(relations).length > 1;
  }
}
