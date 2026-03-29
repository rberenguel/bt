// Shared task screen UI component.
// Renders a single-rule board (context header + optional rule label + 3×4 tile grid)
// into the provided container element.

import { generateBoard } from "./engine.js";
import { triggerHaptic, triggerHapticError } from "../haptic.js";

export function makeTaskScreen({
  containerEl,
  rule,
  showRule,
  contextIcon,
  contextLabel,
  onComplete,
}) {
  let board = generateBoard([rule]);
  let totalTaps = 0;
  let wrongTaps = 0;
  let done = false;

  render();

  function render() {
    containerEl.innerHTML =
      `<div class="task-context-header">` +
      `<i class="ph-light ${contextIcon}"></i>` +
      `<span>${contextLabel}</span>` +
      `</div>` +
      (showRule ? `<div class="task-rule-box">${rule.text}</div>` : "") +
      `<div class="task-grid" id="ts-board"></div>`;
    renderBoard();
  }

  function renderBoard() {
    const boardEl = containerEl.querySelector("#ts-board");
    if (!boardEl) return;
    boardEl.innerHTML = "";
    board.forEach((tile) => {
      const btn = document.createElement("button");
      btn.className = "tile";
      btn.dataset.id = tile.id;
      btn.innerHTML =
        `<span class="tile-number">${tile.number}</span>` +
        `<i class="ph-light ${tile.icon}" style="color:${tile.color.hex}"></i>`;
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          handleTap(tile.id);
        },
        { passive: false },
      );
      boardEl.appendChild(btn);
    });
  }

  function handleTap(tileId) {
    if (done) return;
    triggerHaptic();

    const boardEl = containerEl.querySelector("#ts-board");
    const tileIndex = board.findIndex((t) => t.id === tileId);
    if (tileIndex === -1) return;

    const tile = board[tileIndex];
    totalTaps++;

    if (rule.isValid(tile, board)) {
      board.splice(tileIndex, 1);
      boardEl
        .querySelector(`.tile[data-id="${tileId}"]`)
        ?.classList.add("cleared");

      // Task complete when no remaining tiles satisfy the rule.
      if (!board.some((t) => rule.isValid(t, board))) {
        done = true;
        setTimeout(() => onComplete({ totalTaps, wrongTaps }), 350);
      }
    } else {
      triggerHapticError();
      wrongTaps++;
      const btn = boardEl.querySelector(`.tile[data-id="${tileId}"]`);
      if (btn) {
        btn.classList.add("error");
        setTimeout(() => btn.classList.remove("error"), 400);
      }
    }
  }

  return {
    destroy() {
      done = true;
      containerEl.innerHTML = "";
    },
  };
}
