import * as THREE from "three";

/**
 * Utility function for random range
 */
function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Particle data structure - exact copy from reference
 */
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

/**
 * GPU-based particle system - exact copy from reference particles.ts
 * Uses PointsMaterial for screen-space rendering
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private maxParticles: number;

  constructor(scene: THREE.Scene, maxParticles: number = 500) {
    this.maxParticles = maxParticles;

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);

    // Initialize all positions far away to prevent bounding sphere issues
    for (let i = 0; i < maxParticles; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -10000;
      positions[i * 3 + 2] = 0;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    this.material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // CRITICAL: Prevent culling of dynamic particles
    scene.add(this.points);
  }

  emit(
    position: THREE.Vector3,
    count: number,
    color: number,
    spread: number = 1,
    speed: number = 2,
    life: number = 1,
  ): void {
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const velocity = new THREE.Vector3(
        randomRange(-spread, spread),
        randomRange(0.5, spread * 2),
        randomRange(-spread, spread),
      )
        .normalize()
        .multiplyScalar(speed * randomRange(0.5, 1.5));

      this.particles.push({
        position: position
          .clone()
          .add(
            new THREE.Vector3(
              randomRange(-0.2, 0.2),
              randomRange(-0.2, 0.2),
              randomRange(-0.2, 0.2),
            ),
          ),
        velocity,
        life: life * randomRange(0.8, 1.2),
        maxLife: life,
        size: randomRange(0.1, 0.3),
        color: baseColor.clone(),
      });
    }
  }

  emitTrail(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: number,
  ): void {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }

    const speed = velocity.length();
    if (speed < 1) return;

    this.particles.push({
      position: position.clone(),
      velocity: velocity
        .clone()
        .multiplyScalar(-0.1)
        .add(
          new THREE.Vector3(
            randomRange(-0.3, 0.3),
            randomRange(0.2, 0.5),
            randomRange(-0.3, 0.3),
          ),
        ),
      life: 0.5,
      maxLife: 0.5,
      size: 0.15,
      color: new THREE.Color(color),
    });
  }

  update(delta: number): void {
    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;
    const sizes = this.geometry.attributes.size.array as Float32Array;

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.life -= delta;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 5 * delta;
      p.position.add(p.velocity.clone().multiplyScalar(delta));
    }

    // Update buffer - active particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const lifeRatio = p.life / p.maxLife;

      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;

      colors[i * 3] = p.color.r * lifeRatio;
      colors[i * 3 + 1] = p.color.g * lifeRatio;
      colors[i * 3 + 2] = p.color.b * lifeRatio;

      sizes[i] = p.size * lifeRatio;
    }

    // Clear unused slots - move positions far away so they don't render
    for (let i = this.particles.length; i < this.maxParticles; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -10000; // Far below, won't be visible
      positions[i * 3 + 2] = 0;
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
      sizes[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Only draw active particles
    this.geometry.setDrawRange(0, this.particles.length);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
