/**
 * Fire Particle System
 * Canvas-based particle animation for brain progress indicator
 *
 * Particles spawn at the brain's "surface" (based on fill progress)
 * and rise upward with physics simulation. Intensity scales with progress.
 */

const FireSystem = {
  canvas: null,
  ctx: null,
  particles: [],
  fillInset: 88,
  progress: 0,

  init() {
    this.canvas = document.getElementById("fire-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  },

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  },

  update(progress, fillInset) {
    this.progress = progress;
    this.fillInset = fillInset;
  },

  loop() {
    if (this.progress === 0 && this.particles.length === 0) {
      requestAnimationFrame(this.loop);
      return;
    }
    const { ctx, canvas, particles, fillInset, progress } = this;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const intensity = progress > 0 ? Math.pow(progress, 3) * 0.98 + 0.02 : 0;
    const maxParticles = progress > 0 ? 5 + Math.floor(130 * intensity) : 0;

    if (particles.length < maxParticles && Math.random() < intensity) {
      const surfaceY = height * (Math.max(8, fillInset) / 100) + 2;
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * (width * 0.5),
        y: surfaceY,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -(Math.random() * 0.8 + 0.4),
        size: Math.random() * 1.2 + 0.4,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.015,
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) { particles.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.life > 0.6)      ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
      else if (p.life > 0.3) ctx.fillStyle = `rgba(255, 160, 20, ${p.life})`;
      else                   ctx.fillStyle = `rgba(220, 40, 0, ${p.life})`;
      ctx.fill();
    }
    requestAnimationFrame(this.loop);
  },
};

export { FireSystem };
