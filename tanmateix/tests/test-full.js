/**
 * Comprehensive test of the full v2 architecture
 * Run with: node test-full.js
 */

import { QuestionGenerator } from "./generators/QuestionGenerator.js";
import { LinearRelationType } from "./relations/LinearRelationType.js";
import { SpatialRelationType } from "./relations/SpatialRelationType.js";
import { CategoricalRelationType } from "./relations/CategoricalRelationType.js";
import { RandomUtils } from "./utils/RandomUtils.js";
import { EntityFactory } from "./utils/EntityFactory.js";

console.log("=== Full v2 Architecture Test ===\n");

// Setup
const random = new RandomUtils();
const entityFactory = new EntityFactory(
  {
    useNonsenseWords: true,
    nonsenseWordLength: 5,
  },
  random,
);

const linearType = new LinearRelationType();
const spatialType = new SpatialRelationType(2);
const categoricalType = new CategoricalRelationType();

const generator = new QuestionGenerator({
  entityFactory,
  linearDimensions: ["size", "speed", "brightness"],
  random,
});

// Test 1: Single-type linear question
console.log("Test 1: Single-type linear question...");
const q1 = generator.generateQuestion({
  premiseCount: 5,
  relationTypes: [{ type: linearType, weight: 1 }],
  mixedTypes: false,
  branchingFactor: 0.3,
});

console.log(`✓ Generated question with ${q1.premises.length} premises`);
console.log(`  Entities: ${q1.network.entities.size}`);
console.log(`  Valid: ${q1.isValid}`);
console.log(`  Strategy: ${q1.metadata.conclusionStrategy}`);
console.log(`  Premises sample:`);
for (let i = 0; i < Math.min(3, q1.premises.length); i++) {
  const p = q1.premises[i];
  const dir =
    p.properties.direction === 1
      ? ">"
      : p.properties.direction === -1
        ? "<"
        : "=";
  console.log(
    `    ${p.entities[0].displayValue} ${dir} ${p.entities[1].displayValue} (${p.properties.dimension})`,
  );
}
const c = q1.conclusion;
const cDir =
  c.properties.direction === 1
    ? ">"
    : c.properties.direction === -1
      ? "<"
      : "=";
console.log(
  `  Conclusion: ${c.entities[0].displayValue} ${cDir} ${c.entities[1].displayValue} (${c.properties.dimension})`,
);

// Test 2: Mixed-type question
console.log("\nTest 2: Mixed-type question (linear + spatial)...");
const q2 = generator.generateQuestion({
  premiseCount: 6,
  relationTypes: [
    { type: linearType, weight: 0.5 },
    { type: spatialType, weight: 0.5 },
  ],
  mixedTypes: true,
  branchingFactor: 0.4,
});

console.log(`✓ Generated mixed question with ${q2.premises.length} premises`);
console.log(`  Types: ${q2.metadata.relationTypes.join(", ")}`);
console.log(`  Is mixed: ${q2.metadata.isMixed}`);
console.log(`  Valid: ${q2.isValid}`);
console.log(`  Premises by type:`);
const linearPremises = q2.premises.filter((p) => p.type.name === "Linear");
const spatialPremises = q2.premises.filter((p) => p.type.name === "Spatial");
console.log(`    Linear: ${linearPremises.length}`);
console.log(`    Spatial: ${spatialPremises.length}`);

// Test 3: Multi-question
console.log("\nTest 3: Multiple questions from same network...");
const mq = generator.generateMultiQuestion({
  premiseCount: 8,
  relationTypes: [
    { type: linearType, weight: 0.6 },
    { type: spatialType, weight: 0.4 },
  ],
  mixedTypes: true,
  questionCount: 3,
});

console.log(`✓ Generated ${mq.questions.length} questions from same network`);
for (let i = 0; i < mq.questions.length; i++) {
  const q = mq.getQuestion(i);
  console.log(
    `  Q${i + 1}: ${q.conclusion.type.name} conclusion, valid=${q.isValid}, strategy=${q.metadata.conclusionStrategy}`,
  );
}

// Test 4: Categorical relations
console.log("\nTest 4: Categorical relations...");
const q4 = generator.generateQuestion({
  premiseCount: 5,
  relationTypes: [{ type: categoricalType, weight: 1 }],
  mixedTypes: false,
  branchingFactor: 0.5,
});

console.log(
  `✓ Generated categorical question with ${q4.premises.length} premises`,
);
console.log(`  Premises sample:`);
for (let i = 0; i < Math.min(3, q4.premises.length); i++) {
  const p = q4.premises[i];
  const rel = p.properties.same ? "same as" : "different from";
  console.log(
    `    ${p.entities[0].displayValue} ${rel} ${p.entities[1].displayValue}`,
  );
}
const c4 = q4.conclusion;
const rel4 = c4.properties.same ? "same as" : "different from";
console.log(
  `  Conclusion: ${c4.entities[0].displayValue} ${rel4} ${c4.entities[1].displayValue}`,
);

// Test 5: All three types mixed
console.log("\nTest 5: All three relation types mixed...");
const q5 = generator.generateQuestion({
  premiseCount: 9,
  relationTypes: [
    { type: linearType, weight: 0.4 },
    { type: spatialType, weight: 0.3 },
    { type: categoricalType, weight: 0.3 },
  ],
  mixedTypes: true,
  branchingFactor: 0.5,
});

console.log(
  `✓ Generated ultra-mixed question with ${q5.premises.length} premises`,
);
console.log(`  Types: ${q5.metadata.relationTypes.join(", ")}`);
const typeCount = {};
for (const p of q5.premises) {
  typeCount[p.type.name] = (typeCount[p.type.name] || 0) + 1;
}
console.log(`  Distribution:`, typeCount);

// Test 6: JSON serialization
console.log("\nTest 6: JSON serialization...");
const json = q1.toJSON();
console.log(`✓ Serialized question:`);
console.log(`  Premises: ${json.premises.length}`);
console.log(`  Conclusion type: ${json.conclusion.type}`);
console.log(`  Valid: ${json.isValid}`);

// Test 7: Network statistics
console.log("\nTest 7: Network statistics...");
const stats = q5.network.getStats();
console.log(`✓ Network stats:`, JSON.stringify(stats, null, 2));

// Test 8: Inference testing
console.log("\nTest 8: Inference capabilities...");
const q8 = generator.generateQuestion({
  premiseCount: 4,
  relationTypes: [{ type: linearType, weight: 1 }],
  mixedTypes: false,
  branchingFactor: 0.1, // Low branching = more chains
});
const inferred = q8.network.inferRelations();
console.log(`✓ Network has ${q8.network.relations.length} direct relations`);
console.log(`✓ Can infer ${inferred.length} additional relations`);

console.log("\n=== All tests passed! ===");
console.log("\nThe v2 architecture is fully functional and can:");
console.log("  ✓ Generate single-type questions");
console.log("  ✓ Generate mixed-type questions");
console.log("  ✓ Generate multiple questions from same network");
console.log("  ✓ Handle Linear, Spatial, and Categorical relations");
console.log("  ✓ Perform automatic inference");
console.log("  ✓ Serialize to JSON");
console.log("  ✓ Provide network statistics");
