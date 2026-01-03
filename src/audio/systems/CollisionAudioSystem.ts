/**
 * Collision audio system for impact sounds
 * Plays sounds based on collision force and surface type
 */

import * as THREE from "three";
import { IMPACT_SOUNDS, IMPACT_THRESHOLDS } from "../config/ElementSounds";
import { SpatialAudioEngine } from "../SpatialAudioEngine";

export interface CollisionEvent {
  impactForce: number; // 0-1 normalized
  position: THREE.Vector3;
  surfaceType?: string;
}

export class CollisionAudioSystem {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private spatialEngine: SpatialAudioEngine | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  // Cooldown to prevent audio spam
  private lastImpactTime = 0;
  private readonly IMPACT_COOLDOWN = 0.05; // 50ms minimum between impacts

  // Minimum force to trigger sound
  private readonly MIN_FORCE = 0.1;

  init(
    context: AudioContext,
    output: GainNode,
    spatialEngine: SpatialAudioEngine,
  ): void {
    this.context = context;
    this.output = output;
    this.spatialEngine = spatialEngine;
  }

  setBuffers(buffers: Map<string, AudioBuffer>): void {
    this.buffers = buffers;
  }

  /**
   * Handle a collision event
   */
  handleCollision(event: CollisionEvent): void {
    if (!this.context) return;

    const { impactForce, position } = event;

    // Skip if below minimum force
    if (impactForce < this.MIN_FORCE) return;

    // Check cooldown
    const now = this.context.currentTime;
    if (now - this.lastImpactTime < this.IMPACT_COOLDOWN) return;
    this.lastImpactTime = now;

    // Select sound based on impact intensity
    let soundName: string;
    if (impactForce < IMPACT_THRESHOLDS.light) {
      return; // Too weak
    } else if (impactForce < IMPACT_THRESHOLDS.medium) {
      soundName = IMPACT_SOUNDS.light;
    } else if (impactForce < IMPACT_THRESHOLDS.heavy) {
      soundName = IMPACT_SOUNDS.medium;
    } else {
      soundName = IMPACT_SOUNDS.heavy;
    }

    // Calculate pitch variation
    const pitchVariation = 0.9 + Math.random() * 0.2;

    // Calculate volume from force
    const volume = 0.3 + impactForce * 0.7;

    // Play with spatial positioning if available
    if (this.spatialEngine) {
      this.spatialEngine.playAt(soundName, position, {
        volume,
        playbackRate: pitchVariation,
        rolloff: "exponential",
        refDistance: 2,
        maxDistance: 50,
      });
    } else {
      // Fallback to non-spatial playback
      this.playNonSpatial(soundName, volume, pitchVariation);
    }
  }

  /**
   * Play collision from velocity change (for simple integration)
   */
  playFromVelocityChange(
    previousVelocity: THREE.Vector3,
    currentVelocity: THREE.Vector3,
    position: THREE.Vector3,
  ): void {
    const velocityChange = previousVelocity
      .clone()
      .sub(currentVelocity)
      .length();

    // Normalize to 0-1 range (assuming max velocity change of ~20)
    const impactForce = Math.min(velocityChange / 20, 1);

    this.handleCollision({
      impactForce,
      position,
    });
  }

  /**
   * Non-spatial playback fallback
   */
  private playNonSpatial(
    soundName: string,
    volume: number,
    playbackRate: number,
  ): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.output);

    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };

    source.start();
  }

  dispose(): void {
    this.context = null;
    this.output = null;
    this.spatialEngine = null;
  }
}
