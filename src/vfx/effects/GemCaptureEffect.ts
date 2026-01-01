import * as THREE from 'three';
import { ParticlePool } from '../ParticlePool';
import { VFX } from '../../config/constants';

/**
 * Gem capture effect - particle burst + expanding ring
 */
export class GemCaptureEffect {
  private scene: THREE.Scene;
  private particlePool: ParticlePool;

  // Active rings for cleanup
  private activeRings: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, particlePool: ParticlePool) {
    this.scene = scene;
    this.particlePool = particlePool;
  }

  /**
   * Trigger gem capture effect
   */
  trigger(position: THREE.Vector3, color: THREE.Color = new THREE.Color(0x44ff88)): void {
    // Particle burst
    this.createParticleBurst(position, color);

    // Expanding glow ring
    this.createGlowRing(position, color);
  }

  private createParticleBurst(position: THREE.Vector3, color: THREE.Color): void {
    this.particlePool.burst(position, VFX.GEM_PARTICLE_COUNT, {
      color,
      speed: 2.5,
      speedVariance: 1,
      life: 0.4,
      lifeVariance: 0.2,
      gravity: 6,
      scale: 0.08,
      scaleVariance: 0.03,
      direction: new THREE.Vector3(0, 1, 0),
      spread: Math.PI * 0.4,
    });
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
