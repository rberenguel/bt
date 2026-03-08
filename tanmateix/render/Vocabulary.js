/**
 * Vocabulary registry - maps semantic properties to actual text
 * Completely separate from logic layer
 */

export const LINEAR_VOCABULARIES = {
  size: {
    forward: ["is larger than", "is bigger than"],
    backward: ["is smaller than", "is less than"],
    equal: ["is equal to", "is the same size as"],
    minimal: { forward: ">", backward: "<", equal: "=" },
  },
  speed: {
    forward: ["is faster than", "is quicker than", "outpaces"],
    backward: ["is slower than"],
    equal: ["has the same speed as", "matches the speed of"],
    minimal: { forward: ">>", backward: "<<", equal: "=" },
  },
  brightness: {
    forward: ["is brighter than"],
    backward: ["is dimmer than", "is less bright than"],
    equal: ["has the same brightness as"],
    minimal: { forward: "☀>", backward: "<☀", equal: "=" },
  },
  temperature: {
    forward: ["is hotter than", "is warmer than"],
    backward: ["is cooler than", "is colder than"],
    equal: ["has the same temperature as"],
    minimal: { forward: "🔥>", backward: "<🔥", equal: "=" },
  },
  weight: {
    forward: ["is heavier than", "weighs more than"],
    backward: ["is lighter than", "weighs less than"],
    equal: ["weighs the same as"],
    minimal: { forward: "⚖>", backward: "<⚖", equal: "=" },
  },
  height: {
    forward: ["is taller than"],
    backward: ["is shorter than"],
    equal: ["is the same height as"],
    minimal: { forward: "↑", backward: "↓", equal: "=" },
  },
  age: {
    forward: ["is older than"],
    backward: ["is younger than", "is newer than"],
    equal: ["is the same age as"],
    minimal: { forward: "⏳>", backward: "<⏳", equal: "=" },
  },
  temporal: {
    forward: ["is before", "comes before"],
    backward: ["is after", "comes after"],
    equal: ["is at the same time as", "occurs simultaneously with"],
    minimal: { forward: "→", backward: "←", equal: "=" },
  },
  distance: {
    forward: ["is farther than", "is more distant than"],
    backward: ["is closer than", "is nearer than"],
    equal: ["is the same distance as", "is equidistant with"],
    minimal: { forward: "📏>", backward: "<📏", equal: "=" },
  },
  depth: {
    forward: ["is deeper than"],
    backward: ["is shallower than"],
    equal: ["is the same depth as"],
    minimal: { forward: "🌊>", backward: "<🌊", equal: "=" },
  },
  width: {
    forward: ["is wider than", "is broader than"],
    backward: ["is narrower than"],
    equal: ["is the same width as"],
    minimal: { forward: "↔>", backward: "<↔", equal: "=" },
  },
  length: {
    forward: ["is longer than"],
    backward: ["is shorter than"],
    equal: ["is the same length as"],
    minimal: { forward: "↕>", backward: "<↕", equal: "=" },
  },
  volume: {
    forward: ["is louder than"],
    backward: ["is quieter than", "is softer than"],
    equal: ["is the same volume as"],
    minimal: { forward: "🔊>", backward: "<🔊", equal: "=" },
  },
  density: {
    forward: ["is denser than", "is more dense than"],
    backward: ["is less dense than"],
    equal: ["has the same density as"],
    minimal: { forward: "⚛>", backward: "<⚛", equal: "=" },
  },
  hardness: {
    forward: ["is harder than"],
    backward: ["is softer than"],
    equal: ["is as hard as"],
    minimal: { forward: "💎>", backward: "<💎", equal: "=" },
  },
  cost: {
    forward: ["is more expensive than", "costs more than"],
    backward: ["is cheaper than", "costs less than"],
    equal: ["costs the same as"],
    minimal: { forward: "💰>", backward: "<💰", equal: "=" },
  },
  difficulty: {
    forward: ["is harder than", "is more difficult than"],
    backward: ["is easier than", "is less difficult than"],
    equal: ["is as difficult as"],
    minimal: { forward: "🎯>", backward: "<🎯", equal: "=" },
  },
  strength: {
    forward: ["is stronger than"],
    backward: ["is weaker than"],
    equal: ["is as strong as"],
    minimal: { forward: "💪>", backward: "<💪", equal: "=" },
  },
  power: {
    forward: ["is more powerful than"],
    backward: ["is less powerful than"],
    equal: ["is as powerful as"],
    minimal: { forward: "⚡>", backward: "<⚡", equal: "=" },
  },
  value: {
    forward: ["is more valuable than"],
    backward: ["is less valuable than"],
    equal: ["is as valuable as"],
    minimal: { forward: "💎>", backward: "<💎", equal: "=" },
  },
  quality: {
    forward: ["is better than", "is of higher quality than"],
    backward: ["is worse than", "is of lower quality than"],
    equal: ["is as good as", "is of equal quality to"],
    minimal: { forward: "⭐>", backward: "<⭐", equal: "=" },
  },
  rank: {
    forward: ["is higher ranked than", "outranks"],
    backward: ["is lower ranked than", "is outranked by"],
    equal: ["is ranked the same as"],
    minimal: { forward: "🏆>", backward: "<🏆", equal: "=" },
  },
  quantity: {
    forward: ["has more than"],
    backward: ["has fewer than", "has less than"],
    equal: ["has the same quantity as"],
    minimal: { forward: "#>", backward: "<#", equal: "=" },
  },
  latency: {
    forward: ["has lower latency than", "has less latency than"],
    backward: ["has higher latency than", "has more latency than"],
    equal: ["has the same latency as"],
    minimal: { forward: "<⏱", backward: "⏱>", equal: "=" },
  },
  throughput: {
    forward: ["has higher throughput than", "has more throughput than"],
    backward: ["has lower throughput than", "has less throughput than"],
    equal: ["has the same throughput as"],
    minimal: { forward: "📊>", backward: "<📊", equal: "=" },
  },
  availability: {
    forward: ["is more available than", "has higher availability than"],
    backward: ["is less available than", "has lower availability than"],
    equal: ["has the same availability as"],
    minimal: { forward: "✅>", backward: "<✅", equal: "=" },
  },
  error_rate: {
    forward: ["has a lower error rate than", "has fewer errors than"],
    backward: ["has a higher error rate than", "has more errors than"],
    equal: ["has the same error rate as"],
    minimal: { forward: "<❌", backward: "❌>", equal: "=" },
  },
  reliability: {
    forward: ["is more reliable than"],
    backward: ["is less reliable than"],
    equal: ["is as reliable as"],
    minimal: { forward: "🔧>", backward: "<🔧", equal: "=" },
  },
};

// Spatial vocabularies split by style for consistency within a question
export const SPATIAL_VOCABULARIES = {
  2: {
    cardinal: {
      // Cardinal directions (north, south, east, west)
      "[1,0]": ["is east of"],
      "[-1,0]": ["is west of"],
      "[0,1]": ["is north of"],
      "[0,-1]": ["is south of"],
      "[1,1]": ["is northeast of"],
      "[1,-1]": ["is southeast of"],
      "[-1,1]": ["is northwest of"],
      "[-1,-1]": ["is southwest of"],
      "[0,0]": ["is at the same location as"],
    },
    relative: {
      // Relative directions (left, right, above, below)
      "[1,0]": ["is to the right of"],
      "[-1,0]": ["is to the left of"],
      "[0,1]": ["is above"],
      "[0,-1]": ["is below"],
      "[1,1]": ["is to the upper-right of"],
      "[1,-1]": ["is to the lower-right of"],
      "[-1,1]": ["is to the upper-left of"],
      "[-1,-1]": ["is to the lower-left of"],
      "[0,0]": ["is at the same location as"],
    },
  },
  3: {
    cardinal: {
      "[0,0,1]": ["is higher than"],
      "[0,0,-1]": ["is lower than"],
      "[1,0,0]": ["is east of"],
      "[-1,0,0]": ["is west of"],
      "[0,1,0]": ["is north of"],
      "[0,-1,0]": ["is south of"],
    },
  },
  4: {
    cardinal: {
      "[0,0,0,1]": ["in the future"],
      "[0,0,0,-1]": ["in the past"],
    },
  },
};

export const CATEGORICAL_VOCABULARIES = {
  same: ["is the same as", "is identical to", "matches"],
  different: ["is different from", "is opposite of", "differs from"],
};

export const SYLLOGISTIC_VOCABULARIES = {
  subset: [
    "are all",
    "are a type of",
    "are always",
    "belong to",
    "fall within",
  ],
  disjoint: [
    "are never",
    "cannot be",
    "are excluded from",
    "are incompatible with",
  ],
};

/**
 * Helper to pick random vocabulary
 */
export function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick a consistent vocabulary set for a linear dimension
 * Returns ONE choice for forward/backward/equal that will be used throughout
 */
export function pickLinearVocabulary(dimension) {
  const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;

  return {
    forward: pickRandom(vocab.forward),
    backward: pickRandom(vocab.backward),
    equal: pickRandom(vocab.equal),
  };
}

/**
 * Pick a consistent vocabulary set for spatial relations
 * Returns a mapping of vectors to their text
 */
export function pickSpatialVocabulary(dimensions, style = "cardinal") {
  const vocab =
    SPATIAL_VOCABULARIES[dimensions]?.[style] ||
    SPATIAL_VOCABULARIES[2].cardinal;
  const chosen = {};

  // For each vector, pick one phrase
  for (const [vectorKey, phrases] of Object.entries(vocab)) {
    chosen[vectorKey] = pickRandom(phrases);
  }

  return chosen;
}

/**
 * Get text for linear relation
 */
export function getLinearText(relation, minimal = false) {
  const { direction, dimension } = relation.properties;
  const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;

  if (minimal) {
    if (direction === 1) return vocab.minimal.forward;
    if (direction === -1) return vocab.minimal.backward;
    return vocab.minimal.equal;
  }

  if (direction === 1) return pickRandom(vocab.forward);
  if (direction === -1) return pickRandom(vocab.backward);
  return pickRandom(vocab.equal);
}

/**
 * Get text for spatial relation
 * Style should be consistent within a question (set via relation.properties.vocabStyle or default)
 */
export function getSpatialText(relation, minimal = false) {
  const { vector, vocabStyle } = relation.properties;
  const dimensions = vector.length;

  // Default to cardinal style if not specified
  const style = vocabStyle || "cardinal";
  const vocab =
    SPATIAL_VOCABULARIES[dimensions]?.[style] ||
    SPATIAL_VOCABULARIES[2].cardinal;

  // Normalize vector for vocabulary lookup (vectors may be raw for inference)
  const normalizedVector = vector.map((v) => {
    if (v === 0) return 0;
    return v / Math.abs(v);
  });

  const key = JSON.stringify(normalizedVector);
  const options = vocab[key];

  if (!options || options.length === 0) {
    // Fallback for complex vectors
    return describeVector(vector);
  }

  return pickRandom(options);
}

/**
 * Get text for categorical relation
 */
export function getCategoricalText(relation, minimal = false) {
  const { same } = relation.properties;
  const vocab = same
    ? CATEGORICAL_VOCABULARIES.same
    : CATEGORICAL_VOCABULARIES.different;
  return pickRandom(vocab);
}

/**
 * Get text for syllogistic relation
 */
export function getSyllogisticText(relation, minimal = false) {
  if (relation.properties.text) return relation.properties.text;
  const relType = relation.properties.relationType || "subset";
  return pickRandom(
    SYLLOGISTIC_VOCABULARIES[relType] || SYLLOGISTIC_VOCABULARIES.subset,
  );
}

/**
 * Fallback: describe vector in natural language
 */
function describeVector(vector) {
  const directions = [];

  if (vector[0] > 0) directions.push("east");
  if (vector[0] < 0) directions.push("west");
  if (vector[1] > 0) directions.push("north");
  if (vector[1] < 0) directions.push("south");

  if (vector.length >= 3) {
    if (vector[2] > 0) directions.push("above");
    if (vector[2] < 0) directions.push("below");
  }

  if (vector.length >= 4) {
    if (vector[3] > 0) return `in the future, ${directions.join("-")} of`;
    if (vector[3] < 0) return `in the past, ${directions.join("-")} of`;
  }

  if (directions.length === 0) return "at the same location as";
  return `is ${directions.join("-")} of`;
}

/**
 * Get relation text (main entry point)
 */
export function getRelationText(relation, minimal = false) {
  if (relation.type.name === "Linear") {
    return getLinearText(relation, minimal);
  } else if (relation.type.name === "Spatial") {
    return getSpatialText(relation, minimal);
  } else if (relation.type.name === "Categorical") {
    return getCategoricalText(relation, minimal);
  } else if (relation.type.name === "Syllogistic") {
    return getSyllogisticText(relation, minimal);
  }

  return "relates to";
}
