import { Path } from "../core/Path.js";
import { Question } from "../models/Question.js";
import { LinearRelationType } from "../relations/LinearRelationType.js";
import { SpatialRelationType } from "../relations/SpatialRelationType.js";
import { CategoricalRelationType } from "../relations/CategoricalRelationType.js";
import { SyllogisticRelationType } from "../relations/SyllogisticRelationType.js";
import { PremiseNetwork } from "../core/PremiseNetwork.js";
import {
  LINEAR_VOCABULARIES,
  SPATIAL_VOCABULARIES,
  CATEGORICAL_VOCABULARIES,
  SYLLOGISTIC_VOCABULARIES,
} from "../render/Vocabulary.js";
import { SpatialGrid } from "../utils/SpatialGrid.js";
import { QuestionVerifier } from "../verification/QuestionVerifier.js";

/**
 * PathBasedQuestionGenerator - new architecture using Path abstraction
 *
 * Generates questions by:
 * 1. Creating entity graph
 * 2. Defining paths through the graph (each with consistent type/vocab)
 * 3. Extracting premises from paths
 * 4. Generating conclusions from one path
 */
export class PathBasedQuestionGenerator {
  constructor(config) {
    this.config = config;
    this.random = config.random;
    this.entityFactory = config.entityFactory;
    this.verifier = new QuestionVerifier();
  }

  /**
   * Generate a multi-path question with configurable number of paths
   * @param {number} numPaths - Number of paths to generate (default: 1)
   * @param {number} entitiesPerPath - Number of entities per path (default: 3)
   * Each path creates (entitiesPerPath - 1) premises over the SAME entities
   */
  async generateMultiPathQuestion(
    numPaths = 1,
    entitiesPerPath = 3,
    options = {},
  ) {
    const { forceRelationType } = options;

    // ~25% chance of generating an indeterminate question (Linear, single-path only)
    // Skip if a specific relation type is forced (e.g. testSyllogistic)
    if (
      !forceRelationType &&
      numPaths === 1 &&
      entitiesPerPath >= 3 &&
      this.random.random() < 0.25
    ) {
      return await this.generateIndeterminateLinearQuestion(entitiesPerPath);
    }

    // All paths share the same entity graph
    const entities = this.entityFactory.createEntities(entitiesPerPath);

    // Create paths - all using the same 3 entities
    const paths = [];
    const allPremises = [];
    const network = new PremiseNetwork();
    entities.forEach((e) => network.addEntity(e));

    // Pool of once-only types: consumed when picked, Linear always available.
    let oncePool;
    if (forceRelationType === "Syllogistic" && entitiesPerPath >= 3) {
      oncePool = null; // forced — handled per-path below
    } else if (forceRelationType === "Linear") {
      oncePool = null;
    } else if (forceRelationType === "Spatial") {
      oncePool = null;
    } else {
      oncePool = [new SpatialRelationType(2)];
      if (entitiesPerPath >= 3) oncePool.push(new SyllogisticRelationType());
    }

    for (let i = 0; i < numPaths; i++) {
      // All paths use the same entities: [A, B, C]
      const pathEntities = entities;

      let relationType;
      if (forceRelationType === "Syllogistic" && entitiesPerPath >= 3) {
        relationType = new SyllogisticRelationType();
      } else if (forceRelationType === "Linear") {
        relationType = new LinearRelationType();
      } else if (forceRelationType === "Spatial") {
        relationType = new SpatialRelationType(2);
      } else {
        // Pick from Linear + whatever once-types remain
        const candidates = [new LinearRelationType(), ...oncePool];
        relationType = this.random.pickRandom(candidates);
        // If a once-type was picked, remove it from the pool
        const onceIdx = oncePool.findIndex(
          (rt) => rt.name === relationType.name,
        );
        if (onceIdx !== -1) oncePool.splice(onceIdx, 1);
      }

      // Generate path
      const path = this.createPath(pathEntities, relationType);
      paths.push(path);

      // Add relations to network
      path.getPremises().forEach((r) => network.addRelation(r));
      allPremises.push(...path.getPremises());
    }

    // Inject distractor premises (noise filtering challenge)
    const numDistractors = options.numDistractors ?? 0;
    const distractorMeta = { distractorCount: 0, distractorEntityIds: [] };
    let augmentedPremises = allPremises;
    if (numDistractors > 0) {
      const conclusionPathForDistractor = this.random.pickRandom(paths);
      const distractorResult = this.injectDistractors(
        entities,
        conclusionPathForDistractor,
        numDistractors,
      );
      augmentedPremises = [...allPremises, ...distractorResult.relations];
      distractorMeta.distractorCount = distractorResult.relations.length;
      distractorMeta.distractorEntityIds = distractorResult.entities.map(
        (e) => e.id,
      );
    }

    // Shuffle premises to mix different relation types (makes it harder)
    const shuffledPremises = this.random.shuffle(augmentedPremises);

    // Pick one path for the conclusion
    const conclusionPath = this.random.pickRandom(paths);
    const inferredRelation = conclusionPath.getInferredRelation();

    // Safety check: if no valid inference (shouldn't happen with fixed categorical generation)
    if (!inferredRelation) {
      throw new Error(
        `Cannot infer conclusion from ${conclusionPath.relationType.name} path - this indicates a bug in path generation`,
      );
    }

    // Randomly decide if valid or invalid
    const isValid = this.random.coinFlip();
    let conclusion;

    if (isValid) {
      conclusion = inferredRelation;
    } else {
      conclusion = this.createInvalidConclusion(
        conclusionPath,
        inferredRelation,
      );
    }

    // DEBUG LOGGING
    console.log("=== GENERATED MULTI-PATH QUESTION ===");
    console.log("Number of paths:", numPaths);
    console.log("Number of entities:", entities.length);
    console.log("Total premises:", allPremises.length);
    console.log(
      "Entities:",
      entities.map((e) => e.displayValue),
    );

    paths.forEach((path, idx) => {
      console.log(`\nPath ${idx + 1}:`);
      console.log("  Relation Type:", path.relationType.name);
      console.log(
        "  Entities:",
        path.entities.map((e) => e.displayValue),
      );
      console.log("  Vocabulary:", path.vocabulary);
      if (path.relationType.name === "Spatial") {
        console.log("  Grid Layout:");
        console.log(path.pathProperties.spatialGrid.toString());
        console.log("  Edge Vectors:", path.pathProperties.edgeVectors);
      }
      console.log("  Premises:");
      path.getPremises().forEach((p, i) => {
        console.log(
          `    ${i + 1}. ${p.entities[0].displayValue} [${p.properties.text}] ${p.entities[1].displayValue}`,
        );
        if (p.properties.vector) {
          console.log(`       Vector:`, p.properties.vector);
        }
      });
    });

    console.log(
      "\nConclusion:",
      `${conclusion.entities[0].displayValue} [${conclusion.properties.text}] ${conclusion.entities[1].displayValue}`,
    );
    if (conclusion.properties.vector) {
      console.log("   Inferred Vector:", conclusion.properties.vector);
    }
    console.log("Valid?", isValid);
    if (distractorMeta.distractorCount > 0) {
      console.log(
        `Distractors: ${distractorMeta.distractorCount} extra premise(s) with new entities`,
      );
    }
    console.log("========================\n");

    // Get spatial grid if any spatial path exists
    const spatialPath = paths.find((p) => p.relationType.name === "Spatial");

    const question = new Question({
      network,
      premises: shuffledPremises,
      conclusion,
      isValid,
      metadata: {
        premiseCount: allPremises.length,
        entityCount: entities.length,
        relationTypes: paths.map((p) => p.relationType.name),
        isMixed:
          paths.length > 1 &&
          new Set(paths.map((p) => p.relationType.name)).size > 1,
        level: numPaths > 1 ? numPaths : 0,
        numPaths: numPaths,
        spatialGrid: spatialPath?.pathProperties.spatialGrid,
        ...distractorMeta,
      },
    });

    // Verify question logic for all relation types
    const relationType = conclusionPath.relationType.name;
    let verificationQuestion = question;

    // For multi-path questions with mixed types, extract only premises matching the conclusion type
    if (
      paths.length > 1 &&
      new Set(paths.map((p) => p.relationType.name)).size > 1
    ) {
      const relevantPremises = allPremises.filter(
        (p) => p.type.name === relationType,
      );
      const relevantNetwork = new PremiseNetwork();
      entities.forEach((e) => relevantNetwork.addEntity(e));
      relevantPremises.forEach((r) => relevantNetwork.addRelation(r));

      verificationQuestion = new Question({
        network: relevantNetwork,
        premises: relevantPremises,
        conclusion: conclusion,
        isValid: question.isValid,
        metadata: question.metadata,
      });
    }

    // Verify the question
    const verification =
      await this.verifier.verifyQuestion(verificationQuestion);

    if (!verification.valid) {
      console.error(
        `❌ ${relationType.toUpperCase()} VERIFICATION FAILED:`,
        verification.error,
      );
      console.error("This indicates a bug in question generation!");
      console.error("Details:", verification.details);
      throw new Error(`Verification failed: ${verification.error}`);
    } else if (verification.warning) {
      console.warn(`⚠️  ${relationType} verification:`, verification.warning);
    } else {
      console.log(`✓ ${relationType} question verified`);
    }

    return question;
  }

  /**
   * Generate an indeterminate linear question using a hub-merge shape.
   * Hub = entities[N-2]; left chain feeds into hub; last entity also feeds into hub.
   * The two leaf endpoints (first and last entity) have no transitive connection.
   */
  async generateIndeterminateLinearQuestion(entitiesPerPath) {
    const entities = this.entityFactory.createEntities(entitiesPerPath);

    const dimensions = this.config.linearDimensions || [
      "size",
      "speed",
      "brightness",
    ];
    const dimension = this.random.pickRandom(dimensions);
    const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;
    const forwardText = this.random.pickRandom(vocab.forward);
    const backwardText = this.random.pickRandom(vocab.backward);

    const linType = new LinearRelationType();
    const network = new PremiseNetwork();
    entities.forEach((e) => network.addEntity(e));

    const hubIdx = entitiesPerPath - 2;
    const premises = [];

    // Left chain: entities[0..hubIdx] all pointing toward hub
    for (let i = 0; i < hubIdx; i++) {
      const rel = linType.createRelation([entities[i], entities[i + 1]], {
        dimension,
        direction: 1,
        text: forwardText,
      });
      premises.push(rel);
      network.addRelation(rel);
    }

    // Right branch: last entity → hub
    const rightRel = linType.createRelation(
      [entities[entitiesPerPath - 1], entities[hubIdx]],
      {
        dimension,
        direction: 1,
        text: forwardText,
      },
    );
    premises.push(rightRel);
    network.addRelation(rightRel);

    const shuffledPremises = this.random.shuffle(premises);

    // Conclusion between the two leaf endpoints (genuinely indeterminate)
    const leaf0 = entities[0];
    const leafN = entities[entitiesPerPath - 1];
    const useForward = this.random.coinFlip();
    const conclusion = useForward
      ? linType.createRelation([leaf0, leafN], {
          dimension,
          direction: 1,
          text: forwardText,
        })
      : linType.createRelation([leafN, leaf0], {
          dimension,
          direction: -1,
          text: backwardText,
        });

    const question = new Question({
      network,
      premises: shuffledPremises,
      conclusion,
      isValid: false,
      isIndeterminate: true,
      metadata: {
        premiseCount: premises.length,
        entityCount: entities.length,
        relationTypes: ["Linear"],
        isMixed: false,
        level: 0,
        numPaths: 1,
      },
    });

    const verification = await this.verifier.verifyQuestion(question);
    if (!verification.valid) {
      console.error(
        "❌ INDETERMINATE VERIFICATION FAILED:",
        verification.error,
      );
      throw new Error(
        `Indeterminate verification failed: ${verification.error}`,
      );
    } else {
      console.log("✓ Indeterminate question verified");
    }

    return question;
  }

  /**
   * Generate a level 0 question: 2 premises, 1 path, 3 entities
   */
  async generateLevel0Question() {
    return await this.generateMultiPathQuestion(1);
  }

  /**
   * Create a path with consistent vocabulary
   */
  createPath(entities, relationType) {
    let pathProperties;
    let vocabulary;

    if (relationType instanceof LinearRelationType) {
      // Pick dimension
      const dimensions = this.config.linearDimensions || [
        "size",
        "speed",
        "brightness",
      ];
      const dimension = this.random.pickRandom(dimensions);

      // Pick vocabulary ONCE for this path
      const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;
      vocabulary = {
        forward: this.random.pickRandom(vocab.forward), // e.g., "is less than"
        backward: this.random.pickRandom(vocab.backward), // e.g., "is more than"
        equal: this.random.pickRandom(vocab.equal),
      };

      pathProperties = {
        dimension,
      };
    } else if (relationType instanceof SpatialRelationType) {
      // Use grid-based positioning for spatial relations
      const spatialGrid = new SpatialGrid();
      spatialGrid.placeEntitiesAsWalk(entities);

      // Pick vocabulary style ONCE for consistency
      const vocabStyle = this.random.pickRandom(["cardinal", "relative"]);
      const vocabSet = SPATIAL_VOCABULARIES[2][vocabStyle];

      vocabulary = {
        vocabSet: vocabSet,
        style: vocabStyle,
      };

      pathProperties = {
        vocabStyle,
        spatialGrid: spatialGrid, // Store the grid for calculating vectors
        edgeVectors: [], // Will be filled based on grid positions
      };

      // Log grid for debugging
      console.log("Spatial Grid:", spatialGrid.toString());
      console.log("Entity Positions:", spatialGrid.getDebugInfo());
    } else if (relationType instanceof CategoricalRelationType) {
      // Pick vocabulary ONCE
      vocabulary = {
        forward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same),
        backward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.different),
        equal: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same),
      };

      const same = this.random.coinFlip();
      pathProperties = {
        same,
      };
    } else if (relationType instanceof SyllogisticRelationType) {
      vocabulary = {
        subset: this.random.pickRandom(SYLLOGISTIC_VOCABULARIES.subset),
        disjoint: this.random.pickRandom(SYLLOGISTIC_VOCABULARIES.disjoint),
        conclusionSubset: this.random.pickRandom(
          SYLLOGISTIC_VOCABULARIES.subset,
        ),
        conclusionDisjoint: this.random.pickRandom(
          SYLLOGISTIC_VOCABULARIES.disjoint,
        ),
      };

      pathProperties = {
        lastEdgeDisjoint: this.random.coinFlip(),
      };
    }

    return new Path({
      entities,
      relationType,
      pathProperties,
      vocabulary,
    });
  }

  /**
   * Inject distractor premises: valid relations involving new entities that
   * cannot affect the conclusion (new entities are dead-ends by construction).
   *
   * @param {Entity[]} coreEntities - The entities already in the question
   * @param {Path} conclusionPath - The path whose conclusion entity pair we must NOT bridge
   * @param {number} numDistractors - How many distractor premises to add
   * @returns {{ relations: Relation[], entities: Entity[] }}
   */
  injectDistractors(coreEntities, conclusionPath, numDistractors) {
    const relations = [];
    const newEntities = [];

    // The conclusion endpoints — we never pick these as the "anchor" for a
    // distractor because a distractor entity bridging them could matter.
    // Using a middle entity (not first/last) is always safe.
    const conclusionEndpoints = new Set([
      conclusionPath.entities[0].id,
      conclusionPath.entities[conclusionPath.entities.length - 1].id,
    ]);
    const safeAnchors = coreEntities.filter(
      (e) => !conclusionEndpoints.has(e.id),
    );
    // Fall back to all core entities if no middle entities exist (short paths)
    const anchors = safeAnchors.length > 0 ? safeAnchors : coreEntities;

    // Use a Linear relation for distractors — simple and always renderable
    const linType = new LinearRelationType();
    const dimensions = this.config.linearDimensions || [
      "size",
      "speed",
      "brightness",
    ];

    for (let i = 0; i < numDistractors; i++) {
      const distractorEntity = this.entityFactory.createEntity();
      newEntities.push(distractorEntity);

      // Pick a random anchor from safe middle entities
      const anchor = this.random.pickRandom(anchors);

      // Pick dimension & vocabulary
      const dimension = this.random.pickRandom(dimensions);
      const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;
      const useForward = this.random.coinFlip();
      const text = useForward
        ? this.random.pickRandom(vocab.forward)
        : this.random.pickRandom(vocab.backward);
      const direction = useForward ? 1 : -1;

      // Relation: distractorEntity [rel] anchor  (distractor is always an endpoint)
      const rel = linType.createRelation([distractorEntity, anchor], {
        dimension,
        direction,
        text,
      });
      relations.push(rel);
    }

    return { relations, entities: newEntities };
  }

  /**
   * Generate a fully-connected spatial graph question
   * @param {number} numEntities - Number of entities (default: 3)
   * Creates all pairwise spatial relations (or a subset)
   */
  async generateSpatialGraphQuestion(numEntities = 3, _retryCount = 0) {
    const entities = this.entityFactory.createEntities(numEntities);
    const relationType = new SpatialRelationType(2);

    // Create spatial grid and place all entities
    const spatialGrid = new SpatialGrid();
    spatialGrid.placeEntitiesRandomly(entities);

    // Pick vocabulary style
    const vocabStyle = this.random.pickRandom(["cardinal", "relative"]);
    const vocabSet = SPATIAL_VOCABULARIES[2][vocabStyle];

    const vocabulary = {
      vocabSet: vocabSet,
      style: vocabStyle,
    };

    // Generate all pairwise relations (only one direction per pair)
    const premises = [];
    const network = new PremiseNetwork();
    entities.forEach((e) => network.addEntity(e));

    // Create relations for all pairs (only i < j to avoid duplicates/contradictions)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        const vector = spatialGrid.getVector(entityA, entityB);
        // Normalize for vocabulary lookup (vocabSet keys are normalized)
        const normalizedVector = vector.map((v) =>
          v === 0 ? 0 : v / Math.abs(v),
        );
        const vectorKey = JSON.stringify(normalizedVector);
        const text = vocabSet[vectorKey]
          ? vocabSet[vectorKey][0]
          : "relates to";

        const relation = relationType.createRelation([entityB, entityA], {
          text,
          vector,
          vocabStyle,
        });

        premises.push(relation);
        network.addRelation(relation);
      }
    }

    // Shuffle to make it harder
    const shuffledPremises = this.random.shuffle(premises);

    // Pick a random subset of premises to show (not all of them)
    const numPremisesToShow = Math.min(
      (numEntities * (numEntities - 1)) / 2, // At most half (undirected pairs)
      shuffledPremises.length,
    );
    const shownPremises = shuffledPremises.slice(0, numPremisesToShow);

    // Pick two random entities for conclusion
    const [e1, e2] = this.random.shuffle([...entities]).slice(0, 2);
    const conclusionVector = spatialGrid.getVector(e1, e2);
    const normalizedConclusionVector = conclusionVector.map((v) =>
      v === 0 ? 0 : v / Math.abs(v),
    );
    const conclusionVectorKey = JSON.stringify(normalizedConclusionVector);
    const conclusionText = vocabSet[conclusionVectorKey]
      ? vocabSet[conclusionVectorKey][0]
      : "relates to";

    // Randomly decide if valid or invalid
    const isValid = this.random.coinFlip();
    let conclusion;

    if (isValid) {
      conclusion = relationType.createRelation([e2, e1], {
        text: conclusionText,
        vector: normalizedConclusionVector,
        vocabStyle,
      });
    } else {
      // Invalid: use wrong vector (flip the normalized direction)
      const wrongVector = normalizedConclusionVector.map((v) => -v);
      const wrongVectorKey = JSON.stringify(wrongVector);
      const wrongText = vocabSet[wrongVectorKey]
        ? vocabSet[wrongVectorKey][0]
        : "relates to";
      conclusion = relationType.createRelation([e2, e1], {
        text: wrongText,
        vector: wrongVector,
        vocabStyle,
      });
    }

    console.log("=== SPATIAL GRAPH QUESTION ===");
    console.log("Grid Layout:");
    console.log(spatialGrid.toString());
    console.log("Shown premises:", shownPremises.length, "/", premises.length);
    console.log("Valid?", isValid);

    const question = new Question({
      network,
      premises: shownPremises,
      conclusion,
      isValid,
      metadata: {
        premiseCount: shownPremises.length,
        entityCount: entities.length,
        relationTypes: ["Spatial"],
        isMixed: false,
        level: "spatial-graph",
        graphType: "fully-connected",
        spatialGrid: spatialGrid, // Include grid for verification
      },
    });

    // Verify question
    const verification = await this.verifier.verifyQuestion(question);
    if (!verification.valid) {
      console.error("❌ SPATIAL VERIFICATION FAILED:", verification.error);
      console.error("Question details:", verification.details);
      console.error("This indicates a bug in spatial question generation!");

      // Always throw so that newQuestion() logic catches and retries it properly.
      throw new Error("Spatial verification failed: " + verification.error);
    } else if (verification.warning) {
      console.warn("⚠️  Spatial verification:", verification.warning);
    } else {
      console.log("✓ Spatial question verified");
    }
    console.log("========================\n");

    return question;
  }

  /**
   * Create an invalid conclusion by swapping the entities or flipping the relation
   * This maintains the same vocabulary but makes it logically wrong
   */
  createInvalidConclusion(path, validConclusion) {
    const isCategorical = path.relationType.name === "Categorical";
    const isSpatial = path.relationType.name === "Spatial";
    const isSyllogistic = path.relationType.name === "Syllogistic";

    if (isSyllogistic) {
      // Flip subset ↔ disjoint; keep same entity pair (A, C)
      const validRelType = validConclusion.properties.relationType;
      const newRelType = validRelType === "subset" ? "disjoint" : "subset";
      const newText =
        newRelType === "subset"
          ? path.vocabulary.conclusionSubset
          : path.vocabulary.conclusionDisjoint;

      const properties = {
        ...validConclusion.properties,
        relationType: newRelType,
        direction: 1,
        text: newText,
      };
      return path.relationType.createRelation(
        [validConclusion.entities[0], validConclusion.entities[1]],
        properties,
      );
    } else if (isCategorical) {
      // Categorical: Flip the relation (same ↔ different)
      // Can't just swap entities because "same" is symmetric
      const newDirection = -validConclusion.properties.direction;
      const newText =
        newDirection === 1 ? path.vocabulary.forward : path.vocabulary.backward;

      return path.createRelation(
        validConclusion.entities[0],
        validConclusion.entities[1],
        newText,
        newDirection,
      );
    } else if (isSpatial) {
      // Spatial: Flip the vector to make it wrong
      // If valid is "A is north of B" (vector [0,1]), invalid is "A is south of B" (vector [0,-1])
      const flippedVector = validConclusion.properties.vector.map((v) => -v);
      const normalizedVector = flippedVector.map((v) =>
        v === 0 ? 0 : v / Math.abs(v),
      );
      const vectorKey = JSON.stringify(normalizedVector);

      // Get text for flipped vector
      const vocabSet = path.vocabulary.vocabSet;
      const flippedText = vocabSet[vectorKey]
        ? vocabSet[vectorKey][0]
        : validConclusion.properties.text;

      return path.createRelationWithVector(
        validConclusion.entities[0],
        validConclusion.entities[1],
        flippedText,
        flippedVector,
      );
    } else {
      // Linear: Swap entities to make it wrong
      // Valid: "A is less than C" (direction: 1) or "C is more than A" (direction: -1)
      // Invalid: Swap to make it wrong
      // If valid is "A is less than C", invalid is "C is less than A" (using same word "less")
      // If valid is "C is more than A", invalid is "A is more than C" (using same word "more")

      return path.createRelation(
        validConclusion.entities[1], // Swap
        validConclusion.entities[0], // Swap
        validConclusion.properties.text, // Keep same text (makes it wrong)
        validConclusion.properties.direction, // Keep same direction semantically
      );
    }
  }
}
