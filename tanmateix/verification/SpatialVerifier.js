/**
 * SpatialVerifier - Verifies spatial questions using Prolog
 *
 * This provides a sanity check for generated spatial questions:
 * - Vector arithmetic generates the question (fast)
 * - Prolog verifies it's logically consistent (fast forward check)
 * - If verification fails, we know there's a bug in our generation logic
 */

export class SpatialVerifier {
  constructor() {
    this.session = null;
    this.initialized = false;
    this.initProlog();
  }

  /**
   * Initialize Prolog session with spatial verification rules
   */
  async initProlog() {
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    if (!pl) {
      console.warn("Tau Prolog not available - spatial verification disabled");
      return;
    }

    this.session = pl.create();

    // Load verification rules from embedded program
    const program = await this.loadVerificationRules();
    this.session.consult(program, {
      success: () => {
        this.initialized = true;
        console.log("✓ Spatial verification initialized");
      },
      error: (err) => {
        console.error("Failed to load spatial verification rules:", err);
      },
    });
  }

  /**
   * Load Prolog verification rules (sync version)
   */
  loadVerificationRulesSync() {
    return this.getRulesProgram();
  }

  /**
   * Load Prolog verification rules
   * In production, these would be loaded from spatial-verification.pl
   * For now, embed them directly
   */
  async loadVerificationRules() {
    return this.getRulesProgram();
  }

  /**
   * Get the Prolog rules program
   */
  getRulesProgram() {
    return `
      % Helper: member/2 (not built-in to Tau Prolog)
      member(X, [X|_]).
      member(X, [_|T]) :- member(X, T).

      % Valid coordinates
      coord(0). coord(1). coord(2).
      valid_pos(X, Y) :- coord(X), coord(Y).

      % Spatial relations
      north(pos(X, Y1), pos(X, Y2)) :- Y1 > Y2.
      south(pos(X, Y1), pos(X, Y2)) :- Y1 < Y2.
      east(pos(X1, Y), pos(X2, Y)) :- X1 > X2.
      west(pos(X1, Y), pos(X2, Y)) :- X1 < X2.
      northeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 > Y2.
      northwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 > Y2.
      southeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 < Y2.
      southwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 < Y2.
      same_location(pos(X, Y), pos(X, Y)).

      % Verification
      verify_spatial_question(EntityPositions, Premises, Conclusion, ClaimedAnswer) :-
          check_valid_positions(EntityPositions),
          check_distinct_positions(EntityPositions),
          verify_all_premises(Premises, EntityPositions),
          Conclusion = conclusion(Relation, Entity1, Entity2),
          get_position(Entity1, EntityPositions, Pos1),
          get_position(Entity2, EntityPositions, Pos2),
          (holds_relation(Relation, Pos1, Pos2) -> ActualAnswer = true ; ActualAnswer = false),
          ActualAnswer = ClaimedAnswer.

      check_valid_positions([]).
      check_valid_positions([entity(_, pos(X, Y)) | Rest]) :-
          valid_pos(X, Y),
          check_valid_positions(Rest).

      check_distinct_positions([]).
      check_distinct_positions([entity(_, Pos) | Rest]) :-
          \\+ member(entity(_, Pos), Rest),
          check_distinct_positions(Rest).

      verify_all_premises([], _).
      verify_all_premises([premise(Relation, Entity1, Entity2) | Rest], EntityPositions) :-
          get_position(Entity1, EntityPositions, Pos1),
          get_position(Entity2, EntityPositions, Pos2),
          holds_relation(Relation, Pos1, Pos2),
          verify_all_premises(Rest, EntityPositions).

      get_position(EntityName, [entity(EntityName, Pos) | _], Pos) :- !.
      get_position(EntityName, [_ | Rest], Pos) :-
          get_position(EntityName, Rest, Pos).

      holds_relation(north, Pos1, Pos2) :- north(Pos1, Pos2).
      holds_relation(south, Pos1, Pos2) :- south(Pos1, Pos2).
      holds_relation(east, Pos1, Pos2) :- east(Pos1, Pos2).
      holds_relation(west, Pos1, Pos2) :- west(Pos1, Pos2).
      holds_relation(northeast, Pos1, Pos2) :- northeast(Pos1, Pos2).
      holds_relation(northwest, Pos1, Pos2) :- northwest(Pos1, Pos2).
      holds_relation(southeast, Pos1, Pos2) :- southeast(Pos1, Pos2).
      holds_relation(southwest, Pos1, Pos2) :- southwest(Pos1, Pos2).
      holds_relation(same_location, Pos1, Pos2) :- same_location(Pos1, Pos2).
    `;
  }

  /**
   * Verify a spatial question
   *
   * @param {Object} question - The generated question
   * @param {SpatialGrid} spatialGrid - The grid used to generate the question
   * @returns {Promise<Object>} { valid: boolean, error?: string }
   */
  async verifyQuestion(question, spatialGrid) {
    if (!this.initialized) {
      return {
        valid: true,
        warning: "Verification disabled (Prolog not ready)",
      };
    }

    try {
      // Create a fresh session for this verification
      const pl = typeof window !== "undefined" ? window.pl : global.pl;
      const freshSession = pl.create();

      // Load rules into fresh session
      const program = this.loadVerificationRulesSync();
      freshSession.consult(program);

      // Extract data from question
      const { network, conclusion } = question;

      // Build entity positions for Prolog
      const entityPositions = this.buildEntityPositions(network, spatialGrid);

      // Build premises for Prolog
      const premises = this.buildPremises(network);

      // Build conclusion for Prolog
      const prologConclusion = this.buildConclusion(conclusion);

      // Get claimed answer (from question, not conclusion relation)
      const claimedAnswer = question.isValid;

      // Create Prolog query
      const query = this.buildQuery(
        entityPositions,
        premises,
        prologConclusion,
        claimedAnswer,
      );

      // Execute verification (wrap in Promise to handle async answer)
      freshSession.query(query);

      // Wrap answer in Promise
      return await new Promise((resolve) => {
        freshSession.answer((answer) => {
          const pl = typeof window !== "undefined" ? window.pl : global.pl;

          if (pl.type.is_substitution(answer)) {
            resolve({ valid: true });
          } else if (pl.type.is_error(answer)) {
            const errorMsg = pl.format_answer(answer);
            resolve({
              valid: false,
              error: "Prolog error: " + errorMsg,
              details: { query },
            });
          } else {
            resolve({
              valid: false,
              error: "Verification failed: Question is logically inconsistent",
              details: {
                entityPositions,
                premises,
                prologConclusion,
                claimedAnswer,
                query,
              },
            });
          }
        });
      });
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error.message}`,
      };
    }
  }

  /**
   * Build entity positions for Prolog
   * Format: [entity(name, pos(X, Y)), ...]
   */
  buildEntityPositions(network, spatialGrid) {
    const positions = [];
    for (const entity of network.entities.values()) {
      const pos = spatialGrid.getPosition(entity);
      if (pos) {
        positions.push(`entity(${entity.id}, pos(${pos[0]}, ${pos[1]}))`);
      }
    }
    return `[${positions.join(", ")}]`;
  }

  /**
   * Build premises for Prolog
   * Format: [premise(relation, entity1, entity2), ...]
   */
  buildPremises(network) {
    const premises = [];
    for (const relation of network.relations) {
      const relationName = this.vectorToRelationName(
        relation.properties.vector,
      );
      const e1 = relation.entities[0].id;
      const e2 = relation.entities[1].id;
      premises.push(`premise(${relationName}, ${e1}, ${e2})`);
    }
    return `[${premises.join(", ")}]`;
  }

  /**
   * Build conclusion for Prolog
   * Format: conclusion(relation, entity1, entity2)
   */
  buildConclusion(conclusion) {
    // conclusion is a Relation object directly, not { relation: ... }
    const relationName = this.vectorToRelationName(
      conclusion.properties.vector,
    );
    const e1 = conclusion.entities[0].id;
    const e2 = conclusion.entities[1].id;
    return `conclusion(${relationName}, ${e1}, ${e2})`;
  }

  /**
   * Build Prolog query
   */
  buildQuery(entityPositions, premises, conclusion, claimedAnswer) {
    return `verify_spatial_question(${entityPositions}, ${premises}, ${conclusion}, ${claimedAnswer}).`;
  }

  /**
   * Convert vector to relation name
   * Normalizes the vector first
   */
  vectorToRelationName(vector) {
    // Normalize vector
    const normalized = vector.map((v) => (v === 0 ? 0 : v / Math.abs(v)));
    const [x, y] = normalized;

    // Map to relation name
    if (x === 0 && y === 1) return "north";
    if (x === 0 && y === -1) return "south";
    if (x === 1 && y === 0) return "east";
    if (x === -1 && y === 0) return "west";
    if (x === 1 && y === 1) return "northeast";
    if (x === -1 && y === 1) return "northwest";
    if (x === 1 && y === -1) return "southeast";
    if (x === -1 && y === -1) return "southwest";
    if (x === 0 && y === 0) return "same_location";

    throw new Error(`Unknown vector: [${x}, ${y}]`);
  }
}
