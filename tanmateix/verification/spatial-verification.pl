% Spatial Verification for 3x3 Grid Questions
%
% This verifies that generated spatial questions are logically consistent.
% Instead of exhaustive search, we do fast forward verification:
% "Does there exist a grid configuration where premises + conclusion are consistent?"

% --- Grid Definitions ---

% Valid coordinates (0-2 for 3x3 grid)
coord(0). coord(1). coord(2).

% A position is valid if both coordinates are in range
valid_pos(X, Y) :- coord(X), coord(Y).

% --- Spatial Relations (Y increases upward, X increases rightward) ---

% Cardinal directions (single axis movement)
north(pos(X, Y1), pos(X, Y2)) :- Y1 > Y2.
south(pos(X, Y1), pos(X, Y2)) :- Y1 < Y2.
east(pos(X1, Y), pos(X2, Y)) :- X1 > X2.
west(pos(X1, Y), pos(X2, Y)) :- X1 < X2.

% Ordinal directions (diagonal movement)
northeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 > Y2.
northwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 > Y2.
southeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 < Y2.
southwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 < Y2.

% Same location
same_location(pos(X, Y), pos(X, Y)).

% --- Verification Logic ---

% Verify a spatial question
% Inputs:
%   - EntityPositions: List of entity(name, pos(X,Y))
%   - Premises: List of premise(relation, entity1, entity2)
%   - Conclusion: conclusion(relation, entity1, entity2)
%   - ClaimedAnswer: true or false
%
% Succeeds if the question is valid (premises + conclusion are consistent with claimed answer)

verify_spatial_question(EntityPositions, Premises, Conclusion, ClaimedAnswer) :-
    % 1. Check all positions are valid and distinct
    check_valid_positions(EntityPositions),
    check_distinct_positions(EntityPositions),

    % 2. Verify all premises hold on this grid
    verify_all_premises(Premises, EntityPositions),

    % 3. Check if conclusion matches claimed answer
    Conclusion = conclusion(Relation, Entity1, Entity2),
    get_position(Entity1, EntityPositions, Pos1),
    get_position(Entity2, EntityPositions, Pos2),

    % Does the conclusion actually hold?
    (holds_relation(Relation, Pos1, Pos2) -> ActualAnswer = true ; ActualAnswer = false),

    % Verify claimed answer matches actual
    ActualAnswer = ClaimedAnswer.

% Check all positions are valid (within grid bounds)
check_valid_positions([]).
check_valid_positions([entity(_, pos(X, Y)) | Rest]) :-
    valid_pos(X, Y),
    check_valid_positions(Rest).

% Check all positions are distinct (no two entities at same location)
check_distinct_positions([]).
check_distinct_positions([entity(_, Pos) | Rest]) :-
    \+ member(entity(_, Pos), Rest),
    check_distinct_positions(Rest).

% Verify all premises hold
verify_all_premises([], _).
verify_all_premises([premise(Relation, Entity1, Entity2) | Rest], EntityPositions) :-
    get_position(Entity1, EntityPositions, Pos1),
    get_position(Entity2, EntityPositions, Pos2),
    holds_relation(Relation, Pos1, Pos2),
    verify_all_premises(Rest, EntityPositions).

% Get position of an entity
get_position(EntityName, [entity(EntityName, Pos) | _], Pos) :- !.
get_position(EntityName, [_ | Rest], Pos) :-
    get_position(EntityName, Rest, Pos).

% Check if a relation holds between two positions
holds_relation(north, Pos1, Pos2) :- north(Pos1, Pos2).
holds_relation(south, Pos1, Pos2) :- south(Pos1, Pos2).
holds_relation(east, Pos1, Pos2) :- east(Pos1, Pos2).
holds_relation(west, Pos1, Pos2) :- west(Pos1, Pos2).
holds_relation(northeast, Pos1, Pos2) :- northeast(Pos1, Pos2).
holds_relation(northwest, Pos1, Pos2) :- northwest(Pos1, Pos2).
holds_relation(southeast, Pos1, Pos2) :- southeast(Pos1, Pos2).
holds_relation(southwest, Pos1, Pos2) :- southwest(Pos1, Pos2).
holds_relation(same_location, Pos1, Pos2) :- same_location(Pos1, Pos2).
