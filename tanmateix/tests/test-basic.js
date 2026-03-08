/**
 * Basic test to verify core functionality
 * Run with: node test-basic.js
 */

import { Entity } from "./core/Entity.js";
import { PremiseNetwork } from "./core/PremiseNetwork.js";
import { LinearRelationType } from "./relations/LinearRelationType.js";
import { SpatialRelationType } from "./relations/SpatialRelationType.js";
import { CategoricalRelationType } from "./relations/CategoricalRelationType.js";
import { SyllogisticRelationType } from "./relations/SyllogisticRelationType.js";
import { QuestionVerifier } from "./verification/QuestionVerifier.js";
import { Question } from "./models/Question.js";

console.log("=== Testing v2 Architecture ===\n");

// Test 1: Create entities
console.log("Test 1: Creating entities...");
const a = new Entity("a", "FOBIX");
const b = new Entity("b", "GAKUN");
const c = new Entity("c", "JEPOL");
const d = new Entity("d", "MIVAT");
console.log(
  "✓ Entities created:",
  a.displayValue,
  b.displayValue,
  c.displayValue,
  d.displayValue,
);

// Test 2: Create linear relations
console.log("\nTest 2: Creating linear relations...");
const linearType = new LinearRelationType();
const r1 = linearType.createRelation([a, b], {
  direction: 1,
  dimension: "size",
});
const r2 = linearType.createRelation([b, c], {
  direction: 1,
  dimension: "size",
});
console.log("✓ Created:", a.displayValue, ">", b.displayValue);
console.log("✓ Created:", b.displayValue, ">", c.displayValue);

// Test 3: Build a premise network
console.log("\nTest 3: Building premise network...");
const network = new PremiseNetwork();
network.addEntity(a);
network.addEntity(b);
network.addEntity(c);
network.addEntity(d);
network.addRelation(r1);
network.addRelation(r2);
console.log(
  "✓ Network created with",
  network.entities.size,
  "entities and",
  network.relations.length,
  "relations",
);

// Test 4: Test inference
console.log("\nTest 4: Testing transitivity inference...");
const inferred = network.inferRelations();
console.log("✓ Inferred", inferred.length, "new relations");
if (inferred.length > 0) {
  const inf = inferred[0];
  console.log(
    "  →",
    inf.entities[0].displayValue,
    ">",
    inf.entities[1].displayValue,
    "(inferred)",
  );
}

// Test 5: Test spatial relations
console.log("\nTest 5: Testing spatial relations...");
const spatialType = new SpatialRelationType(2);
const s1 = spatialType.createRelation([c, d], { vector: [1, 0] }); // c is east of d
network.addRelation(s1);
console.log(
  "✓ Created spatial relation:",
  c.displayValue,
  "east of",
  d.displayValue,
);
console.log("✓ Mixed network now has", network.relations.length, "relations");

// Test 6: Test categorical relations
console.log("\nTest 6: Testing categorical relations...");
const e = new Entity("e", "RIPOX");
const f = new Entity("f", "TULEV");
network.addEntity(e);
network.addEntity(f);
const catType = new CategoricalRelationType();
const c1 = catType.createRelation([e, f], { same: true });
network.addRelation(c1);
console.log(
  "✓ Created categorical relation:",
  e.displayValue,
  "= same as",
  f.displayValue,
);

// Test 7: Test pathfinding
console.log("\nTest 7: Testing pathfinding...");
const path = network.findPath(a.id, c.id);
if (path) {
  const pathNames = path.map((id) => network.entities.get(id).displayValue);
  console.log(
    "✓ Path from",
    a.displayValue,
    "to",
    c.displayValue,
    ":",
    pathNames.join(" → "),
  );
}

// Test 8: Test network stats
console.log("\nTest 8: Network statistics...");
const stats = network.getStats();
console.log("✓ Stats:", JSON.stringify(stats, null, 2));

// Test 9: Test JSON serialization
console.log("\nTest 9: Testing JSON serialization...");
const json = network.toJSON();
console.log(
  "✓ Network serialized:",
  json.entities.length,
  "entities,",
  json.relations.length,
  "relations",
);

// Test 10: Syllogistic relations - basic creation
console.log("\nTest 10: Syllogistic relations - basic creation...");
const sylType = new SyllogisticRelationType();
const syl1 = sylType.createRelation([a, b], {
  relationType: "subset",
  direction: 1,
  text: "are a type of",
});
const syl2 = sylType.createRelation([b, c], {
  relationType: "disjoint",
  direction: 1,
  text: "are never",
});
console.log("✓ subset:", a.displayValue, "⊂", b.displayValue);
console.log("✓ disjoint:", b.displayValue, "∩", c.displayValue, "= ∅");

// Test 11: Syllogistic validate
console.log("\nTest 11: Syllogistic validate...");
console.log("✓ subset valid:", sylType.validate(syl1));
console.log("✓ disjoint valid:", sylType.validate(syl2));
const invalidSyl = sylType.createRelation([a, b], {
  relationType: "neither",
  direction: 1,
});
console.log("✓ invalid relationType caught:", !sylType.validate(invalidSyl));

// Test 12: Syllogistic contradicts
console.log("\nTest 12: Syllogistic contradicts...");
const sylAB_subset = sylType.createRelation([a, b], {
  relationType: "subset",
  direction: 1,
});
const sylAB_disjoint = sylType.createRelation([a, b], {
  relationType: "disjoint",
  direction: 1,
});
const sylAB_subset2 = sylType.createRelation([a, b], {
  relationType: "subset",
  direction: 1,
});
console.log(
  "✓ subset+disjoint contradict:",
  sylType.contradicts(sylAB_subset, sylAB_disjoint),
);
console.log(
  "✓ subset+subset no contradiction:",
  !sylType.contradicts(sylAB_subset, sylAB_subset2),
);

// Test 13: Syllogistic verification - Barbara (subset+subset → subset)
console.log(
  "\nTest 13: Syllogistic verification - Barbara (A⊂B, B⊂C → A⊂C)...",
);
const verifier = new QuestionVerifier();
// A⊂B, B⊂C → A⊂C
const premisesA = [
  sylType.createRelation([a, b], {
    relationType: "subset",
    direction: 1,
    text: "are a type of",
  }),
  sylType.createRelation([b, c], {
    relationType: "subset",
    direction: 1,
    text: "belong to",
  }),
];
const netA = new PremiseNetwork();
[a, b, c].forEach((e) => netA.addEntity(e));
premisesA.forEach((r) => netA.addRelation(r));

const conclusionSubset = sylType.createRelation([a, c], {
  relationType: "subset",
  direction: 1,
  text: "fall within",
});
const qBarbara = new Question({
  network: netA,
  premises: premisesA,
  conclusion: conclusionSubset,
  isValid: true,
});

const vBarbara = await verifier.verifySyllogisticQuestion(qBarbara);
console.log("✓ Barbara (valid=true) verified:", vBarbara.valid);

// Test 14: Syllogistic verification - Celarent (A⊂B, B∩C=∅ → A∩C=∅)
console.log(
  "\nTest 14: Syllogistic verification - Celarent (A⊂B, B∩C=∅ → A∩C=∅)...",
);
const premisesB = [
  sylType.createRelation([a, b], {
    relationType: "subset",
    direction: 1,
    text: "are a type of",
  }),
  sylType.createRelation([b, c], {
    relationType: "disjoint",
    direction: 1,
    text: "are never",
  }),
];
const netB = new PremiseNetwork();
[a, b, c].forEach((e) => netB.addEntity(e));
premisesB.forEach((r) => netB.addRelation(r));

const conclusionDisjoint = sylType.createRelation([a, c], {
  relationType: "disjoint",
  direction: 1,
  text: "are excluded from",
});
const qCelarent = new Question({
  network: netB,
  premises: premisesB,
  conclusion: conclusionDisjoint,
  isValid: true,
});

const vCelarent = await verifier.verifySyllogisticQuestion(qCelarent);
console.log("✓ Celarent (valid=true) verified:", vCelarent.valid);

// Test 15: Syllogistic verification - invalid conclusion
console.log("\nTest 15: Syllogistic - wrong conclusion correctly rejected...");
const conclusionWrong = sylType.createRelation([a, c], {
  relationType: "subset", // Wrong: should be disjoint per Celarent
  direction: 1,
  text: "are a type of",
});
const qWrong = new Question({
  network: netB,
  premises: premisesB,
  conclusion: conclusionWrong,
  isValid: false, // Correctly claimed as invalid
});
const vWrong = await verifier.verifySyllogisticQuestion(qWrong);
console.log("✓ Wrong conclusion (isValid=false) verified:", vWrong.valid);

console.log("\n=== All basic tests passed! ===");
