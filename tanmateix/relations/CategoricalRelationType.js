import { RelationType } from "../core/RelationType.js";
import { Relation } from "../core/Relation.js";

/**
 * CategoricalRelationType - Prolog-powered version
 *
 * Uses Tau Prolog for inference and contradiction detection.
 * Handles same/different relationships with proper transitive inference.
 */
export class CategoricalRelationType extends RelationType {
  constructor() {
    super("Categorical");
    this.session = null;
    this.initProlog();
  }

  /**
   * Initialize Prolog session
   */
  initProlog() {
    // Check if Prolog is available
    if (typeof window !== "undefined" && window.pl) {
      this.session = window.pl.create();
    } else if (typeof global !== "undefined" && global.pl) {
      this.session = global.pl.create();
    }

    if (this.session) {
      // Define Prolog rules
      const program = `
        % Symmetry: A=B implies B=A
        same(X, Y) :- same(Y, X).

        % Transitivity for same: A=B, B=C => A=C
        same(X, Z) :- same(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.

        % Transitivity for different: A=B, B≠C => A≠C
        different(X, Z) :- same(X, Y), different(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
        different(X, Z) :- different(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.

        % Symmetry for different
        different(X, Y) :- different(Y, X).

        % Check for contradiction: A cannot be both same and different
        has_contradiction(X, Y) :- same(X, Y), different(X, Y).
      `;
      this.session.consult(program);
    }
  }

  /**
   * Create a categorical relation
   */
  createRelation(entities, properties) {
    return new Relation(this, entities, properties);
  }

  /**
   * Validate relation
   */
  validate(relation) {
    return (
      relation.entities.length === 2 &&
      typeof relation.properties.same === "boolean"
    );
  }

  /**
   * Get inverse relation (for categorical, inverse has same "sameness")
   */
  inverse(relation) {
    return new Relation(this, [relation.entities[1], relation.entities[0]], {
      same: relation.properties.same,
    });
  }

  /**
   * Check contradiction using Prolog
   */
  contradicts(rel1, rel2) {
    // Different relation types don't contradict
    if (rel1.type.name !== rel2.type.name) {
      return false;
    }

    if (!this.sameEntities(rel1, rel2)) {
      return false;
    }

    if (!this.session) {
      // Fallback: manual check
      return rel1.properties.same !== rel2.properties.same;
    }

    // Use Prolog to check for contradiction
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    const testSession = pl.create();

    // Add program and both relations
    const program = `
      same(X, Y) :- same(Y, X).
      same(X, Z) :- same(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Z) :- same(X, Y), different(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Z) :- different(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Y) :- different(Y, X).
      has_contradiction(X, Y) :- same(X, Y), different(X, Y).
    `;
    testSession.consult(program);
    this.addFactToSession(testSession, rel1);
    this.addFactToSession(testSession, rel2);

    // Check for contradiction
    const e1 = rel1.entities[0].id;
    const e2 = rel1.entities[1].id;

    let hasContradiction = false;

    testSession.query(`has_contradiction(${e1}, ${e2}).`);
    testSession.answer((answer) => {
      if (pl.type.is_substitution(answer)) {
        hasContradiction = true;
      }
    });

    return hasContradiction;
  }

  /**
   * Infer relations using Prolog
   */
  infer(relations) {
    if (!this.session || relations.length === 0) {
      return [];
    }

    const inferred = [];

    // Create a fresh session with all relations
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    const infSession = pl.create();

    const program = `
      same(X, Y) :- same(Y, X).
      same(X, Z) :- same(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Z) :- same(X, Y), different(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Z) :- different(X, Y), same(Y, Z), X \\= Y, Y \\= Z, X \\= Z.
      different(X, Y) :- different(Y, X).
    `;
    infSession.consult(program);

    for (const rel of relations) {
      this.addFactToSession(infSession, rel);
    }

    // Get all unique entities
    const entities = new Set();
    for (const rel of relations) {
      entities.add(rel.entities[0].id);
      entities.add(rel.entities[1].id);
    }
    const entityList = Array.from(entities);

    // Check each pair to see if it's inferred
    for (let i = 0; i < entityList.length; i++) {
      for (let j = i + 1; j < entityList.length; j++) {
        const e1 = entityList[i];
        const e2 = entityList[j];

        // Skip if this is a direct relation
        const isDirect = relations.some(
          (r) =>
            (r.entities[0].id === e1 && r.entities[1].id === e2) ||
            (r.entities[0].id === e2 && r.entities[1].id === e1),
        );
        if (isDirect) continue;

        // Check for "same"
        infSession.query(`same(${e1}, ${e2}).`);
        infSession.answer((answer) => {
          const pl = typeof window !== "undefined" ? window.pl : global.pl;
          if (pl.type.is_substitution(answer)) {
            const entityA = relations
              .find((r) => r.entities.some((e) => e.id === e1))
              ?.entities.find((e) => e.id === e1);
            const entityB = relations
              .find((r) => r.entities.some((e) => e.id === e2))
              ?.entities.find((e) => e.id === e2);

            if (entityA && entityB) {
              inferred.push(
                this.createRelation([entityA, entityB], { same: true }),
              );
            }
          }
        });

        // Check for "different"
        infSession.query(`different(${e1}, ${e2}).`);
        infSession.answer((answer) => {
          const pl = typeof window !== "undefined" ? window.pl : global.pl;
          if (pl.type.is_substitution(answer)) {
            const entityA = relations
              .find((r) => r.entities.some((e) => e.id === e1))
              ?.entities.find((e) => e.id === e1);
            const entityB = relations
              .find((r) => r.entities.some((e) => e.id === e2))
              ?.entities.find((e) => e.id === e2);

            if (entityA && entityB) {
              inferred.push(
                this.createRelation([entityA, entityB], { same: false }),
              );
            }
          }
        });
      }
    }

    return inferred;
  }

  /**
   * Add a relation as a Prolog fact
   */
  addFactToSession(session, relation) {
    const e1 = relation.entities[0].id;
    const e2 = relation.entities[1].id;

    if (relation.properties.same) {
      session.consult(`same(${e1}, ${e2}).`);
    } else {
      session.consult(`different(${e1}, ${e2}).`);
    }
  }

  /**
   * Check if two relations have same entities (in any order)
   */
  sameEntities(rel1, rel2) {
    return (
      (rel1.entities[0].id === rel2.entities[0].id &&
        rel1.entities[1].id === rel2.entities[1].id) ||
      (rel1.entities[0].id === rel2.entities[1].id &&
        rel1.entities[1].id === rel2.entities[0].id)
    );
  }
}
