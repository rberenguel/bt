const SHOW_GAME_SCORE = false;
let BACK = 1;
let triple = false;
let history = [];
let correctPosC = 0;
let correctColC = 0;
let correctLetC = 0;
let total = 0;
let cycles = 0; // A cycle is formed of rounds, rounds in a cycle are counted in "total"
window.active = false;
let timeRemaining;
let progressInterval;
let lastReply;
let combo = -1;
let gameScore = 0;
let starting = true; // Hook to prevent stopping just after starting
let stats;

const CYCLE_LENGTH = 20;
const TOTAL_TIME = () => {
  if (triple) {
    return 5000;
  } else {
    return 3000;
  }
};
const RESET_TIME = () => 300;

const colors = [
  "--color1",
  "--color2",
  "--color3",
  "--color4",
  "--color5",
  "--color6",
  "--color7",
  "--color8",
  "--color9",
];

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];

const progressCircle = document.querySelector(".progress-circle");

if (window.location.search == "?colors") {
  Array.from(document.querySelectorAll(".inner-square")).map((e, i) => {
    e.style.borderColor = `var(${colors[i]})`;
    e.style.backgroundColor = `var(${colors[i]})`;
  });
}

function getRandomSolarizedColor() {
  return colors[randomIndex];
}

function resetReply() {
  lastReply = { position: false, color: false, letter: false };
}

function resetStats() {
  stats = {
    combo: 0,
  };
}

function resetEverything() {
  history = [];
  correctPosC = 0;
  correctLetC = 0;
  correctColC = 0;
  gameScore = 0;
  combo = -1;
  total = 0;
  resetStats();
  resetReply();
}

Array.from(document.querySelectorAll(".inner-square")).map((e) => {
  e.addEventListener("click", (ev) => {
    if (window.active) {
      return;
    }
    new_back = +e.id.replace("d", "") + 1;
    if (BACK == new_back) {
      triple = !triple;
    }
    BACK = new_back;
    let text = BACK;
    if (triple) {
      text += `<sub>3</sub>`;
    } else {
      text += `<sub>2</sub>`;
    }
    document.getElementById("top-button").innerHTML = text;
    resetEverything();
    ev.stopPropagation();
  });
});

const modal = document.getElementById("modal");

modal.addEventListener("click", (e) => {
  toBack("modal");
  e.stopPropagation();
  if (modal.starts) {
    // To make the game more fluid, when level advances after a cycle tapping the modal goes to the next cycle
    modal.starts = false;
    startStop();
  }
});

function getPcts() {
  const pctPos = (100 * correctPosC) / total;
  const pctCol = (100 * correctColC) / total;
  const pctLet = (100 * correctLetC) / total;
  return {
    pos: pctPos.toFixed(0),
    col: pctCol.toFixed(0),
    let: pctLet.toFixed(0),
  };
}

const levelling = {
  kAdvance: "advance",
  kMaintain: "maintain",
  kDecrease: "decrease",
};

function checkPcts() {
  const pcts = getPcts();
  if (triple) {
    if (pcts.pos >= 80 && pcts.col >= 80 && pcts.let >= 80) {
      return levelling.kAdvance;
    }
    if (pcts.pos >= 50 && pcts.col >= 50 && pcts.let >= 50) {
      return levelling.kMaintain;
    }
  } else {
    if (pcts.pos >= 80 && pcts.col >= 80) {
      return levelling.kAdvance;
    }
    if (pcts.pos >= 50 && pcts.col >= 50) {
      return levelling.kMaintain;
    }
  }
  return levelling.kDecrease;
}

function showResults() {
  const pcts = getPcts();
  const modalContent = modal.querySelector("#modal-content");
  modalContent.innerHTML = "";
  if (total == 0) {
    const p = document.createElement("P");
    p.textContent = "Not enough rounds to have statistics";
    modalContent.appendChild(p);
    return;
  }
  const p1 = document.createElement("P");
  const p2 = document.createElement("P");
  const p3 = document.createElement("P");
  p1.innerHTML = `Positions: <span style="float: right;">${correctPosC} / ${total} (${pcts.pos}%)</span>`;
  p2.innerHTML = `Colors: <span style="float: right;"> ${correctColC} / ${total} (${pcts.col}%)</span>`;
  p3.innerHTML = `Letters: <span style="float: right;"> ${correctLetC} / ${total} (${pcts.let}%)</span>`;
  modalContent.appendChild(p1);
  modalContent.appendChild(p2);
  if (triple) {
    modalContent.appendChild(p3);
  }
  const p4 = document.createElement("p");
  p4.innerHTML = `Max combo: ${stats.combo}`;
  modalContent.appendChild(p4);

  if (total % CYCLE_LENGTH == 0) {
    modal.starts = true;
    const div = document.createElement("div");
    div.id = "levelling";
    const decision = checkPcts();
    cycles += 1;
    // There is no way to get to pause _and_ has this zero other than ending a round
    if (decision == levelling.kAdvance) {
      console.log("Advancing level");
      div.textContent = "You are advancing a level!";
      clearInfo();
      const nextLevel = Math.min(BACK + 1, 9);
      if (nextLevel != BACK) {
        // To prevent going from double to triple
        document.getElementById(`d${nextLevel - 1}`).click(); // Squares start at 0
      }
    }
    if (decision == levelling.kMaintain) {
      console.log("Staying at this level");
      // Info and statistics stay: you need to raise the % in the long term, not the short term.
      div.textContent = "You are staying at this level";
    }
    if (decision == levelling.kDecrease) {
      console.log("Decreasing level");
      div.textContent = "You are going back a  level";
      clearInfo();
      const nextLevel = Math.max(BACK - 1, 1);
      if (nextLevel != BACK) {
        // To prevent going from double to triple
        document.getElementById(`d${nextLevel - 1}`).click(); // Squares start at 0
      }
    }
    modalContent.appendChild(div);
  }
}

function toBack(id) {
  document.getElementById(id).classList.add("back");
  document.getElementById(id).classList.remove("front");
}
function toFront(id) {
  document.getElementById(id).classList.remove("back");
  document.getElementById(id).classList.add("front");
}

function startStop(e) {
  if (e) {
    e.stopPropagation();
  }
  starting = true;
  console.info("Start/stop");
  const squares = Array.from(document.querySelectorAll(".inner-square"));
  if (window.active) {
    // If it's running, we are going to stop showing the modal.
    if (triple) {
      toBack("bottom-button");
    }
    [
      "circular-progress",
      "left-button",
      "right-button",
      "middle-button",
      "letter",
    ].map(toBack);
    clearInterval(window.active);
    window.active = false;
    history = []; // Reset history, so it starts again from the beginning.
    // TODO the button text should not show until we can answer
    squares.map((e) => (e.style.borderColor = "var(--dark)"));
    squares.map((e) => (e.style.backgroundColor = "var(--dark)"));
    toFront("modal");
    showResults();
  } else {
    let text = BACK;
    if (triple) {
      text += `<sub>3</sub>`;
    } else {
      text += `<sub>2</sub>`;
    }
    document.getElementById("top-button").innerHTML = text;
    toFront("middle-button");
    toBack("modal");
    stepping();
    window.active = setInterval(stepping, TOTAL_TIME());
    squares.map((e) => (e.style.borderColor = "var(--alternate-background)"));
    squares.map(
      (e) => (e.style.backgroundColor = "var(--alternate-background)"),
    );
  }
}

document.getElementById("middle-button").addEventListener("click", startStop);
document.getElementById("top-button").addEventListener("click", startStop);
document.body.addEventListener("click", startStop);

function showAnswerButtons() {
  requestAnimationFrame(() => {
    ["left-button", "right-button"].map(toFront);
    if (triple) {
      toFront("bottom-button");
    }
    ["left-button", "right-button", "bottom-button"].map((b) => {
      document.getElementById(b).style.textColor = "var(--textcolor)"; // Something somewhere is not resetting properly
    });
  });
}

function answerButtonCommon(identifier, flag, e) {
  const color = flag ? "var(--dark)" : "";
  const textColor = flag ? "var(--light)" : "var(--textcolor)";
  requestAnimationFrame(() => {
    document
      .getElementById(`${identifier}-button`)
      .querySelector("p").style.backgroundColor = color;
    document
      .getElementById(`${identifier}-button`)
      .querySelector("p").style.color = textColor;
  });
  e.stopPropagation();
}

document.getElementById("left-button").addEventListener("click", function (e) {
  console.info("Same position");
  lastReply.position = !lastReply.position;
  answerButtonCommon("left", lastReply.position, e);
});

document.getElementById("right-button").addEventListener("click", function (e) {
  console.info("Same color");
  lastReply.color = !lastReply.color;
  answerButtonCommon("right", lastReply.color, e);
});

document
  .getElementById("bottom-button")
  .addEventListener("click", function (e) {
    if (!triple) {
      return;
    }
    console.info("Same letter");
    lastReply.letter = !lastReply.letter;
    answerButtonCommon("bottom", lastReply.letter, e);
  });

const coin = () => Math.random() < 0.3; // Kind of coin

function generateStep(previous) {
  let position = Math.floor(Math.random() * 9);
  let color = Math.floor(Math.random() * colors.length);
  let letter = Math.floor(Math.random() * letters.length);
  // I use "coin" to try to force each variable to be statistically closer to the
  // previous one, otherwise it is very easy to get high % just assuming everything
  // is always different, i.e. not answering at all.
  if (previous) {
    if (coin()) {
      position = previous.position;
    }
    if (coin()) {
      color = previous.color;
    }
    if (coin()) {
      letter = previous.letter;
    }
  }
  return {
    position: position,
    color: color,
    letter: letter,
  };
}

function render(step) {
  const colorCSS = colors[step.color];
  const position = step.position;
  const element = document.getElementById(`d${position}`);
  requestAnimationFrame(() => {
    element.style.borderColor = `var(${colorCSS})`;
    element.style.backgroundColor = `var(${colorCSS})`;
  });
}

function unrender(step) {
  const position = step.position;
  const element = document.getElementById(`d${position}`);
  requestAnimationFrame(() => {
    element.style.borderColor = `var(--alternate-background)`;
    element.style.backgroundColor = `var(--alternate-background)`;
  });
}

function score(toScore = { kind: "none", increase: 0 }) {
  const score = toScore.increase;
  const color = score > 0 ? "green" : "red";
  let selector = "";
  if (toScore.kind == "pos") {
    correctPosC += score;
    selector = "left";
  }
  if (toScore.kind == "col") {
    correctColC += score;
    selector = "right";
  }
  if (toScore.kind == "let") {
    correctLetC += score;
    selector = "bottom";
  }
  requestAnimationFrame(() => {
    document
      .getElementById(`${selector}-button`)
      .querySelector("p").style.backgroundColor = `var(--sd-${color})`;
  });
}

function addInfo() {
  if (total > 0) {
    let str;
    const pcts = getPcts();
    str = `<td>%</td><td>${pcts.pos}<sup>P</sup></td><td>${pcts.col}<sup>C</sup></td>`;
    if (triple) {
      str += `<td>${pcts.let}<sup>L</sup></td>`;
    }
    document.getElementById("top-pct").innerHTML = str;
    str = `${total} (${cycles})`;
    document.getElementById("top-round").innerHTML = str;
  }
}

function clearInfo() {
  requestAnimationFrame(() => {
    document.getElementById("top-pct").innerHTML = "";
    document.getElementById("top-round").innerHTML = "";
  });
}

function checkReply() {
  if (history.length < 1 + BACK) {
    return;
  }

  total += 1;
  console.log(total, CYCLE_LENGTH);

  starting = false;
  const lastIdx = history.length - 1;
  const previousIdx = history.length - 1 - BACK;
  const last = history[lastIdx];
  const previous = history[previousIdx];
  const previousScores = {
    pos: correctPosC,
    col: correctColC,
    let: correctLetC,
  };
  if (last.position == previous.position) {
    if (lastReply.position) {
      score({ kind: "pos", increase: 1 });
    } else {
      score({ kind: "pos", increase: 0 });
    }
  } else {
    if (!lastReply.position) {
      score({ kind: "pos", increase: 1 });
    } else {
      score({ kind: "pos", increase: 0 });
    }
  }
  if (last.color == previous.color) {
    if (lastReply.color) {
      score({ kind: "col", increase: 1 });
    } else {
      score({ kind: "col", increase: 0 });
    }
  } else {
    if (!lastReply.color) {
      score({ kind: "col", increase: 1 });
    } else {
      score({ kind: "col", increase: 0 });
    }
  }
  if (triple) {
    if (last.letter == previous.letter) {
      if (lastReply.letter) {
        score({ kind: "let", increase: 1 });
      } else {
        score({ kind: "let", increase: 0 });
      }
    } else {
      if (!lastReply.letter) {
        score({ kind: "let", increase: 1 });
      } else {
        score({ kind: "let", increase: 0 });
      }
    }
  }
  // Check combo increase
  const delta = {
    pos: previousScores.pos - correctPosC,
    col: previousScores.col - correctColC,
    let: previousScores.let - correctLetC,
  };
  if (triple) {
    if (delta.pos != 0 && delta.col != 0 && delta.let != 0) {
      combo += 1;
    } else {
      combo = 0;
    }
  } else {
    if (delta.pos != 0 && delta.col != 0) {
      combo += 1;
    } else {
      combo = -1;
    }
  }
  stats.combo = Math.max(stats.combo, combo);
  // Score
  let increase = combo > 0 ? 1 : 0;
  if (triple) {
    increase = increase * 3 ** combo;
  } else {
    increase = increase * 2 ** combo;
  }
  gameScore += increase;
  if (SHOW_GAME_SCORE) {
    document.getElementById("score").innerHTML =
      `<span style="float: left;">${formatGameScore(
        gameScore,
      )}</span> <span style="float: right">${combo > 0 ? combo : 1} x</span>`;
  }
  console.info(`pos: ${correctPosC} col: ${correctColC}`);
  if (total % CYCLE_LENGTH == 0 && !starting) {
    // TODO still needs a kickstart
    console.log("Stopping now");
    addInfo();
    startStop();
    return true; // Should not continue
  }
}

function formatGameScore(number) {
  // kilo, Mega, Giga, Tera, Peta, Exa, Zetta, Yotta, Rona, Quetta = 10^30
  // Please just increase the level if you pass this 🤣
  const suffixes = ["", "k", "G", "T", "P", "E", "Z", "Y", "R", "Q"];

  let base = 0;
  while (number >= 1000 && base < suffixes.length - 1) {
    number /= 1000;
    base++;
  }

  return `${number.toFixed(1)} ${suffixes[base]}`;
}

function resetAnswers() {
  requestAnimationFrame(() => {
    document
      .getElementById("right-button")
      .querySelector("p").style.backgroundColor = "rgba(0,0,0,0)";
    document
      .getElementById("left-button")
      .querySelector("p").style.backgroundColor = "rgba(0,0,0,0)";
    if (triple) {
      document
        .getElementById("bottom-button")
        .querySelector("p").style.backgroundColor = "rgba(0,0,0,0)";
    }
  });
}

function stepping() {
  let step, prev;
  const stopping = checkReply();
  if (stopping) {
    clearInterval(progressInterval);
    return true;
  }
  if (history.length >= BACK) {
    showAnswerButtons();
  }
  setTimeout(resetAnswers, RESET_TIME());
  if (history.length >= 1) {
    prev = history[history.length - 1];
    unrender(prev);
    if (history.length >= BACK) {
      const previousIdx = history.length - BACK;
      prev = history[previousIdx];
      step = generateStep(prev);
    } else {
      step = generateStep();
    }
  } else {
    step = generateStep();
  }
  if (total > 0) {
    addInfo();
  }
  timeRemaining = TOTAL_TIME() - RESET_TIME();
  progressCircle.style.strokeDashoffset = 251;
  clearInterval(progressInterval);
  progressInterval = setInterval(updateProgress, 100);
  const square = document.getElementById(`d${step.position}`);
  // Center the timer and set the same color. This could be its own function
  const colorCSS = colors[step.color];
  const progressContainer = document.getElementById("circular-progress");
  progressCircle.style.stroke = `var(${colorCSS})`;
  toFront("circular-progress");
  if (triple) {
    toFront("letter");
  }
  const svg = progressContainer.querySelector("svg");
  const targetRect = square.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const containerLeft = targetCenterX - svg.clientWidth / 2;
  const containerTop = targetCenterY - svg.clientHeight / 2;
  progressContainer.style.left = `round(${containerLeft}px, 1px)`;
  progressContainer.style.top = `round(${containerTop}px, 1px)`;

  if (triple) {
    const letter = document.getElementById("letter");
    letter.textContent = letters[step.letter];
    const letterBB = letter.getBoundingClientRect();
    const shiftV = letterBB.height / 2;
    const shiftH = letterBB.width / 2;
    letter.style.left = `round(${containerLeft + shiftH}px, 1px)`;
    letter.style.top = `round(${containerTop + shiftV}px, 1px)`;
    letter.style.color = `var(${colorCSS})`;
  }
  history.push(step);
  setTimeout(() => render(step), RESET_TIME());
  resetReply();
}

function updateProgress() {
  timeRemaining -= 100;

  const progressPercentage = (timeRemaining / TOTAL_TIME()) * 100;
  const strokeDashoffset = 251 + (251 * progressPercentage) / 100;

  progressCircle.style.strokeDashoffset = strokeDashoffset;

  if (timeRemaining <= 0) {
    clearInterval(progressInterval);
  }
}

resetReply();
resetStats();
