import { getRelationText } from "./Vocabulary.js";

/**
 * Renderer converts Question objects to styled HTML
 * Uses Magrana's design language
 */
export class Renderer {
  constructor(options = {}) {
    this.options = {
      minimal: options.minimal || false,
      showEntities: options.showEntities !== false,
      ...options,
    };
  }

  /**
   * Render a complete question to HTML
   * @param {Question} question
   * @returns {Object} { premises: string[], conclusion: string, isValid: boolean }
   */
  renderQuestion(question) {
    return {
      premises: question.premises.map((p) => this.renderPremise(p)),
      conclusion: this.renderConclusion(question.conclusion),
      isValid: question.isValid,
      metadata: question.metadata,
    };
  }

  /**
   * Render a single entity — icon or text pill depending on entity type
   */
  renderEntity(entity) {
    if (entity.iconName) {
      return `<i class="ph-light ph-${entity.iconName} entity-icon"></i>`;
    }
    return `<span class="entity">${this.escapeHtml(entity.displayValue)}</span>`;
  }

  /**
   * Render a single premise
   */
  renderPremise(premise) {
    const [entityA, entityB] = premise.entities;
    const relationText =
      premise.properties.text || getRelationText(premise, this.options.minimal);

    return `<div class="premise">
      ${this.renderEntity(entityA)}
      <span class="relation">${relationText}</span>
      ${this.renderEntity(entityB)}
    </div>`;
  }

  /**
   * Render conclusion (question to answer)
   */
  renderConclusion(conclusion) {
    const [entityA, entityB] = conclusion.entities;
    const relationText =
      conclusion.properties.text ||
      getRelationText(conclusion, this.options.minimal);

    return `<div class="conclusion">
      ${this.renderEntity(entityA)}
      <span class="relation">${relationText}</span>
      <span class="conclusion-tail">
        ${this.renderEntity(entityB)}
        <span class="question-mark">?</span>
      </span>
    </div>`;
  }

  /**
   * Render full game UI
   */
  renderGameUI(question) {
    const rendered = this.renderQuestion(question);
    const premiseCount = question.premises.length;

    // Determine compactness level based on premise count
    let compactClass = "";
    if (premiseCount >= 7) {
      compactClass = "very-compact";
    } else if (premiseCount >= 5) {
      compactClass = "compact";
    }

    return `
      <div class="logic-game ${compactClass}">
        <div class="premises-container">
          <div class="premises-label">Premises:</div>
          ${rendered.premises.join("")}
        </div>

        <div class="conclusion-container">
          <div class="conclusion-label">Question:</div>
          ${rendered.conclusion}
        </div>

        <div class="answer-buttons">
          <button class="btn btn-true" data-answer="true">
            <i class="ph-light ph-check btn-icon"></i>
            <span class="btn-text">True</span>
          </button>
          <button class="btn btn-false" data-answer="false">
            <i class="ph-light ph-x btn-icon"></i>
            <span class="btn-text">False</span>
          </button>
          <button class="btn btn-indeterminate" data-answer="indeterminate">
            <i class="ph-light ph-question-mark btn-icon"></i>
            <span class="btn-shrug">¯\\_(ツ)_/¯</span>
          </button>
        </div>

        <div class="stats-footer">
          <div class="stat">
            <span class="stat-label">Premises:</span>
            <span class="stat-value">${question.premises.length}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Entities:</span>
            <span class="stat-value">${question.metadata.entityCount}</span>
          </div>
          ${question.metadata.isMixed ? '<div class="stat-badge">Mixed Types</div>' : ""}
        </div>
      </div>
    `;
  }

  /**
   * Render network visualization (simple text-based)
   */
  renderNetworkInfo(question) {
    const stats = question.network.getStats();
    const types = Object.entries(stats.relationsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");

    return `
      <div class="network-info">
        <div class="info-item">
          <span class="info-label">Network:</span>
          <span class="info-value">${stats.entityCount} entities, ${stats.relationCount} relations</span>
        </div>
        <div class="info-item">
          <span class="info-label">Types:</span>
          <span class="info-value">${types}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Strategy:</span>
          <span class="info-value">${question.metadata.conclusionStrategy}</span>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Helper function to render question directly
 */
export function renderQuestion(question, options = {}) {
  const renderer = new Renderer(options);
  return renderer.renderGameUI(question);
}

/**
 * Helper to render and inject into DOM
 */
export function renderIntoElement(question, elementId, options = {}) {
  const renderer = new Renderer(options);
  const html = renderer.renderGameUI(question);
  const element = document.getElementById(elementId);

  if (element) {
    element.innerHTML = html;
    return element;
  }

  throw new Error(`Element with id "${elementId}" not found`);
}
