/**
 * QuestionVerifier - Verifies all question types using pure JavaScript
 *
 * Validates:
 * - Linear relations (transitive ordering: A<B, B<C => A<C)
 * - Categorical relations (same/different with parity rules)
 * - Syllogistic relations (subset/disjoint with Barbara and Celarent rules)
 * - Spatial relations (unit-step vector arithmetic)
 */

export class QuestionVerifier {
  /**
   * Verify any question type
   */
  async verifyQuestion(question) {
    const relationType = this.getRelationType(question);

    switch (relationType) {
      case "Linear":
        return await this.verifyLinearQuestion(question);
      case "Categorical":
        return await this.verifyCategoricalQuestion(question);
      case "Spatial":
        return await this.verifySpatialQuestion(question);
      case "Syllogistic":
        return await this.verifySyllogisticQuestion(question);
      default:
        return {
          valid: false,
          error: `Unknown relation type: ${relationType}`,
        };
    }
  }

  /**
   * Get the relation type from a question
   */
  getRelationType(question) {
    if (question.premises && question.premises.length > 0) {
      return question.premises[0].type.name;
    }
    if (question.conclusion) {
      return question.conclusion.type.name;
    }
    return "Unknown";
  }

  /**
   * Verify a linear question
   * Use JavaScript to compute transitive closure (avoids Prolog infinite loops)
   */
  async verifyLinearQuestion(question) {
    try {
      // Build directed graph of less-than relationships
      const entities = new Set();
      const lessThan = new Map(); // entity -> Set of entities it's less than

      // Initialize
      for (const premise of question.premises) {
        entities.add(premise.entities[0].id);
        entities.add(premise.entities[1].id);
      }

      for (const entity of entities) {
        lessThan.set(entity, new Set());
      }

      console.log("=== LINEAR VERIFICATION DEBUG ===");
      console.log("Premises:");

      // Add direct facts
      for (const premise of question.premises) {
        const [e1, e2] = [premise.entities[0].id, premise.entities[1].id];
        console.log(
          `  ${e1} [${premise.properties.text}] ${e2} (direction: ${premise.properties.direction})`,
        );

        // Direction 1: e1 < e2, Direction -1: e2 < e1
        if (premise.properties.direction === 1) {
          console.log(`    → Adding fact: ${e1} < ${e2}`);
          lessThan.get(e1).add(e2);
        } else {
          console.log(`    → Adding fact: ${e2} < ${e1}`);
          lessThan.get(e2).add(e1);
        }
      }

      // Compute transitive closure (Floyd-Warshall style)
      // For each intermediate entity k, if i<k and k<j, then i<j
      for (const k of entities) {
        for (const i of entities) {
          if (lessThan.get(i).has(k)) {
            for (const j of lessThan.get(k)) {
              lessThan.get(i).add(j);
            }
          }
        }
      }

      // Check for contradictions (cycles: A<B and B<A)
      for (const e1 of entities) {
        if (lessThan.get(e1).has(e1)) {
          return {
            valid: false,
            error:
              "Linear verification failed: Cycle detected (entity less than itself)",
            details: { entity: e1 },
          };
        }
        for (const e2 of lessThan.get(e1)) {
          if (lessThan.get(e2).has(e1)) {
            return {
              valid: false,
              error:
                "Linear verification failed: Contradiction detected (A<B and B<A)",
              details: { e1, e2 },
            };
          }
        }
      }

      // Handle indeterminate questions: verify neither direction is provable
      if (question.isIndeterminate) {
        const [c1, c2] = [
          question.conclusion.entities[0].id,
          question.conclusion.entities[1].id,
        ];
        const forwardProvable = lessThan.get(c1)?.has(c2) ?? false;
        const backwardProvable = lessThan.get(c2)?.has(c1) ?? false;
        if (!forwardProvable && !backwardProvable) {
          return { valid: true };
        } else {
          return {
            valid: false,
            error: "Marked indeterminate but one direction is provable",
            details: { c1, c2, forwardProvable, backwardProvable },
          };
        }
      }

      // Check conclusion
      const [c1, c2] = [
        question.conclusion.entities[0].id,
        question.conclusion.entities[1].id,
      ];
      let actualRelation; // true if c1 < c2

      if (question.conclusion.properties.direction === 1) {
        // Conclusion claims c1 < c2
        actualRelation = lessThan.get(c1).has(c2);
      } else {
        // Conclusion claims c2 < c1
        actualRelation = lessThan.get(c2).has(c1);
      }

      const expectedIsValid = actualRelation;

      if (expectedIsValid === question.isValid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          error:
            "Linear verification failed: Question validity doesn't match logical derivation",
          details: {
            conclusion: `${c1.id} ${question.conclusion.properties.direction === 1 ? "<" : ">"} ${c2.id}`,
            actuallyTrue: actualRelation,
            claimedValid: question.isValid,
            expectedValid: expectedIsValid,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Linear verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify a categorical question
   * Unbounded universe: unlimited categories, so different+different ≠ same!
   * Valid inferences:
   * - same + same = same (transitivity)
   * - same + different = different
   * - different + same = different
   * - different + different = UNKNOWN (no inference possible!)
   */
  async verifyCategoricalQuestion(question) {
    try {
      // Build equivalence classes for "same"
      const entities = new Set();
      const sameGraph = new Map(); // entity -> Set of entities in same equivalence class

      for (const premise of question.premises) {
        entities.add(premise.entities[0].id);
        entities.add(premise.entities[1].id);
      }

      // Initialize: each entity in its own class
      for (const entity of entities) {
        sameGraph.set(entity, new Set([entity]));
      }

      // Process "same" relationships: merge equivalence classes
      for (const premise of question.premises) {
        const e1 = premise.entities[0].id;
        const e2 = premise.entities[1].id;
        const isSame = premise.properties.direction === 1;

        if (isSame) {
          // Union-find: merge the two equivalence classes
          const class1 = sameGraph.get(e1);
          const class2 = sameGraph.get(e2);
          const merged = new Set([...class1, ...class2]);

          // Update all members to point to merged class
          for (const entity of merged) {
            sameGraph.set(entity, merged);
          }
        }
      }

      // Build set of "different" pairs (after merging same classes)
      const diffPairs = new Set();
      for (const premise of question.premises) {
        const e1 = premise.entities[0].id;
        const e2 = premise.entities[1].id;
        const isSame = premise.properties.direction === 1;

        if (!isSame) {
          // Mark all members of e1's class as different from all members of e2's class
          for (const member1 of sameGraph.get(e1)) {
            for (const member2 of sameGraph.get(e2)) {
              diffPairs.add(`${member1}:${member2}`);
              diffPairs.add(`${member2}:${member1}`);
            }
          }
        }
      }

      // Check for contradictions (same entity marked as both same and different)
      for (const entity1 of entities) {
        for (const entity2 of sameGraph.get(entity1)) {
          if (entity1 !== entity2 && diffPairs.has(`${entity1}:${entity2}`)) {
            return {
              valid: false,
              error:
                "Categorical verification failed: Contradiction (entities marked as both same and different)",
              details: { entity1, entity2 },
            };
          }
        }
      }

      // Check conclusion
      const c1 = question.conclusion.entities[0].id;
      const c2 = question.conclusion.entities[1].id;
      const conclusionIsSame = question.conclusion.properties.direction === 1;

      // Determine actual relationship
      let actualRelationship; // 'same', 'different', or 'unknown'

      if (sameGraph.get(c1).has(c2)) {
        actualRelationship = "same";
      } else if (diffPairs.has(`${c1}:${c2}`)) {
        actualRelationship = "different";
      } else {
        actualRelationship = "unknown";
      }

      // Validate conclusion
      if (actualRelationship === "unknown") {
        // Can't determine - question should be invalid
        if (question.isValid) {
          return {
            valid: false,
            error:
              "Categorical verification failed: Conclusion cannot be determined from premises",
            details: {
              c1,
              c2,
              conclusion: conclusionIsSame ? "same" : "different",
            },
          };
        } else {
          return { valid: true }; // Correctly marked as invalid
        }
      } else {
        // Can determine - check if conclusion matches
        const actualIsSame = actualRelationship === "same";
        const conclusionMatches = actualIsSame === conclusionIsSame;

        if (conclusionMatches === question.isValid) {
          return { valid: true };
        } else {
          return {
            valid: false,
            error:
              "Categorical verification failed: Question validity doesn't match logical derivation",
            details: {
              conclusion: `${c1} ${conclusionIsSame ? "same" : "different"} ${c2}`,
              actual: `${c1} ${actualIsSame ? "same" : "different"} ${c2}`,
              claimedValid: question.isValid,
              expectedValid: conclusionMatches,
            },
          };
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: `Categorical verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify a syllogistic question using pure JavaScript.
   *
   * Inference rules:
   *   A ⊂ B, B ⊂ C  →  A ⊂ C   [Barbara / transitive closure]
   *   A ⊂ B, B ∩ C = ∅  →  A ∩ C = ∅   [Celarent]
   *   disjoint is symmetric
   */
  async verifySyllogisticQuestion(question) {
    try {
      const entities = new Set();
      for (const premise of question.premises) {
        entities.add(premise.entities[0].id);
        entities.add(premise.entities[1].id);
      }
      const entityList = Array.from(entities);

      // Step 1: Build subset transitive closure
      const subsetClosure = new Map();
      for (const e of entityList) subsetClosure.set(e, new Set());

      for (const premise of question.premises) {
        if (premise.properties.relationType === "subset") {
          const e1 = premise.entities[0].id;
          const e2 = premise.entities[1].id;
          subsetClosure.get(e1)?.add(e2);
        }
      }

      // Iteratively expand: A⊂B, B⊂C → A⊂C
      let changed = true;
      while (changed) {
        changed = false;
        for (const a of entityList) {
          for (const b of [...subsetClosure.get(a)]) {
            for (const c of [...(subsetClosure.get(b) || [])]) {
              if (c !== a && !subsetClosure.get(a).has(c)) {
                subsetClosure.get(a).add(c);
                changed = true;
              }
            }
          }
        }
      }

      const isSubset = (a, b) => subsetClosure.get(a)?.has(b) ?? false;

      // Step 2: Build disjoint closure (symmetric)
      const disjointSet = new Set();
      const addDisjoint = (a, b) => {
        disjointSet.add(`${a}:${b}`);
        disjointSet.add(`${b}:${a}`);
      };
      const isDisjoint = (a, b) => disjointSet.has(`${a}:${b}`);

      for (const premise of question.premises) {
        if (premise.properties.relationType === "disjoint") {
          const e1 = premise.entities[0].id;
          const e2 = premise.entities[1].id;
          addDisjoint(e1, e2);
        }
      }

      // Iteratively expand: A⊂B and B∩C=∅ → A∩C=∅
      changed = true;
      while (changed) {
        changed = false;
        const currentPairs = [...disjointSet].map((p) => p.split(":"));
        for (const [b, c] of currentPairs) {
          for (const a of entityList) {
            if (isSubset(a, b) && !isDisjoint(a, c)) {
              addDisjoint(a, c);
              changed = true;
            }
          }
        }
      }

      // Step 3: Check conclusion
      const c1 = question.conclusion.entities[0].id;
      const c2 = question.conclusion.entities[1].id;
      const conclusionType = question.conclusion.properties.relationType;

      let conclusionHolds;
      if (conclusionType === "subset") {
        conclusionHolds = isSubset(c1, c2);
      } else if (conclusionType === "disjoint") {
        conclusionHolds = isDisjoint(c1, c2);
      } else {
        return {
          valid: false,
          error: `Unknown syllogistic conclusion type: ${conclusionType}`,
        };
      }

      if (conclusionHolds === question.isValid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          error:
            "Syllogistic verification failed: Question validity doesn't match logical derivation",
          details: {
            c1,
            c2,
            conclusionType,
            conclusionHolds,
            claimedValid: question.isValid,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Syllogistic verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify a spatial question using pure JavaScript vector arithmetic.
   *
   * Convention: relation.entities[0] is the subject, entities[1] is the reference.
   * relation.properties.vector = pos(subject) - pos(reference).
   *
   * Reconstruct entity positions from premise vectors, then check that the
   * conclusion's normalized vector matches the actual position difference.
   */
  async verifySpatialQuestion(question) {
    try {
      const positions = new Map(); // entity.id -> [x, y]

      for (const premise of question.premises) {
        if (!premise.properties.vector) continue;
        const subjectId = premise.entities[0].id;
        const refId = premise.entities[1].id;
        const [vx, vy] = premise.properties.vector;

        if (!positions.has(subjectId) && !positions.has(refId)) {
          positions.set(refId, [0, 0]);
          positions.set(subjectId, [vx, vy]);
        } else if (positions.has(refId)) {
          const [rx, ry] = positions.get(refId);
          positions.set(subjectId, [rx + vx, ry + vy]);
        } else {
          const [sx, sy] = positions.get(subjectId);
          positions.set(refId, [sx - vx, sy - vy]);
        }
      }

      const subjectId = question.conclusion.entities[0].id;
      const refId = question.conclusion.entities[1].id;
      const subjectPos = positions.get(subjectId);
      const refPos = positions.get(refId);

      if (!subjectPos || !refPos) {
        return {
          valid: false,
          error:
            "Spatial verification failed: could not place all entities from premises",
        };
      }

      const dx = subjectPos[0] - refPos[0];
      const dy = subjectPos[1] - refPos[1];
      const normalizedActual = [Math.sign(dx), Math.sign(dy)];
      const claimedVec = question.conclusion.properties.vector;

      const vectorsMatch = normalizedActual.every(
        (v, i) => v === claimedVec[i],
      );

      if (vectorsMatch === question.isValid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          error: "Spatial verification failed: conclusion direction mismatch",
          details: { normalizedActual, claimedVec, isValid: question.isValid },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Spatial verification error: ${error.message}`,
      };
    }
  }
}
