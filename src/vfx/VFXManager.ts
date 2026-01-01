import * as THREE from 'three';
import { Trail } from './Trail';
import { ParticlePool } from './ParticlePool';
import { GemCaptureEffect } from './effects/GemCaptureEffect';
import { LevelCompleteEffect } from './effects/LevelCompleteEffect';
import { eventBus, GameEvents } from '../utils/EventBus';

/**
 * Central VFX manager - coordinates all visual effects
 */
export class VFXManager {
  private scene: THREE.Scene;

  // Systems
  private particlePool: ParticlePool;
  private trail: Trail;

  // Effects
  private gemCaptureEffect: GemCaptureEffect;
  private levelCompleteEffect: LevelCompleteEffect;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create particle pool
    this.particlePool = new ParticlePool(scene);

    // Create trail
    this.trail = new Trail(scene);

    // Create effects
    this.gemCaptureEffect = new GemCaptureEffect(scene, this.particlePool);
    this.levelCompleteEffect = new LevelCompleteEffect(scene, this.particlePool);

    // Subscribe to game events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Gem collected
    eventBus.on<{ id: string }>(GameEvents.GEM_COLLECTED, ({ id }) => {
      // Effect position is handled by the gem piece itself
      // This event is for tracking/UI updates
    });
  }

  /**
   * Update all VFX systems
   */
  update(dt: number): void {
    this.particlePool.update(dt);
  }

  /**
   * Update marble trail
   */
  updateTrail(position: THREE.Vector3, velocity: THREE.Vector3, dt: number): void {
    this.trail.update(position, velocity, dt);
  }

  /**
   * Trigger gem capture effect at position
   */
  gemCapture(position: THREE.Vector3, color?: THREE.Color): void {
    this.gemCaptureEffect.trigger(position, color);
  }

  /**
   * Trigger level completion effect
   */
  levelComplete(position: THREE.Vector3, onComplete?: () => void): void {
    this.levelCompleteEffect.trigger(position, onComplete);
  }

  /**
   * Clear trail (on respawn/level restart)
   */
  clearTrail(): void {
    this.trail.clear();
  }

  /**
   * Reset all effects (on level change)
   */
  reset(): void {
    this.trail.clear();
    this.gemCaptureEffect.dispose();
    this.levelCompleteEffect.dispose();

    // Recreate effects
    this.gemCaptureEffect = new GemCaptureEffect(this.scene, this.particlePool);
    this.levelCompleteEffect = new LevelCompleteEffect(this.scene, this.particlePool);
  }

  dispose(): void {
    this.trail.dispose();
    this.particlePool.dispose();
    this.gemCaptureEffect.dispose();
    this.levelCompleteEffect.dispose();
  }
}
