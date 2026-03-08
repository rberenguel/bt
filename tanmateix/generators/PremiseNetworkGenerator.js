import { PremiseNetwork } from "../core/PremiseNetwork.js";
import { LinearRelationType } from "../relations/LinearRelationType.js";
import { SpatialRelationType } from "../relations/SpatialRelationType.js";
import { CategoricalRelationType } from "../relations/CategoricalRelationType.js";
import {
  pickLinearVocabulary,
  pickSpatialVocabulary,
} from "../render/Vocabulary.js";

/**
 * PremiseNetworkGenerator generates premise networks with specified characteristics.
 */
export class PremiseNetworkGenerator {
  /**
   * @param {Object} config
   * @param {EntityFactory} config.entityFactory
   * @param {string[]} config.linearDimensions - Available dimensions for linear relations
   * @param {RandomUtils} random
   */
  constructor(config, random) {
    this.config = config;
    this.random = random;
    this.entityFactory = config.entityFactory;
  }

  /**
   * Generate a premise network
   *
   * @param {Object} spec
   * @param {number} spec.entityCount - Number of entities
   * @param {Array} spec.relationSpecs - [{ type: RelationType, count: number, weight: number }]
   * @param {number} spec.branchingFactor - How branched the graph should be (0-1)
   * @param {boolean} spec.allowInference - Whether to add inferred relations
   * @returns {PremiseNetwork}
   */
  generate(spec) {
    const network = new PremiseNetwork();

    // Pick a consistent spatial vocabulary style for this network
    this.spatialVocabStyle = this.random.pickRandom(["cardinal", "relative"]);

    // Pick a consistent linear dimension for this network (ONE dimension per question!)
    this.linearDimension = this.pickDimension();

    // Step 1: Create entities
    const entities = this.entityFactory.createEntities(spec.entityCount);
    for (const entity of entities) {
      network.addEntity(entity);
    }

    // Step 2: Plan which relations to create
    const relationPlan = this.planRelations(spec.relationSpecs);

    // Step 3: Build the network
    this.buildNetwork(network, entities, relationPlan, spec.branchingFactor);

    // Step 4: Optionally add inferred relations
    if (spec.allowInference) {
      const inferred = network.inferRelations();
      for (const rel of inferred) {
        try {
          network.addRelation(rel);
        } catch (e) {
          // Skip if causes contradiction
        }
      }
    }

    return network;
  }

  /**
   * Plan which relation types to use
   * @param {Array} relationSpecs
   * @returns {RelationType[]}
   */
  planRelations(relationSpecs) {
    const plan = [];

    for (const spec of relationSpecs) {
      const instances = this.random.randomInt(
        Math.max(1, spec.count - 1),
        spec.count + 1,
      );

      for (let i = 0; i < instances; i++) {
        plan.push(spec.type);
      }
    }

    return this.random.shuffle(plan);
  }

  /**
   * Build the network by connecting entities
   */
  buildNetwork(network, entities, relationPlan, branchingFactor) {
    // For 2-premise questions (3 entities, 2 relations), force a chain
    const forceChain = entities.length === 3 && relationPlan.length === 2;

    // Start with first entity
    const connected = new Set([entities[0].id]);
    const unconnected = new Set(entities.slice(1).map((e) => e.id));
    let lastAddedEntity = entities[0];

    for (const relationType of relationPlan) {
      if (unconnected.size === 0) break;

      let fromEntity;
      if (forceChain) {
        // For 2-premise chains, always extend from the last added entity
        fromEntity = lastAddedEntity;
      } else {
        // Decide whether to branch or extend
        const shouldBranch =
          this.random.random() < branchingFactor && connected.size > 1;

        if (shouldBranch) {
          // Pick random connected entity (weighted by degree)
          fromEntity = this.pickWeightedConnectedEntity(network, connected);
        } else {
          // Pick entity with fewest connections (extend chain)
          fromEntity = this.pickLeastConnectedEntity(network, connected);
        }
      }

      // Pick unconnected entity
      const toEntityId = this.random.pickRandom(Array.from(unconnected));
      const toEntity = network.entities.get(toEntityId);

      // Create relation
      const relation = this.createRandomRelation(
        relationType,
        fromEntity,
        toEntity,
      );

      try {
        network.addRelation(relation);
        connected.add(toEntityId);
        unconnected.delete(toEntityId);
        lastAddedEntity = toEntity; // Track for chain building
      } catch (e) {
        // If contradiction, skip this relation
        continue;
      }
    }

    // Connect any remaining unconnected entities
    while (unconnected.size > 0) {
      const fromEntity = this.pickLeastConnectedEntity(network, connected);
      const toEntityId = this.random.pickRandom(Array.from(unconnected));
      const toEntity = network.entities.get(toEntityId);

      // Pick random available relation type
      const relationType = this.random.pickRandom(relationPlan);

      const relation = this.createRandomRelation(
        relationType,
        fromEntity,
        toEntity,
      );

      try {
        network.addRelation(relation);
        connected.add(toEntityId);
        unconnected.delete(toEntityId);
      } catch (e) {
        // Last resort: just mark as connected
        unconnected.delete(toEntityId);
        connected.add(toEntityId);
      }
    }
  }

  /**
   * Create a random relation of the given type
   */
  createRandomRelation(relationType, fromEntity, toEntity) {
    if (relationType instanceof LinearRelationType) {
      const direction = this.random.pickRandom([-1, 1]);
      // Use the consistent dimension chosen for this network
      return relationType.createRelation([fromEntity, toEntity], {
        direction,
        dimension: this.linearDimension,
      });
    } else if (relationType instanceof SpatialRelationType) {
      const vector = this.random.randomVector(relationType.dimensions);
      return relationType.createRelation([fromEntity, toEntity], {
        vector,
        vocabStyle: this.spatialVocabStyle, // Use consistent style for whole network
      });
    } else if (relationType instanceof CategoricalRelationType) {
      const same = this.random.coinFlip();
      return relationType.createRelation([fromEntity, toEntity], { same });
    }

    throw new Error(`Unknown relation type: ${relationType.name}`);
  }

  /**
   * Pick a dimension for linear relations
   */
  pickDimension() {
    const dimensions = this.config.linearDimensions || [
      "size",
      "speed",
      "brightness",
    ];
    return this.random.pickRandom(dimensions);
  }

  /**
   * Pick weighted connected entity (favor less connected nodes)
   */
  pickWeightedConnectedEntity(network, connectedIds) {
    const weights = [];
    const entities = [];

    for (const id of connectedIds) {
      const degree = network.adjacency.get(id).size;
      weights.push(1 / (degree + 1));
      entities.push(network.entities.get(id));
    }

    return this.random.weightedPick(entities, weights);
  }

  /**
   * Pick least connected entity
   */
  pickLeastConnectedEntity(network, connectedIds) {
    let minDegree = Infinity;
    let chosen = null;

    for (const id of connectedIds) {
      const degree = network.adjacency.get(id).size;
      if (degree < minDegree) {
        minDegree = degree;
        chosen = id;
      }
    }

    return network.entities.get(chosen);
  }
}
