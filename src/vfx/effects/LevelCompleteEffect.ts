import * as THREE from "three";
import { ParticleSystem } from "../ParticleSystem";
import { VFX, COLORS } from "../../config/constants";

/**
 * Level completion effect - large burst + staggered rings + screen flash
 */
export class LevelCompleteEffect {
  private scene: THREE.Scene;
  private particles: ParticleSystem;

  // Active effects for cleanup
  private activeRings: THREE.Mesh[] = [];
  private flashOverlay: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;
  }

  /**
   * Trigger level completion effect
   */
  trigger(position: THREE.Vector3, onComplete?: () => void): void {
    // Celebration particle burst
    this.createCelebrationBurst(position);

    // Staggered glow rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.createGlowRing(
          position,
          new THREE.Color(COLORS.GOAL),
          0.5 + i * 0.3,
        );
      }, i * 100);
    }

    // Screen flash
    this.createScreenFlash();

    // Call completion callback after delay
    if (onComplete) {
      setTimeout(onComplete, VFX.GOAL_FREEZE_DURATION);
    }
  }

  private createCelebrationBurst(position: THREE.Vector3): void {
    const colors = [0xffdd44, 0x44ff88, 0xff44aa, 0x44aaff];

    // Spawn particles in waves
    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        const waveCount = Math.floor(VFX.GOAL_PARTICLE_COUNT / 3);
        const color = colors[wave % colors.length];

        this.particles.emit(
          position,
          waveCount,
          color,
          1, // spread
          5, // speed
          1.0, // life
        );
      }, wave * 80);
    }
  }

  private createGlowRing(
    position: THREE.Vector3,
    color: THREE.Color,
    delay: number,
  ): void {
    const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(0);
    this.scene.add(ring);
    this.activeRings.push(ring);

    // Animate with delay
    const startTime = performance.now() + delay * 1000;
    const duration = 600;

    const animate = (): void => {
      const now = performance.now();
      if (now < startTime) {
        requestAnimationFrame(animate);
        return;
      }

      const elapsed = now - startTime;
      const t = elapsed / duration;

      if (t >= 1) {
        this.scene.remove(ring);
        geometry.dispose();
        material.dispose();
        const idx = this.activeRings.indexOf(ring);
        if (idx !== -1) this.activeRings.splice(idx, 1);
        return;
      }

      // Ease out expansion
      const easeT = 1 - Math.pow(1 - t, 3);
      ring.scale.setScalar(easeT * 5);

      // Fade out
      material.opacity = 0.9 * (1 - t);

      requestAnimationFrame(animate);
    };

    animate();
  }

  private createScreenFlash(): void {
    // Create fullscreen overlay using a plane that faces the camera
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      depthWrite: false,
    });

    this.flashOverlay = new THREE.Mesh(geometry, material);
    this.flashOverlay.renderOrder = 9999;

    // Position far in front (will need camera reference for proper positioning)
    this.flashOverlay.position.set(0, 5, 0);
    this.flashOverlay.lookAt(0, 0, 0);

    this.scene.add(this.flashOverlay);

    // Fade out
    const startTime = performance.now();
    const duration = 400;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const t = elapsed / duration;

      if (t >= 1 || !this.flashOverlay) {
        if (this.flashOverlay) {
          this.scene.remove(this.flashOverlay);
          geometry.dispose();
          material.dispose();
          this.flashOverlay = null;
        }
        return;
      }

      material.opacity = 0.3 * (1 - t);

      requestAnimationFrame(animate);
    };

    animate();
  }

  dispose(): void {
    for (const ring of this.activeRings) {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
    this.activeRings = [];

    if (this.flashOverlay) {
      this.scene.remove(this.flashOverlay);
      this.flashOverlay.geometry.dispose();
      (this.flashOverlay.material as THREE.Material).dispose();
      this.flashOverlay = null;
    }
  }
}
