/**
 * Fireworks System
 * Celebration effects for milestone achievements
 * Adapted from Suc's fireworks system
 */

const Fireworks = {
  canvas: null,
  ctx: null,
  particles: [],
  animationRunning: false,

  config: {
    FRICTION: 0.98,
    PARTICLE_DECAY_MIN: 0.015,
    PARTICLE_DECAY_RANDOM: 0.01,
    SPEED_MULTIPLIER: 0.6, // Subtle effect
  },

  setupCanvas() {
    let canvas = document.getElementById("fireworks-canvas");
    if (canvas) {
      this.ctx = canvas.getContext("2d");
      return true;
    }
    canvas = document.createElement("canvas");
    canvas.id = "fireworks-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `position: fixed; left: 0; top: 0; z-index: 90; background-color: transparent; pointer-events: none;`;
    document.body.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    return true;
  },

  destroyCanvas() {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  },

  // Subtle celebration explosion
  celebrate(x, y, particleCount = 20) {
    if (!this.setupCanvas()) return;

    const colors = this.getGoldOrangeColors();

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = (Math.random() * 0.6 + 0.3) * this.config.SPEED_MULTIPLIER;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: 1 + Math.random() * 1.5,
        alpha: 1,
        decay:
          this.config.PARTICLE_DECAY_MIN +
          Math.random() * this.config.PARTICLE_DECAY_RANDOM,
        trail: [],
      });
    }

    if (!this.animationRunning) {
      this.animationRunning = true;
      requestAnimationFrame(this.animate.bind(this));
    }
  },

  animate() {
    if (!this.ctx) {
      this.animationRunning = false;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter((p) => p.alpha > 0);

    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // Slight gravity
      p.vx *= this.config.FRICTION;
      p.vy *= this.config.FRICTION;
      p.alpha -= p.decay;

      // Trail effect
      p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
      if (p.trail.length > 8) p.trail.shift();

      // Draw trail
      p.trail.forEach((tp, idx) => {
        const trailAlpha = tp.alpha * (idx / p.trail.length) * 0.5;
        this.drawParticle(p, tp.x, tp.y, trailAlpha);
      });

      // Draw particle
      if (p.alpha > 0) this.drawParticle(p, p.x, p.y, p.alpha);
    });

    if (this.particles.length > 0) {
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.animationRunning = false;
      this.destroyCanvas();
    }
  },

  drawParticle(p, x, y, alpha) {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.arc(x, y, p.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = p.color.replace("ALPHA", alpha);
    this.ctx.fill();
  },

  getGoldOrangeColors() {
    // Gold-orange gradient colors matching nb theme
    return [
      "rgba(255, 140, 0, ALPHA)", // Dark orange
      "rgba(255, 165, 0, ALPHA)", // Orange
      "rgba(255, 183, 51, ALPHA)", // Light orange
      "rgba(255, 215, 0, ALPHA)", // Gold
    ];
  },

  // Trigger celebration at specific location
  triggerAtElement(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    this.celebrate(x, y, 15); // Subtle with fewer particles
  },
};

export { Fireworks };
