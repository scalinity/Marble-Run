/**
 * Rolling sound system for marble physics
 * Plays velocity-dependent rolling sounds based on surface type
 */

import * as THREE from "three";
import { SURFACE_ROLLING_SOUNDS } from "../config/ElementSounds";

interface RollingInstance {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  surface: string;
}

export class RollingAudioSystem {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  // Active rolling sound
  private activeRoll: RollingInstance | null = null;
  private currentSurface: string | null = null;

  // Track pending fade timeout
  private fadeTimeout: number | null = null;

  // Configuration
  private readonly MIN_VELOCITY = 0.5; // Below this = no sound
  private readonly MAX_VELOCITY = 8.0; // Velocity for max volume/pitch
  private readonly CROSSFADE_TIME = 0.15;

  // Pitch range per surface
  private readonly PITCH_RANGES: Record<string, [number, number]> = {
    roll_track: [0.8, 1.4],
    roll_metal: [0.9, 1.5],
    roll_ice: [1.0, 1.6],
    roll_conveyor: [0.7, 1.2],
  };

  // Volume scale per surface
  private readonly VOLUME_SCALES: Record<string, number> = {
    roll_track: 0.6,
    roll_metal: 0.7,
    roll_ice: 0.4,
    roll_conveyor: 0.6,
  };

  init(context: AudioContext, output: GainNode): void {
    this.context = context;
    this.output = output;
  }

  setBuffers(buffers: Map<string, AudioBuffer>): void {
    this.buffers = buffers;
  }

  /**
   * Update rolling sound based on player state
   */
  update(
    velocity: THREE.Vector3,
    surfaceType: string | null,
    isGrounded: boolean,
  ): void {
    const speed = velocity.length();

    // Stop sound if not grounded, too slow, or no surface
    if (!isGrounded || speed < this.MIN_VELOCITY || !surfaceType) {
      this.fadeOut();
      return;
    }

    // Get the rolling sound for this surface
    const soundName =
      SURFACE_ROLLING_SOUNDS[surfaceType] || SURFACE_ROLLING_SOUNDS.default;

    // Check if we need to change surface
    if (this.currentSurface !== soundName) {
      this.switchSurface(soundName);
    }

    // Update parameters based on velocity
    if (this.activeRoll && this.context) {
      const normalizedSpeed = Math.min(speed / this.MAX_VELOCITY, 1);

      // Volume: quadratic curve for natural feel
      const volumeScale = this.VOLUME_SCALES[soundName] ?? 0.6;
      const volume = Math.pow(normalizedSpeed, 1.5) * volumeScale;

      // Pitch: linear interpolation
      const [minPitch, maxPitch] = this.PITCH_RANGES[soundName] ?? [0.8, 1.4];
      const pitch = minPitch + normalizedSpeed * (maxPitch - minPitch);

      // Apply with smoothing
      this.activeRoll.gainNode.gain.setTargetAtTime(
        volume,
        this.context.currentTime,
        0.05,
      );
      this.activeRoll.source.playbackRate.setTargetAtTime(
        pitch,
        this.context.currentTime,
        0.05,
      );
    }
  }

  /**
   * Switch to a different surface sound
   */
  private switchSurface(soundName: string): void {
    // Fade out current
    this.fadeOut();

    // Start new sound
    this.startRolling(soundName);
    this.currentSurface = soundName;
  }

  /**
   * Start a rolling sound loop
   */
  private startRolling(soundName: string): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer) {
      console.debug(`RollingAudioSystem: Buffer not found: ${soundName}`);
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.context.createGain();
    gainNode.gain.value = 0; // Start silent, will fade in

    source.connect(gainNode);
    gainNode.connect(this.output);

    source.start();

    this.activeRoll = {
      source,
      gainNode,
      surface: soundName,
    };
  }

  /**
   * Fade out current rolling sound
   */
  private fadeOut(): void {
    if (!this.activeRoll || !this.context) return;

    const roll = this.activeRoll;
    this.activeRoll = null;
    this.currentSurface = null;

    roll.gainNode.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      this.CROSSFADE_TIME / 3,
    );

    this.fadeTimeout = window.setTimeout(
      () => {
        this.fadeTimeout = null;
        try {
          roll.source.stop();
        } catch {
          // Already stopped
        }
        roll.source.disconnect();
        roll.gainNode.disconnect();
      },
      this.CROSSFADE_TIME * 1000 + 50,
    );
  }

  /**
   * Stop immediately
   */
  stop(): void {
    // Clear any pending fade timeout
    if (this.fadeTimeout !== null) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    if (this.activeRoll) {
      try {
        this.activeRoll.source.stop();
      } catch {
        // Already stopped
      }
      this.activeRoll.source.disconnect();
      this.activeRoll.gainNode.disconnect();
      this.activeRoll = null;
      this.currentSurface = null;
    }
  }

  dispose(): void {
    this.stop();
    this.context = null;
    this.output = null;
  }
}
