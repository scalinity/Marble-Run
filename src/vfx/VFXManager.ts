import * as THREE from "three";
import { Trail } from "./Trail";
import { ParticleSystem } from "./ParticleSystem";
import { GemCaptureEffect } from "./effects/GemCaptureEffect";
import { LevelCompleteEffect } from "./effects/LevelCompleteEffect";
import { Starfield } from "./Starfield";
import { eventBus, GameEvents } from "../utils/EventBus";
import { COLORS, VFX } from "../config/constants";

/**
 * Central VFX manager - coordinates all visual effects
 * Uses GPU-based ParticleSystem exactly like reference
 */
export class VFXManager {
  private scene: THREE.Scene;

  // Systems - matching reference exactly
  private particles: ParticleSystem; // GPU-based like reference
  private trail: Trail; // Line trail like reference TrailSystem
  private starfield: Starfield;

  // Effects
  private gemCaptureEffect: GemCaptureEffect;
  private levelCompleteEffect: LevelCompleteEffect;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create GPU-based particle system (like reference)
    this.particles = new ParticleSystem(scene, 500);

    // Create line trail (like reference TrailSystem)
    this.trail = new Trail(scene);

    // Create starfield background
    this.starfield = new Starfield(scene);

    // Create effects
    this.gemCaptureEffect = new GemCaptureEffect(scene, this.particles);
    this.levelCompleteEffect = new LevelCompleteEffect(scene, this.particles);

    // Subscribe to game events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Gem collected - trigger particle burst
    eventBus.on<{ id: string; position: THREE.Vector3; color: THREE.Color }>(
      GameEvents.GEM_COLLECTED,
      ({ position, color }) => {
        this.gemCapture(position, color);
      },
    );

    // Player jump - downward particle burst
    eventBus.on<{ position: THREE.Vector3 }>(
      GameEvents.PLAYER_JUMP,
      ({ position }) => {
        this.playerJump(position);
      },
    );

    // Player respawn - explosion at death position
    eventBus.on<{ position: THREE.Vector3 }>(
      GameEvents.PLAYER_RESPAWN,
      ({ position }) => {
        this.playerRespawn(position);
      },
    );

    // Checkpoint activated - cyan/green burst
    eventBus.on<{ position: THREE.Vector3 }>(
      GameEvents.CHECKPOINT_ACTIVATED,
      ({ position }) => {
        this.checkpointActivated(position);
      },
    );

    // Hazard hit - red explosion
    eventBus.on<{ position: THREE.Vector3 }>(
      GameEvents.HAZARD_HIT,
      ({ position }) => {
        this.hazardHit(position);
      },
    );
  }

  /**
   * Update all VFX systems
   */
  update(dt: number, cameraPosition?: THREE.Vector3): void {
    this.particles.update(dt);

    // Update starfield to follow camera
    if (cameraPosition) {
      this.starfield.update(cameraPosition);
    }
  }

  /**
   * Update marble trails - line trail + particle trail
   * Exact copy of reference game.ts lines 610-618
   */
  updateTrail(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
  ): void {
    // Line trail (reference lines 610-614)
    this.trail.update(position, velocity, dt);

    // Particle trail - emit when moving fast
    // Reference uses > 5, but our speeds are capped lower, so use > 3
    if (velocity.length() > 3) {
      this.particles.emitTrail(position, velocity, COLORS.TRAIL);
    }
  }

  /**
   * Trigger gem capture effect at position
   */
  gemCapture(position: THREE.Vector3, color?: THREE.Color): void {
    this.gemCaptureEffect.trigger(position, color);
  }

  /**
   * Trigger jump effect - Reference: emit(position, 20, 0x00ffaa, 0.5, 3, 0.5)
   */
  playerJump(position: THREE.Vector3): void {
    this.particles.emit(
      position,
      VFX.JUMP_PARTICLE_COUNT, // 20
      0x00ffaa, // Reference COLORS.player
      0.5, // spread
      3, // speed
      0.5, // life
    );
  }

  /**
   * Trigger respawn explosion - Reference: emit(position, 30, 0xff0000, 1, 5, 1)
   */
  playerRespawn(position: THREE.Vector3): void {
    this.particles.emit(
      position,
      VFX.RESPAWN_PARTICLE_COUNT, // 30
      0xff0000, // Red
      1, // spread
      5, // speed
      1.0, // life
    );
  }

  /**
   * Trigger checkpoint activation - cyan then green burst
   */
  checkpointActivated(position: THREE.Vector3): void {
    // First burst: cyan (60% of total)
    const cyanCount = Math.floor(VFX.CHECKPOINT_PARTICLE_COUNT * 0.6);
    this.particles.emit(position, cyanCount, 0x88ccff, 0.5, 3, 0.6);

    // Second burst after delay: green (40% of total)
    const greenCount = VFX.CHECKPOINT_PARTICLE_COUNT - cyanCount;
    setTimeout(() => {
      this.particles.emit(position, greenCount, 0x44ff88, 0.5, 3.5, 0.6);
    }, 100);
  }

  /**
   * Trigger hazard hit effect - Reference: emit(position, 40, 0xff3333, 1, 6, 1)
   */
  hazardHit(position: THREE.Vector3): void {
    this.particles.emit(
      position,
      VFX.HAZARD_PARTICLE_COUNT, // 40
      0xff3333, // Reference COLORS.hazard
      1, // spread
      6, // speed
      1.0, // life
    );
  }

  /**
   * Trigger level completion effect
   */
  levelComplete(position: THREE.Vector3, onComplete?: () => void): void {
    this.levelCompleteEffect.trigger(position, onComplete);
  }

  /**
   * Clear trails (on respawn/level restart)
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
    this.gemCaptureEffect = new GemCaptureEffect(this.scene, this.particles);
    this.levelCompleteEffect = new LevelCompleteEffect(
      this.scene,
      this.particles,
    );
  }

  dispose(): void {
    this.trail.dispose();
    this.particles.dispose();
    this.starfield.dispose();
    this.gemCaptureEffect.dispose();
    this.levelCompleteEffect.dispose();
  }
}
