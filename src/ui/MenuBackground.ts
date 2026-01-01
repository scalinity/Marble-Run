import { COLORS } from '../config/constants';

interface Marble {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  color: string;
  glowColor: string;
  pulsePhase: number;
  pulseSpeed: number;
}

interface FloatingShape {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  vx: number;
  vy: number;
  type: 'platform' | 'ramp' | 'gem';
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/**
 * Animated canvas background for the main menu
 */
export class MenuBackground {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private marbles: Marble[] = [];
  private shapes: FloatingShape[] = [];
  private particles: Particle[] = [];
  private animationId: number = 0;
  private time = 0;
  private mouseX = 0;
  private mouseY = 0;

  // Color palette from game
  private colors = {
    marble: `#${COLORS.MARBLE.toString(16).padStart(6, '0')}`,
    gem: `#${COLORS.GEM.toString(16).padStart(6, '0')}`,
    track: `#${COLORS.TRACK.toString(16).padStart(6, '0')}`,
    platform: `#${COLORS.PLATFORM.toString(16).padStart(6, '0')}`,
    trail: `#${COLORS.TRAIL.toString(16).padStart(6, '0')}`,
    goal: `#${COLORS.GOAL.toString(16).padStart(6, '0')}`,
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'menu-background';
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 199;
      pointer-events: none;
    `;

    this.ctx = this.canvas.getContext('2d')!;
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('mousemove', this.handleMouseMove);

    this.initMarbles();
    this.initShapes();
  }

  private resize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private initMarbles(): void {
    const count = Math.floor(window.innerWidth / 200) + 3;
    const marbleColors = [this.colors.marble, this.colors.gem, this.colors.trail];

    for (let i = 0; i < count; i++) {
      const color = marbleColors[Math.floor(Math.random() * marbleColors.length)];
      this.marbles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: 20 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color,
        glowColor: color,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1,
      });
    }
  }

  private initShapes(): void {
    const count = Math.floor(window.innerWidth / 150) + 4;
    const types: FloatingShape['type'][] = ['platform', 'ramp', 'gem'];

    for (let i = 0; i < count; i++) {
      this.shapes.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        width: 40 + Math.random() * 80,
        height: 15 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        type: types[Math.floor(Math.random() * types.length)],
        opacity: 0.1 + Math.random() * 0.2,
      });
    }
  }

  private spawnParticle(): void {
    if (this.particles.length > 50) return;

    const colors = [this.colors.marble, this.colors.gem, this.colors.trail, this.colors.goal];
    this.particles.push({
      x: Math.random() * this.canvas.width,
      y: this.canvas.height + 10,
      vx: (Math.random() - 0.5) * 2,
      vy: -1 - Math.random() * 2,
      life: 1,
      maxLife: 3 + Math.random() * 4,
      size: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  private updateMarbles(dt: number): void {
    for (const marble of this.marbles) {
      // Subtle parallax based on mouse position
      const parallaxStrength = marble.radius / 60;
      const targetX = (this.mouseX - this.canvas.width / 2) * 0.02 * parallaxStrength;
      const targetY = (this.mouseY - this.canvas.height / 2) * 0.02 * parallaxStrength;

      marble.vx += (targetX - marble.vx * 10) * dt * 0.5;
      marble.vy += (targetY - marble.vy * 10) * dt * 0.5;

      marble.x += marble.vx;
      marble.y += marble.vy;
      marble.pulsePhase += marble.pulseSpeed * dt;

      // Wrap around screen
      if (marble.x < -marble.radius * 2) marble.x = this.canvas.width + marble.radius;
      if (marble.x > this.canvas.width + marble.radius * 2) marble.x = -marble.radius;
      if (marble.y < -marble.radius * 2) marble.y = this.canvas.height + marble.radius;
      if (marble.y > this.canvas.height + marble.radius * 2) marble.y = -marble.radius;
    }
  }

  private updateShapes(dt: number): void {
    for (const shape of this.shapes) {
      shape.x += shape.vx;
      shape.y += shape.vy;
      shape.rotation += shape.rotationSpeed;

      // Wrap around screen
      if (shape.x < -shape.width * 2) shape.x = this.canvas.width + shape.width;
      if (shape.x > this.canvas.width + shape.width * 2) shape.x = -shape.width;
      if (shape.y < -shape.height * 2) shape.y = this.canvas.height + shape.height;
      if (shape.y > this.canvas.height + shape.height * 2) shape.y = -shape.height;
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // Slight upward drift resistance
      p.life -= dt;

      if (p.life <= 0 || p.y < -20) {
        this.particles.splice(i, 1);
      }
    }

    // Spawn new particles occasionally
    if (Math.random() < 0.1) {
      this.spawnParticle();
    }
  }

  private drawBackground(): void {
    const { ctx, canvas } = this;
    const { width, height } = canvas;

    // Animated gradient background
    const gradientShift = Math.sin(this.time * 0.2) * 20;
    const gradient = ctx.createLinearGradient(
      gradientShift,
      0,
      width - gradientShift,
      height
    );
    gradient.addColorStop(0, '#0d0d1a');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#0f1729');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(74, 144, 164, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    const offsetX = (this.time * 10) % gridSize;
    const offsetY = (this.time * 5) % gridSize;

    for (let x = -gridSize + offsetX; x < width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = -gridSize + offsetY; y < height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private drawMarbles(): void {
    const { ctx } = this;

    for (const marble of this.marbles) {
      const pulse = 1 + Math.sin(marble.pulsePhase) * 0.1;
      const radius = marble.radius * pulse;

      // Outer glow
      const glowGradient = ctx.createRadialGradient(
        marble.x,
        marble.y,
        0,
        marble.x,
        marble.y,
        radius * 2
      );
      glowGradient.addColorStop(0, marble.glowColor + '40');
      glowGradient.addColorStop(0.5, marble.glowColor + '10');
      glowGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(marble.x, marble.y, radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      // Main marble with gradient
      const marbleGradient = ctx.createRadialGradient(
        marble.x - radius * 0.3,
        marble.y - radius * 0.3,
        0,
        marble.x,
        marble.y,
        radius
      );
      marbleGradient.addColorStop(0, this.lightenColor(marble.color, 40));
      marbleGradient.addColorStop(0.7, marble.color);
      marbleGradient.addColorStop(1, this.darkenColor(marble.color, 30));

      ctx.beginPath();
      ctx.arc(marble.x, marble.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = marbleGradient;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Highlight
      ctx.beginPath();
      ctx.arc(
        marble.x - radius * 0.3,
        marble.y - radius * 0.3,
        radius * 0.2,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }
  }

  private drawShapes(): void {
    const { ctx } = this;

    for (const shape of this.shapes) {
      ctx.save();
      ctx.translate(shape.x, shape.y);
      ctx.rotate(shape.rotation);
      ctx.globalAlpha = shape.opacity;

      if (shape.type === 'platform') {
        // Draw platform rectangle
        ctx.fillStyle = this.colors.platform;
        ctx.fillRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
        ctx.strokeStyle = this.colors.track;
        ctx.lineWidth = 2;
        ctx.strokeRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
      } else if (shape.type === 'ramp') {
        // Draw ramp triangle
        ctx.fillStyle = this.colors.track;
        ctx.beginPath();
        ctx.moveTo(-shape.width / 2, shape.height / 2);
        ctx.lineTo(shape.width / 2, shape.height / 2);
        ctx.lineTo(shape.width / 2, -shape.height / 2);
        ctx.closePath();
        ctx.fill();
      } else if (shape.type === 'gem') {
        // Draw gem diamond
        ctx.fillStyle = this.colors.gem;
        ctx.beginPath();
        ctx.moveTo(0, -shape.height);
        ctx.lineTo(shape.width / 2, 0);
        ctx.lineTo(0, shape.height);
        ctx.lineTo(-shape.width / 2, 0);
        ctx.closePath();
        ctx.fill();

        // Gem glow
        ctx.shadowColor = this.colors.gem;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private drawParticles(): void {
    const { ctx } = this;

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }

  private drawVignette(): void {
    const { ctx, canvas } = this;
    const { width, height } = canvas;

    // Radial vignette
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.3,
      width / 2,
      height / 2,
      height
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
    const b = Math.min(255, (num & 0x0000ff) + percent);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
    const b = Math.max(0, (num & 0x0000ff) - percent);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private animate = (): void => {
    const dt = 1 / 60;
    this.time += dt;

    this.updateMarbles(dt);
    this.updateShapes(dt);
    this.updateParticles(dt);

    this.drawBackground();
    this.drawShapes();
    this.drawParticles();
    this.drawMarbles();
    this.drawVignette();

    this.animationId = requestAnimationFrame(this.animate);
  };

  start(): void {
    document.body.appendChild(this.canvas);
    this.animate();
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
    this.canvas.remove();
  }

  show(): void {
    this.canvas.style.display = 'block';
    this.animate();
  }

  hide(): void {
    this.canvas.style.display = 'none';
    cancelAnimationFrame(this.animationId);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousemove', this.handleMouseMove);
  }
}
