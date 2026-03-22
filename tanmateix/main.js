import { PathBasedQuestionGenerator } from "./generators/PathBasedQuestionGenerator.js";
import { RandomUtils } from "./utils/RandomUtils.js";
import { EntityFactory } from "./utils/EntityFactory.js";
import { Renderer } from "./render/Renderer.js";
import { saveSession } from "./storage.js";
import { openHistoryModal } from "./history.js";
import { FireSystem } from "../shared/fire.js";
import {
  initHaptic,
  triggerHaptic,
  triggerHapticError,
} from "../shared/haptic.js";
import "./faker.js";

// Timing milestones for linear interpolation
const TIERS = [
  { level: 1, linear: 4.0, spatial: 6.0, syllogistic: 6.0, buffer: 4.0 },
  { level: 4, linear: 3.0, spatial: 4.5, syllogistic: 4.5, buffer: 3.0 },
  { level: 7, linear: 2.0, spatial: 3.0, syllogistic: 3.0, buffer: 2.5 },
  { level: 10, linear: 1.5, spatial: 2.25, syllogistic: 2.25, buffer: 2.0 },
];

function getTimingConfig(currentLevel) {
  // 1. Handle "Grandmaster" territory (Level 10+)
  if (currentLevel >= 10) {
    return TIERS[TIERS.length - 1]; // Cap at the hardest setting
  }

  // 2. Find which two tiers we are sandwiched between
  // We look for the first tier that is *higher* than our current level
  let upperIndex = TIERS.findIndex((t) => t.level > currentLevel);
  let lowerTier = TIERS[upperIndex - 1];
  let upperTier = TIERS[upperIndex];

  // 3. Calculate how far we are between them (0.0 to 1.0)
  let range = upperTier.level - lowerTier.level;
  let progress = (currentLevel - lowerTier.level) / range;

  // 4. Lerp (Linear Interpolate) the values
  const lerp = (start, end, pct) => start + (end - start) * pct;

  return {
    linear: lerp(lowerTier.linear, upperTier.linear, progress),
    spatial: lerp(lowerTier.spatial, upperTier.spatial, progress),
    syllogistic: lerp(lowerTier.syllogistic, upperTier.syllogistic, progress),
    buffer: lerp(lowerTier.buffer, upperTier.buffer, progress),
  };
}

// Game state
const gameState = {
  score: 0,
  total: 30,
  questionNumber: 1,
  currentQuestion: null,
  answered: false,
  consecutiveCorrect: 0,
  maxStreak: 0, // Track highest streak achieved
  difficulty: {
    level: 1, // Overall difficulty level (1-10+)
    numPaths: 1, // Number of independent paths (1-5)
    entitiesPerPath: 3, // Entities per path (3-5)
  },
  timer: null,
  timeRemaining: 30,
  isPaused: false,
  timerEnabled: true, // Whether to use timer or practice mode
  questionHistory: [], // Track all questions for export
};

// Setup
const random = new RandomUtils();
const entityFactory = new EntityFactory({ useIcons: true }, random);

const generator = new PathBasedQuestionGenerator({
  entityFactory,
  linearDimensions: [
    "size",
    "speed",
    "brightness",
    "temperature",
    "weight",
    "height",
    "age",
    "temporal",
    "distance",
    "depth",
    "width",
    "length",
    "volume",
    "density",
    "hardness",
    "cost",
    "difficulty",
    "strength",
    "power",
    "value",
    "quality",
    "rank",
    "quantity",
    "latency",
    "throughput",
    "availability",
    "error_rate",
    "reliability",
  ],
  random,
});

const renderer = new Renderer();

// Calculate time limit based on question and difficulty level
function calculateTimeLimit(question, level) {
  // Get interpolated timing config for this level
  const config = getTimingConfig(level);

  // Count premises (including the conclusion/question)
  const numPremises = question.premises.length + 1;

  // Detect relation type (check first premise)
  const relationType =
    question.premises[0]?.type?.constructor?.name || "LinearRelationType";
  const isSpatial = relationType === "SpatialRelationType";
  const isSyllogistic = relationType === "SyllogisticRelationType";

  // Get base TPP for relation type
  const tpp = isSpatial
    ? config.spatial
    : isSyllogistic
      ? config.syllogistic
      : config.linear;

  // Apply scroll discount for premises > 10
  // Premises 1-10: Full TPP
  // Premises 11+: 75% TPP (scanning/searching time)
  let premiseTime;
  if (numPremises <= 10) {
    premiseTime = numPremises * tpp;
  } else {
    // First 10 at full TPP, rest at 75%
    premiseTime = 10 * tpp + (numPremises - 10) * tpp * 0.75;
  }

  let timeLimit = Math.ceil(premiseTime + config.buffer);

  if (question.isIndeterminate) {
    timeLimit = Math.ceil(timeLimit * 1.2);
  }

  // Each distractor premise adds 0.5 × TPP extra time
  const distractorCount = question.metadata?.distractorCount ?? 0;
  if (distractorCount > 0) {
    timeLimit = Math.ceil(timeLimit + distractorCount * tpp * 0.5);
  }

  return timeLimit;
}

// Expose API for testing different configurations
window.tanmateix = {
  numPaths: 1, // Default to 1 path
  entitiesPerPath: 3, // Default to 3 entities (= 2 premises per path)
  generator: generator,
  gameState: gameState,

  // Generate a new question with current settings
  newQuestion: async () => {
    document.getElementById("start-screen").classList.remove("visible");

    const question = await generator.generateMultiPathQuestion(
      window.tanmateix.numPaths,
      window.tanmateix.entitiesPerPath,
    );
    gameState.currentQuestion = question;
    gameState.answered = false;

    // Render
    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    // Add event listeners to buttons
    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    // Update debug info
    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Quick test with different path counts
  test2Path: () => {
    window.tanmateix.numPaths = 2;
    return window.tanmateix.newQuestion();
  },
  test3Path: () => {
    window.tanmateix.numPaths = 3;
    return window.tanmateix.newQuestion();
  },
  test4Path: () => {
    window.tanmateix.numPaths = 4;
    return window.tanmateix.newQuestion();
  },

  // Quick test with longer paths (more premises per path)
  testLongPath: (entities = 5) => {
    window.tanmateix.entitiesPerPath = entities;
    window.tanmateix.numPaths = 1;
    return window.tanmateix.newQuestion();
  },

  // Force a spatial question (positional reasoning)
  testSpatial: async (entities = 3) => {
    document.getElementById("start-screen").classList.remove("visible");

    const question = await generator.generateMultiPathQuestion(1, entities, {
      forceRelationType: "Spatial",
    });
    gameState.currentQuestion = question;
    gameState.answered = false;

    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Force a syllogistic question (subset/disjoint reasoning)
  testSyllogistic: async (entities = 3) => {
    document.getElementById("start-screen").classList.remove("visible");

    const question = await generator.generateMultiPathQuestion(1, entities, {
      forceRelationType: "Syllogistic",
    });
    gameState.currentQuestion = question;
    gameState.answered = false;

    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Test spatial graph (fully-connected configuration)
  testSpatialGraph: async (entities = 3) => {
    document.getElementById("start-screen").classList.remove("visible");

    const question = await generator.generateSpatialGraphQuestion(entities);
    gameState.currentQuestion = question;
    gameState.answered = false;

    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Compare: path-based vs configuration-based spatial reasoning
  compareSpatial: () => {
    console.log("\n=== COMPARISON: Spatial Reasoning ===\n");

    console.log("Test 1: PATH-BASED (4 entities, 3 premises)");
    console.log("Mental task: Accumulate vectors along a chain (A→B→C→D)");
    console.log("Run: window.tanmateix.testLongPath(4)");

    console.log("\n---\n");

    console.log("Test 2: CONFIGURATION-BASED (3 entities, 3 premises)");
    console.log("Mental task: Understand spatial configuration (triangle)");
    console.log("Run: window.tanmateix.testSpatialGraph(3)");

    console.log("\nTry both and compare which feels better!");
  },

  // Turn off timer for testing
  timerOff: () => {
    if (gameState.timer) {
      clearInterval(gameState.timer);
      gameState.timer = null;
      console.log("⏸️  Timer stopped");
    }
  },

  // Turn on timer
  timerOn: () => {
    startTimer();
    console.log("▶️  Timer started");
  },
};

// Generate and display question
async function newQuestion() {
  let success = false;
  let attempts = 0;

  // Use difficulty settings (moved out of try-catch to keep 'level' in scope)
  const { numPaths, entitiesPerPath, level } = gameState.difficulty;

  while (!success && attempts < 50) {
    attempts++;
    try {
      // Reset entity factory so icon pool doesn't exhaust across questions
      entityFactory.reset();

      // Determine distractor count based on level
      let numDistractors = 0;
      if (level >= 6) {
        numDistractors = random.random() < 0.5 ? 2 : 1;
      } else if (level >= 3) {
        numDistractors = random.random() < 0.5 ? 1 : 0;
      }

      gameState.currentQuestion = await generator.generateMultiPathQuestion(
        numPaths,
        entitiesPerPath,
        { numDistractors },
      );
      success = true;
    } catch (err) {
      console.error(`❌ Q gen fallback (attempt ${attempts}):`, err);
      if (attempts >= 50) throw err;
    }
  }
  gameState.answered = false;

  // Calculate time limit dynamically based on question and level
  const timeLimit = calculateTimeLimit(gameState.currentQuestion, level);
  gameState.timeRemaining = timeLimit;

  // Log timing info (helpful for debugging)
  const relationType =
    gameState.currentQuestion.premises[0]?.type?.constructor?.name || "Unknown";
  const numPremises = gameState.currentQuestion.premises.length + 1;
  const scrollDiscount = numPremises > 10 ? " 📜" : "";
  const config = getTimingConfig(level);
  const tppUsed =
    relationType === "SpatialRelationType"
      ? config.spatial
      : relationType === "SyllogisticRelationType"
        ? config.syllogistic
        : config.linear;
  console.log(
    `⏱️  Time: ${timeLimit}s (L${level}, ${numPremises}p × ${tppUsed.toFixed(2)}s + ${config.buffer.toFixed(1)}s${scrollDiscount})`,
  );

  // Render
  const container = document.getElementById("game-container");
  container.innerHTML = renderer.renderGameUI(gameState.currentQuestion);

  // Add event listeners to buttons
  container.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", handleAnswer);
  });

  // Update debug info
  const debugInfo = document.getElementById("debug-info");
  debugInfo.innerHTML = renderer.renderNetworkInfo(gameState.currentQuestion);

  // Show/hide timer based on mode
  const progressContainer = document.querySelector(".progress-container");
  if (gameState.timerEnabled) {
    progressContainer.style.display = "block";
    startTimer();
  } else {
    // Practice mode: hide timer
    progressContainer.style.display = "none";
  }
}

// Timer functions
function startTimer() {
  // Clear existing timer
  if (gameState.timer) {
    clearInterval(gameState.timer);
  }

  // Update display instantly (no transition)
  updateTimerDisplay(true);

  // Start countdown
  gameState.timer = setInterval(() => {
    if (!gameState.isPaused) {
      gameState.timeRemaining--;
      updateTimerDisplay();

      if (gameState.timeRemaining <= 0) {
        clearInterval(gameState.timer);
        if (!gameState.answered) {
          handleTimeout();
        }
      }
    }
  }, 1000);
}

// Pause/Resume functions
function togglePause() {
  if (gameState.answered) return; // Can't pause between questions
  if (!gameState.timerEnabled) return; // No pause in practice mode

  gameState.isPaused = !gameState.isPaused;
  const overlay = document.getElementById("pause-overlay");

  if (gameState.isPaused) {
    overlay.classList.add("visible");
  } else {
    // Add 5 seconds on resume (capped at time limit)
    const timeLimit = calculateTimeLimit(
      gameState.currentQuestion,
      gameState.difficulty.level,
    );
    gameState.timeRemaining = Math.min(gameState.timeRemaining + 5, timeLimit);
    updateTimerDisplay(true); // Instant update on resume

    overlay.classList.remove("visible");
  }
}

function updateTimerDisplay(instant = false) {
  const progressBar = document.getElementById("progress");
  // Calculate time limit for current question
  const timeLimit = gameState.currentQuestion
    ? calculateTimeLimit(gameState.currentQuestion, gameState.difficulty.level)
    : 30; // fallback for initialization
  const percentage = (gameState.timeRemaining / timeLimit) * 100;

  // Disable transition for instant updates (start/resume)
  if (instant) {
    progressBar.style.transition = "none";
    progressBar.style.width = `${percentage}%`;
    // Force reflow
    progressBar.offsetHeight;
    // Re-enable transition
    progressBar.style.transition = "";
  } else {
    progressBar.style.width = `${percentage}%`;
  }

  // Color coding
  if (gameState.timeRemaining <= 5) {
    progressBar.style.background = "var(--error)";
  } else if (gameState.timeRemaining <= 10) {
    progressBar.style.background = "var(--gold)";
  } else {
    progressBar.style.background = "var(--accent)";
  }
}

function handleTimeout() {
  gameState.answered = true;
  gameState.consecutiveCorrect = 0;

  // Decrease difficulty on timeout
  decreaseDifficulty();

  // Track question for export (timeout = wrong answer)
  gameState.questionHistory.push({
    questionNumber: gameState.questionNumber,
    question: gameState.currentQuestion,
    userAnswer: null, // timeout
    correctAnswer: gameState.currentQuestion.isIndeterminate
      ? "indeterminate"
      : gameState.currentQuestion.isValid,
    correct: false,
  });

  // Visual feedback
  showFeedback(false);

  // Disable buttons
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  });

  // Auto-advance
  setTimeout(async () => {
    if (gameState.questionNumber < gameState.total) {
      gameState.questionNumber++;
      updateProgress();
      updateStreak();
      try {
        await newQuestion();
      } catch (err) {
        console.error("Q gen failed:", err);
        showGameOver();
      }
    } else {
      showGameOver();
    }
  }, 400);
}

// Handle answer
function handleAnswer(e) {
  if (gameState.answered) return;

  const answerStr = e.currentTarget.dataset.answer; // "true", "false", "indeterminate"
  const q = gameState.currentQuestion;
  let correct;
  if (q.isIndeterminate) {
    correct = answerStr === "indeterminate";
  } else {
    correct = (answerStr === "true") === q.isValid;
  }

  gameState.answered = true;
  clearInterval(gameState.timer);

  // Track question for export
  gameState.questionHistory.push({
    questionNumber: gameState.questionNumber,
    question: gameState.currentQuestion,
    userAnswer: answerStr,
    correctAnswer: q.isIndeterminate ? "indeterminate" : q.isValid,
    correct: correct,
  });

  // Update streak and score
  if (correct) {
    gameState.score++;
    gameState.consecutiveCorrect++;

    // Track max streak
    if (gameState.consecutiveCorrect > gameState.maxStreak) {
      gameState.maxStreak = gameState.consecutiveCorrect;
    }

    updateScore();

    // Check for difficulty increase (every 2 correct)
    if (
      gameState.consecutiveCorrect > 0 &&
      gameState.consecutiveCorrect % 2 === 0
    ) {
      increaseDifficulty();
    }
  } else {
    gameState.consecutiveCorrect = 0;
    // Decrease difficulty on wrong answer
    decreaseDifficulty();
  }

  // Haptic + visual feedback
  if (correct) triggerHaptic();
  else triggerHapticError();
  showFeedback(correct);

  // Disable buttons
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  });

  // Auto-advance after shorter delay (snappier!)
  setTimeout(async () => {
    if (gameState.questionNumber < gameState.total) {
      gameState.questionNumber++;
      updateProgress();
      updateStreak();
      try {
        await newQuestion();
      } catch (err) {
        console.error("Q gen failed:", err);
        showGameOver();
      }
    } else {
      showGameOver();
    }
  }, 400);
}

// Increase difficulty (every 2 correct answers)
function increaseDifficulty() {
  const diff = gameState.difficulty;

  // Build weighted options: 50% level, 25% entities, 25% paths
  // Each entry represents its probability
  const options = [];

  // Level always available (50% chance = 2 entries)
  options.push("level", "level");

  // Entities (25% chance = 1 entry)
  if (diff.entitiesPerPath < 5) options.push("entities");

  // Paths (25% chance = 1 entry)
  if (diff.numPaths < 5) options.push("paths");

  if (options.length === 0) {
    console.log("🏆 Maximum difficulty reached!");
    return;
  }

  // Weighted random selection
  const dimension = options[Math.floor(Math.random() * options.length)];

  if (dimension === "level") {
    diff.level++;
    console.log(`📊 Level ${diff.level} (⏱️  tighter timing)`);
  } else if (dimension === "paths") {
    diff.numPaths++;
    console.log(
      `📈 Difficulty +1: ${diff.numPaths} paths (🔀 more confounders)`,
    );
  } else if (dimension === "entities") {
    diff.entitiesPerPath++;
    console.log(
      `📈 Difficulty +1: ${diff.entitiesPerPath} entities per path (⛓️  longer chains)`,
    );
  }

  updateLevel();
}

// Decrease difficulty (on wrong answer or timeout)
function decreaseDifficulty() {
  const diff = gameState.difficulty;

  // Build weighted options: 50% level, 25% entities, 25% paths
  // Each entry represents its probability
  const options = [];

  // Level (50% chance = 2 entries) - only if above minimum
  if (diff.level > 1) {
    options.push("level", "level");
  }

  // Entities (25% chance = 1 entry)
  if (diff.entitiesPerPath > 3) options.push("entities");

  // Paths (25% chance = 1 entry)
  if (diff.numPaths > 1) options.push("paths");

  // Don't decrease if already at minimum
  if (options.length === 0) {
    console.log("💪 Already at minimum difficulty");
    return;
  }

  // Weighted random selection
  const dimension = options[Math.floor(Math.random() * options.length)];

  if (dimension === "level") {
    diff.level--;
    console.log(`📊 Level ${diff.level} (⏱️  more time)`);
  } else if (dimension === "paths") {
    diff.numPaths--;
    console.log(
      `📉 Difficulty -1: ${diff.numPaths} paths (🔀 fewer confounders)`,
    );
  } else if (dimension === "entities") {
    diff.entitiesPerPath--;
    console.log(
      `📉 Difficulty -1: ${diff.entitiesPerPath} entities per path (⛓️  shorter chains)`,
    );
  }

  updateLevel();
}

// Update level display
function updateLevel() {
  document.getElementById("lbl-level").textContent = gameState.difficulty.level;
}

// Update streak display
function updateStreak() {
  document.getElementById("lbl-streak").textContent =
    gameState.consecutiveCorrect;
}

// Show feedback
function showFeedback(correct) {
  const container = document.getElementById("game-container");
  const className = correct ? "flash-correct" : "flash-incorrect";

  container.classList.add(className);
  setTimeout(() => {
    container.classList.remove(className);
  }, 400);
}

// Update score
function updateScore() {
  document.getElementById("lbl-score").textContent = gameState.score;
}

// Update progress
function updateProgress() {
  document.getElementById("lbl-question").textContent =
    `Q${gameState.questionNumber}/${gameState.total}`;
  setBrainFill((gameState.questionNumber - 1) / gameState.total);
}

// Show game over
function showGameOver() {
  clearInterval(gameState.timer);
  setBrainFill(1);
  const questionsAnswered =
    gameState.questionNumber >= gameState.total
      ? gameState.total
      : gameState.questionNumber - 1;
  const denominator = questionsAnswered > 0 ? questionsAnswered : 1;
  const accuracy = Math.round((gameState.score / denominator) * 100);
  saveSession({
    score: gameState.score,
    accuracy,
    maxStreak: gameState.maxStreak,
    finalLevel: gameState.difficulty.level,
    total: denominator,
  });
  const container = document.getElementById("game-container");
  const percentage = accuracy;
  const finalLevel = gameState.difficulty.level;

  container.innerHTML = `
    <div class="premises-container" style="text-align: center; padding: 40px;">
        <h2 style="color: var(--accent); font-size: 2rem; margin-bottom: 20px;">Game Complete!</h2>
        <div style="font-size: 3rem; margin: 30px 0;">
            ${percentage >= 80 ? "🏆" : percentage >= 60 ? "🎯" : "💪"}
        </div>
        <div style="font-size: 1.5rem; margin-bottom: 20px;">
            Score: <span style="color: var(--success); font-weight: bold;">${gameState.score}</span> / ${denominator}
        </div>
        <div style="font-size: 1.2rem; margin-bottom: 20px;">
            Accuracy: <span style="color: var(--accent); font-weight: bold;">${percentage}%</span>
        </div>
        <div style="font-size: 1.1rem; margin-bottom: 20px; opacity: 0.8;">
            Max Streak: <span style="color: var(--gold); font-weight: bold;">${gameState.maxStreak}</span>
        </div>
        <div style="font-size: 1.1rem; margin-bottom: 30px; opacity: 0.7;">
            Final Level: <span style="font-weight: bold;">${finalLevel}</span>
        </div>
        <div style="font-size: 1rem; margin-bottom: 30px; opacity: 0.8;">
            ${percentage >= 80 ? "Outstanding reasoning!" : percentage >= 60 ? "Great job!" : "Keep practicing!"}
        </div>
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button id="play-again-practice" class="resume-btn">
            <i class="ph-light ph-play"></i>
          </button>
          <button id="play-again-timed" class="resume-btn">
            <i class="ph-light ph-clock"></i>
          </button>
        </div>
        <a href="../" style="display:block;margin-top:1.25rem;font-size:0.85rem;color:var(--text-muted,#64748b);text-decoration:none;text-align:center;">← Back to hub</a>
    </div>
`;

  // Add event listeners to Play Again buttons
  document
    .getElementById("play-again-practice")
    .addEventListener("click", () => {
      triggerHaptic();
      gameState.timerEnabled = false;
      document.querySelector(".progress-container").style.display = "none";
      restartGame();
    });

  document.getElementById("play-again-timed").addEventListener("click", () => {
    triggerHaptic();
    gameState.timerEnabled = true;
    document.querySelector(".progress-container").style.display = "block";
    restartGame();
  });
}

// Restart game function
function restartGame() {
  clearInterval(gameState.timer);
  gameState.timer = null;
  setBrainFill(0);
  gameState.score = 0;
  gameState.questionNumber = 1;
  gameState.consecutiveCorrect = 0;
  gameState.maxStreak = 0;
  gameState.questionHistory = []; // Clear question history
  gameState.difficulty = {
    level: 1,
    numPaths: 1,
    entitiesPerPath: 3,
  };
  updateScore();
  updateProgress();
  updateStreak();
  updateLevel();

  // Show start screen to choose mode again
  const startScreen = document.getElementById("start-screen");
  startScreen.classList.add("visible");
}

// Export question history as markdown
function exportQuestions() {
  if (gameState.questionHistory.length === 0) {
    alert("No questions to export yet!");
    return;
  }

  let markdown = `# Tanmateix Question History\n\n`;
  markdown += `**Session Date:** ${new Date().toLocaleString()}\n`;
  markdown += `**Questions Answered:** ${gameState.questionHistory.length}\n`;
  markdown += `**Score:** ${gameState.score}/${gameState.questionHistory.length}\n\n`;
  markdown += `---\n\n`;

  gameState.questionHistory.forEach((entry) => {
    const q = entry.question;
    const relationType = q.premises[0]?.type?.name || "Unknown";

    markdown += `## Question ${entry.questionNumber}\n\n`;
    markdown += `**Type:** ${relationType}\n\n`;

    // For spatial, add grid
    if (relationType === "Spatial" && q.metadata?.spatialGrid) {
      markdown += `\`\`\`\n${q.metadata.spatialGrid.toString()}\`\`\`\n\n`;
    }

    // Premises
    markdown += `**Premises:**\n`;
    q.premises.forEach((p, i) => {
      markdown += `${i + 1}. ${p.entities[0].displayValue} ${p.properties.text} ${p.entities[1].displayValue}\n`;
    });

    // Conclusion
    markdown += `\n**Question:**\n`;
    markdown += `${q.conclusion.entities[0].displayValue} ${q.conclusion.properties.text} ${q.conclusion.entities[1].displayValue}\n\n`;

    // Answers
    markdown += `**Correct Answer:** ${q.isValid ? "True" : "False"}\n`;
    markdown += `**Your Answer:** ${entry.userAnswer === null ? "Timeout" : entry.userAnswer ? "True" : "False"}\n`;
    markdown += `**Result:** ${entry.correct ? "✓ Correct" : "✗ Wrong"}\n\n`;
    markdown += `---\n\n`;
  });

  // Share using Web Share API if available
  const filename = `tanmateix-questions-${Date.now()}.md`;

  // Helper to download file
  const downloadFile = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (navigator.share && navigator.canShare) {
    const file = new File([markdown], filename, { type: "text/markdown" });

    if (navigator.canShare({ files: [file] })) {
      navigator
        .share({
          files: [file],
          title: "Tanmateix Question History",
        })
        .catch((err) => {
          console.error("Share failed:", err);
          // Fallback to download on error (permission denied, etc.)
          downloadFile();
        });
    } else {
      // Fallback: share as text
      navigator
        .share({
          text: markdown,
          title: "Tanmateix Question History",
        })
        .catch((err) => {
          console.error("Share failed:", err);
          // Fallback to download on error
          downloadFile();
        });
    }
  } else {
    // Fallback: download
    downloadFile();
  }
}

// ── Brain / Fire ──────────────────────────────────────────────────────────────

function setBrainFill(progress) {
  const inset = Math.round(88 - progress * (88 - 8));
  document
    .querySelector(".brain-progress-fill")
    .style.setProperty("--progress-inset", inset + "%");
  document
    .querySelector(".brain-fire-fill")
    .style.setProperty("--fire-inset", inset + "%");
  FireSystem.update(progress, inset);
}

// Don't start game automatically - wait for start button
FireSystem.init();
initHaptic();
setBrainFill(0);
updateScore();
updateProgress();
updateStreak();
updateLevel();

// Fetch and display version from manifest.json
fetch("manifest.json")
  .then((res) => res.json())
  .then((manifest) => {
    const versionDisplay = document.getElementById("version-display");
    const startVersionDisplay = document.getElementById(
      "start-version-display",
    );
    if (versionDisplay && manifest.version) {
      versionDisplay.textContent = `v${manifest.version}`;
    }
    const headerVersion = document.getElementById("version-header");
    if (headerVersion && manifest.version) {
      headerVersion.textContent = `v${manifest.version}`;
    }
    if (startVersionDisplay && manifest.version) {
      startVersionDisplay.textContent = `v${manifest.version}`;
    }
  })
  .catch((err) => {
    console.warn("Could not load version from manifest:", err);
  });

// Info modal handlers
const modal = document.getElementById("info-modal");
const openBtn = document.getElementById("game-info-btn");
const closeBtn = document.getElementById("info-modal-close");
const exportBtn = document.getElementById("export-questions-btn");

openBtn.addEventListener("click", () => {
  modal.classList.add("visible");
  // Pause timer when modal opens
  if (!gameState.answered && !gameState.isPaused) {
    gameState.isPaused = true;
  }
});

exportBtn.addEventListener("click", () => {
  exportQuestions();
});

closeBtn.addEventListener("click", () => {
  modal.classList.remove("visible");
  // Resume timer when modal closes
  if (!gameState.answered && gameState.isPaused) {
    gameState.isPaused = false;
  }
});

// Close on overlay click
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("visible");
    // Resume timer when modal closes
    if (!gameState.answered && gameState.isPaused) {
      gameState.isPaused = false;
    }
  }
});

// Restart button
document.getElementById("restart-btn").addEventListener("click", () => {
  triggerHaptic();
  restartGame();
});

// Brain = stats button
document.getElementById("stats-btn").addEventListener("click", () => {
  openHistoryModal();
});

// History modal close
document.getElementById("close-history-btn").addEventListener("click", () => {
  document.getElementById("history-modal").classList.remove("visible");
});
document.getElementById("history-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("history-modal"))
    document.getElementById("history-modal").classList.remove("visible");
});

// Start game handlers
const startBtnPractice = document.getElementById("start-btn-practice");
const startBtnTimed = document.getElementById("start-btn-timed");
const startScreen = document.getElementById("start-screen");

startBtnPractice.addEventListener("click", () => {
  triggerHaptic();
  gameState.timerEnabled = false;
  startScreen.classList.remove("visible");
  document.querySelector(".progress-container").style.display = "none";
  newQuestion();
});

startBtnTimed.addEventListener("click", () => {
  triggerHaptic();
  gameState.timerEnabled = true;
  startScreen.classList.remove("visible");
  document.querySelector(".progress-container").style.display = "block";
  newQuestion();
});

// Pause/Resume handlers
const resumeBtn = document.getElementById("resume-btn");
const progressContainer = document.querySelector(".progress-container");

progressContainer.addEventListener("click", () => {
  triggerHaptic();
  togglePause();
});
resumeBtn.addEventListener("click", () => {
  triggerHaptic();
  togglePause();
});

// Keyboard shortcut (Space to toggle pause)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !modal.classList.contains("visible")) {
    e.preventDefault();
    togglePause();
  }
});
