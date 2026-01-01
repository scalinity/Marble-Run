import * as THREE from 'three';
import { VFX } from '../config/constants';

/**
 * Single particle data
 */
export interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  scale: number;
  rotationSpeed: number;
  active: boolean;
}

/**
 * CPU-based particle pool for lightweight effects
 */
export class ParticlePool {
  private scene: THREE.Scene;
  private pool: Particle[] = [];
  private activeParticles: Particle[] = [];

  // Shared resources
  private sharedGeometry: THREE.SphereGeometry;

  constructor(scene: THREE.Scene, poolSize: number = VFX.PARTICLE_POOL_SIZE) {
    this.scene = scene;
    this.sharedGeometry = new THREE.SphereGeometry(0.05, 6, 6);

    // Pre-create particle pool
    for (let i = 0; i < poolSize; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(this.sharedGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        gravity: 5,
        scale: 1,
        rotationSpeed: 0,
        active: false,
      });
    }
  }

  /**
   * Acquire a particle from the pool
   */
  acquire(): Particle | null {
    const particle = this.pool.find((p) => !p.active);
    if (particle) {
      particle.active = true;
      particle.mesh.visible = true;
      this.activeParticles.push(particle);
      return particle;
    }
    return null;
  }

  /**
   * Release a particle back to the pool
   */
  release(particle: Particle): void {
    particle.active = false;
    particle.mesh.visible = false;
    const idx = this.activeParticles.indexOf(particle);
    if (idx !== -1) {
      this.activeParticles.splice(idx, 1);
    }
  }

  /**
   * Spawn particles in a burst
   */
  burst(
    position: THREE.Vector3,
    count: number,
    options: {
      color?: THREE.Color;
      speed?: number;
      speedVariance?: number;
      life?: number;
      lifeVariance?: number;
      gravity?: number;
      scale?: number;
      scaleVariance?: number;
      direction?: THREE.Vector3;
      spread?: number;
    } = {}
  ): void {
    const {
      color = new THREE.Color(0xffffff),
      speed = 3,
      speedVariance = 1,
      life = 0.5,
      lifeVariance = 0.2,
      gravity = 5,
      scale = 0.08,
      scaleVariance = 0.03,
      direction,
      spread = Math.PI,
    } = options;

    for (let i = 0; i < count; i++) {
      const particle = this.acquire();
      if (!particle) break;

      // Position
      particle.mesh.position.copy(position);

      // Velocity
      if (direction) {
        // Cone-shaped burst in direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * spread;
        const localDir = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        );

        // Rotate to align with direction
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
        localDir.applyQuaternion(quat);

        const particleSpeed = speed + (Math.random() - 0.5) * speedVariance * 2;
        particle.velocity.copy(localDir).multiplyScalar(particleSpeed);
      } else {
        // Spherical burst
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const particleSpeed = speed + (Math.random() - 0.5) * speedVariance * 2;

        particle.velocity.set(
          Math.sin(phi) * Math.cos(theta) * particleSpeed,
          Math.sin(phi) * Math.sin(theta) * particleSpeed + 1, // Slight upward bias
          Math.cos(phi) * particleSpeed
        );
      }

      // Life
      particle.life = life + (Math.random() - 0.5) * lifeVariance * 2;
      particle.maxLife = particle.life;

      // Other properties
      particle.gravity = gravity;
      particle.scale = scale + (Math.random() - 0.5) * scaleVariance * 2;
      particle.rotationSpeed = (Math.random() - 0.5) * 10;

      // Set color
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.color.copy(color);
      material.opacity = 1;

      // Set initial scale
      particle.mesh.scale.setScalar(particle.scale);
    }
  }

  /**
   * Update all active particles
   */
  update(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.release(p);
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * dt;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));

      // Visual decay
      const lifeRatio = p.life / p.maxLife;
      const material = p.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = lifeRatio;

      // Scale decay
      const scale = p.scale * (0.3 + lifeRatio * 0.7);
      p.mesh.scale.setScalar(scale);

      // Rotation
      p.mesh.rotation.z += p.rotationSpeed * dt;
    }
  }

  /**
   * Get number of active particles
   */
  getActiveCount(): number {
    return this.activeParticles.length;
  }

  dispose(): void {
    for (const p of this.pool) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.sharedGeometry.dispose();
    this.pool = [];
    this.activeParticles = [];
  }
}
