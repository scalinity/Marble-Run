import * as THREE from "three";
import { ParticleSystem } from "../ParticleSystem";
import { VFX } from "../../config/constants";

/**
 * Gem capture effect - particle burst + expanding ring
 */
export class GemCaptureEffect {
  private scene: THREE.Scene;
  private particles: ParticleSystem;

  // Active rings for cleanup
  private activeRings: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;
  }

  /**
   * Trigger gem capture effect
   * Reference: emit(position, 30, 0xffff00, 0.5, 4, 0.8)
   */
  trigger(
    position: THREE.Vector3,
    color: THREE.Color = new THREE.Color(0xffd700), // Gold
  ): void {
    // Particle burst
    this.createParticleBurst(position, color);

    // Expanding glow ring
    this.createGlowRing(position, color);
  }

  private createParticleBurst(
    position: THREE.Vector3,
    color: THREE.Color,
  ): void {
    // Reference: emit(position, 30, 0xffff00, 0.5, 4, 0.8)
    this.particles.emit(
      position,
      VFX.GEM_PARTICLE_COUNT, // 30
      color.getHex(),
      0.5, // spread
      4, // speed
      0.8, // life
    );
  }

  private createGlowRing(position: THREE.Vector3, color: THREE.Color): void {
    const geometry = new THREE.RingGeometry(0.05, 0.3, 32);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeRings.push(ring);

    // Animate expansion and fade
    const startTime = performance.now();
    const duration = VFX.GEM_RING_DURATION;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const t = elapsed / duration;

      if (t >= 1) {
        this.scene.remove(ring);
        geometry.dispose();
        material.dispose();
        const idx = this.activeRings.indexOf(ring);
        if (idx !== -1) this.activeRings.splice(idx, 1);
        return;
      }

      // Expand
      ring.scale.setScalar(1 + t * 3);

      // Fade
      material.opacity = 0.8 * (1 - t);

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
  }
}
