/**
 * Ambient sound manager for background audio and kinematic piece sounds
 * Manages level-specific ambience and spatial loops for game elements
 */

import * as THREE from "three";
import { SpatialAudioEngine, SpatialLoopHandle } from "./SpatialAudioEngine";

export interface AmbientLayer {
  id: string;
  sound: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
}

export interface KinematicAmbientConfig {
  pieceType: string;
  sound: string;
  spatialRadius: number;
}

export interface LevelAmbience {
  base: AmbientLayer;
  layers: AmbientLayer[];
  kinematicSounds: KinematicAmbientConfig[];
}

// Level-specific ambience configurations
const LEVEL_AMBIENCE: Record<string, LevelAmbience> = {
  default: {
    base: {
      id: "base",
      sound: "amb_space",
      volume: 0.3,
      fadeIn: 2,
      fadeOut: 1,
      loop: true,
    },
    layers: [],
    kinematicSounds: [
      { pieceType: "conveyorBelt", sound: "conveyor_hum", spatialRadius: 8 },
      {
        pieceType: "rotatingPlatform",
        sound: "rotating_hum",
        spatialRadius: 6,
      },
      {
        pieceType: "spinnerHazard",
        sound: "spinner_whoosh",
        spatialRadius: 10,
      },
    ],
  },
};

interface ActiveLayerInstance {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

interface PieceData {
  id: string;
  type: string;
  position: [number, number, number];
}

export class AmbientManager {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private spatialEngine: SpatialAudioEngine | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  // Active ambient layers
  private activeLayers: Map<string, ActiveLayerInstance> = new Map();

  // Kinematic sounds (spatial loops attached to game pieces)
  private kinematicSounds: Map<string, SpatialLoopHandle> = new Map();

  // Current level ambience config
  private currentAmbience: LevelAmbience | null = null;

  // Track timeouts for cleanup
  private pendingTimeouts: Set<number> = new Set();

  init(
    context: AudioContext,
    output: GainNode,
    spatialEngine: SpatialAudioEngine,
  ): void {
    this.context = context;
    this.output = output;
    this.spatialEngine = spatialEngine;
  }

  /**
   * Set the buffer map (shared with SFXManager)
   */
  setBuffers(buffers: Map<string, AudioBuffer>): void {
    this.buffers = buffers;
  }

  /**
   * Set ambience for a level
   */
  setLevelAmbience(levelId: string, pieces: PieceData[]): void {
    // Get config for this level or default
    const config = LEVEL_AMBIENCE[levelId] || LEVEL_AMBIENCE.default;
    this.currentAmbience = config;

    // Transition to new ambience
    this.transitionToAmbience(config);

    // Register kinematic sounds for applicable pieces
    this.setupKinematicSounds(config, pieces);
  }

  /**
   * Transition to new ambient layers
   */
  private transitionToAmbience(config: LevelAmbience): void {
    // Fade out existing layers
    for (const [id, instance] of this.activeLayers) {
      this.fadeOutLayer(id, instance, 1);
    }

    // Start base layer
    this.startLayer(config.base);

    // Start additional layers
    for (const layer of config.layers) {
      this.startLayer(layer);
    }
  }

  /**
   * Start an ambient layer
   */
  private startLayer(layer: AmbientLayer): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(layer.sound);
    if (!buffer) {
      console.debug(`AmbientManager: Buffer not found: ${layer.sound}`);
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = layer.loop;

    const gainNode = this.context.createGain();
    gainNode.gain.value = 0; // Start silent

    source.connect(gainNode);
    gainNode.connect(this.output);

    // Fade in
    gainNode.gain.setTargetAtTime(
      layer.volume,
      this.context.currentTime,
      layer.fadeIn / 3,
    );

    source.start();

    this.activeLayers.set(layer.id, { source, gainNode });

    // Handle non-looping layers ending
    if (!layer.loop) {
      source.onended = () => {
        this.activeLayers.delete(layer.id);
      };
    }
  }

  /**
   * Fade out and remove a layer
   */
  private fadeOutLayer(
    id: string,
    instance: ActiveLayerInstance,
    fadeTime: number,
  ): void {
    if (!this.context) return;

    instance.gainNode.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      fadeTime / 3,
    );

    const timeoutId = window.setTimeout(
      () => {
        this.pendingTimeouts.delete(timeoutId);
        try {
          instance.source.stop();
        } catch {
          // Already stopped
        }
        instance.source.disconnect();
        instance.gainNode.disconnect();
        this.activeLayers.delete(id);
      },
      fadeTime * 1000 + 100,
    );
    this.pendingTimeouts.add(timeoutId);
  }

  /**
   * Setup spatial sounds for kinematic pieces
   */
  private setupKinematicSounds(
    config: LevelAmbience,
    pieces: PieceData[],
  ): void {
    // Stop existing kinematic sounds
    this.stopAllKinematicSounds();

    if (!this.spatialEngine) return;

    // Create spatial loops for matching pieces
    for (const piece of pieces) {
      const kinematicConfig = config.kinematicSounds.find(
        (k) => k.pieceType === piece.type,
      );

      if (kinematicConfig) {
        const position = new THREE.Vector3(
          piece.position[0],
          piece.position[1],
          piece.position[2],
        );

        const handle = this.spatialEngine.createSpatialLoop(
          kinematicConfig.sound,
          position,
          {
            refDistance: kinematicConfig.spatialRadius * 0.5,
            maxDistance: kinematicConfig.spatialRadius * 2,
            volume: 0.5,
          },
        );

        this.kinematicSounds.set(piece.id, handle);
      }
    }
  }

  /**
   * Update position of a kinematic piece's sound
   */
  updateKinematicPosition(pieceId: string, position: THREE.Vector3): void {
    const handle = this.kinematicSounds.get(pieceId);
    if (handle) {
      handle.setPosition(position);
    }
  }

  /**
   * Stop a specific kinematic sound
   */
  stopKinematicSound(pieceId: string): void {
    const handle = this.kinematicSounds.get(pieceId);
    if (handle) {
      handle.stop();
      this.kinematicSounds.delete(pieceId);
    }
  }

  /**
   * Stop all kinematic sounds
   */
  private stopAllKinematicSounds(): void {
    for (const handle of this.kinematicSounds.values()) {
      handle.stop();
    }
    this.kinematicSounds.clear();
  }

  /**
   * Pause all ambient sounds (for pause menu)
   */
  pause(): void {
    if (!this.context) return;

    for (const instance of this.activeLayers.values()) {
      instance.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
    }

    for (const handle of this.kinematicSounds.values()) {
      handle.setVolume(0);
    }
  }

  /**
   * Resume all ambient sounds
   */
  resume(): void {
    if (!this.context || !this.currentAmbience) return;

    // Restore layer volumes
    const layerVolumes = new Map<string, number>();
    layerVolumes.set(
      this.currentAmbience.base.id,
      this.currentAmbience.base.volume,
    );
    for (const layer of this.currentAmbience.layers) {
      layerVolumes.set(layer.id, layer.volume);
    }

    for (const [id, instance] of this.activeLayers) {
      const volume = layerVolumes.get(id) ?? 0.3;
      instance.gainNode.gain.setTargetAtTime(
        volume,
        this.context.currentTime,
        0.3,
      );
    }

    // Restore kinematic sound volumes
    for (const handle of this.kinematicSounds.values()) {
      handle.setVolume(0.5);
    }
  }

  /**
   * Stop all ambient sounds
   */
  stopAll(): void {
    // Stop layers
    for (const [id, instance] of this.activeLayers) {
      this.fadeOutLayer(id, instance, 0.5);
    }

    // Stop kinematic sounds
    this.stopAllKinematicSounds();
  }

  dispose(): void {
    // Clear pending timeouts first
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();

    this.stopAll();
    this.context = null;
    this.output = null;
    this.spatialEngine = null;
    this.currentAmbience = null;
  }
}
