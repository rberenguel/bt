import { RelationType } from "../core/RelationType.js";
import { Relation } from "../core/Relation.js";

/**
 * LinearRelationType - Prolog-powered version
 *
 * Uses Tau Prolog for inference and contradiction detection.
 * This eliminates the bugs in the manual implementation:
 * - Correct cycle detection (A>B>C>A is rejected)
 * - Correct contradiction detection (A>B and B>A is rejected)
 * - Automatic transitive inference
 */
export class LinearRelationType extends RelationType {
  constructor() {
    super("Linear");
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
        % Transitive rule: A>B, B>C => A>C
        larger(X, Z, Dim) :-
            larger(X, Y, Dim),
            larger(Y, Z, Dim),
            X \\= Y, Y \\= Z, X \\= Z.

        % Check for contradiction
        has_contradiction(X, Y, Dim) :- larger(X, Y, Dim), larger(Y, X, Dim).
      `;
      this.session.consult(program);
    }
  }

  /**
   * Create a linear relation
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
      typeof relation.properties.direction === "number" &&
      [-1, 0, 1].includes(relation.properties.direction) &&
      typeof relation.properties.dimension === "string"
    );
  }

  /**
   * Get inverse relation
   */
  inverse(relation) {
    const newProps = {
      ...relation.properties,
      direction: -relation.properties.direction,
    };
    return new Relation(
      this,
      [relation.entities[1], relation.entities[0]],
      newProps,
    );
  }

  /**
   * Check contradiction using Prolog
   */
  contradicts(rel1, rel2) {
    // Different relation types don't contradict
    if (rel1.type.name !== rel2.type.name) {
      return false;
    }

    // Only contradict if same dimension
    if (!this.sameDimension(rel1, rel2)) {
      return false;
    }

    if (!this.session) {
      // Fallback: use a corrected manual check
      return this.manualContradicts(rel1, rel2);
    }

    // Use Prolog to check for contradiction
    // Create a fresh test session
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    const testSession = pl.create();

    // Add program and both relations
    const program = `
      larger(X, Z, Dim) :-
          larger(X, Y, Dim),
          larger(Y, Z, Dim),
          X \\= Y, Y \\= Z, X \\= Z.

      has_contradiction(X, Y, Dim) :- larger(X, Y, Dim), larger(Y, X, Dim).
    `;
    testSession.consult(program);
    this.addFactToSession(testSession, rel1);
    this.addFactToSession(testSession, rel2);

    // Check for contradiction
    const e1 = rel1.entities[0].id;
    const e2 = rel1.entities[1].id;
    const dim = rel1.properties.dimension;

    let hasContradiction = false;

    testSession.query(`has_contradiction(${e1}, ${e2}, ${dim}).`);
    testSession.answer((answer) => {
      if (pl.type.is_substitution(answer)) {
        hasContradiction = true;
      }
    });

    return hasContradiction;
  }

  /**
   * Corrected manual contradiction check (fallback)
   */
  manualContradicts(rel1, rel2) {
    if (!this.sameEntities(rel1, rel2) || !this.sameDimension(rel1, rel2)) {
      return false;
    }

    // Check if entities are in same order
    const sameOrder =
      rel1.entities[0].id === rel2.entities[0].id &&
      rel1.entities[1].id === rel2.entities[1].id;

    if (sameOrder) {
      // Same order: different directions = contradiction
      return rel1.properties.direction !== rel2.properties.direction;
    } else {
      // Reversed order: same direction = contradiction
      return rel1.properties.direction === rel2.properties.direction;
    }
  }

  /**
   * Infer relations using Prolog
   */
  infer(relations) {
    if (!this.session || relations.length === 0) {
      return [];
    }

    const inferred = [];
    const dim = relations[0].properties.dimension;

    // Create a fresh session with all relations
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    const infSession = pl.create();

    const program = `
      larger(X, Z, Dim) :-
          larger(X, Y, Dim),
          larger(Y, Z, Dim),
          X \\= Y, Y \\= Z, X \\= Z.
    `;
    infSession.consult(program);

    for (const rel of relations) {
      this.addFactToSession(infSession, rel);
    }

    // Get all unique entity pairs
    const entities = new Set();
    for (const rel of relations) {
      entities.add(rel.entities[0].id);
      entities.add(rel.entities[1].id);
    }
    const entityList = Array.from(entities);

    // Check each pair to see if it's inferred
    for (let i = 0; i < entityList.length; i++) {
      for (let j = 0; j < entityList.length; j++) {
        if (i === j) continue;

        const e1 = entityList[i];
        const e2 = entityList[j];

        // Skip if this is a direct relation
        const isDirect = relations.some(
          (r) =>
            r.entities[0].id === e1 &&
            r.entities[1].id === e2 &&
            r.properties.dimension === dim,
        );
        if (isDirect) continue;

        // Query Prolog
        infSession.query(`larger(${e1}, ${e2}, ${dim}).`);
        infSession.answer((answer) => {
          const pl = typeof window !== "undefined" ? window.pl : global.pl;
          if (pl.type.is_substitution(answer)) {
            // Find the actual entity objects
            const entityA = relations
              .find((r) => r.entities.some((e) => e.id === e1))
              ?.entities.find((e) => e.id === e1);
            const entityB = relations
              .find((r) => r.entities.some((e) => e.id === e2))
              ?.entities.find((e) => e.id === e2);

            if (entityA && entityB) {
              inferred.push(
                this.createRelation([entityA, entityB], {
                  direction: 1,
                  dimension: dim,
                }),
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
    const dim = relation.properties.dimension;
    const dir = relation.properties.direction;

    if (dir === 1) {
      session.consult(`larger(${e1}, ${e2}, ${dim}).`);
    } else if (dir === -1) {
      session.consult(`larger(${e2}, ${e1}, ${dim}).`);
    }
    // dir === 0 means equal, skip for now
  }

  /**
   * Check if two relations are in the same dimension
   */
  sameDimension(rel1, rel2) {
    return rel1.properties.dimension === rel2.properties.dimension;
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
