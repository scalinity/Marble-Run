# Marble Run - Comprehensive Audio System Design

## Overview

This document specifies a complete audio system for Marble Run, designed to maximize player immersion through dynamic, responsive sound design. The system integrates with the existing Web Audio API foundation and event-driven architecture.

---

## Table of Contents

1. [Audio Architecture Design](#1-audio-architecture-design)
2. [Marble Physics Audio](#2-marble-physics-audio)
3. [Environmental Audio](#3-environmental-audio)
4. [Interactive Element Sounds](#4-interactive-element-sounds)
5. [Dynamic Music System](#5-dynamic-music-system)
6. [Audio Feedback Systems](#6-audio-feedback-systems)
7. [Asset Specifications](#7-asset-specifications)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Audio Architecture Design

### 1.1 Core Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AudioDirector                              │
│  (Master controller - coordinates all audio subsystems)          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ SFXManager  │  │MusicManager │  │AmbientManager│              │
│  │  (OneShot)  │  │ (Adaptive)  │  │  (Loops)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                       │
│  ┌──────┴──────────────────┴──────────────┴──────┐               │
│  │                  MixerBus                      │               │
│  │  ┌─────────┬─────────┬─────────┬──────────┐  │               │
│  │  │ Master  │   SFX   │  Music  │ Ambient  │  │               │
│  │  │ Channel │ Channel │ Channel │ Channel  │  │               │
│  │  └────┬────┴────┬────┴────┬────┴────┬─────┘  │               │
│  │       │         │         │         │         │               │
│  │       └─────────┴─────────┴─────────┘         │               │
│  │                     │                          │               │
│  │              AudioContext                      │               │
│  │                Destination                     │               │
│  └───────────────────────────────────────────────┘               │
│                                                                   │
│  ┌────────────────────────────────────────────────┐              │
│  │              SpatialAudioEngine                 │              │
│  │  (3D positioning, panning, distance falloff)   │              │
│  └────────────────────────────────────────────────┘              │
│                                                                   │
│  ┌────────────────────────────────────────────────┐              │
│  │               AudioPool                         │              │
│  │  (Pre-allocated sound instances for perf)      │              │
│  └────────────────────────────────────────────────┘              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Technical Specification

```typescript
// src/audio/AudioDirector.ts
export class AudioDirector {
  private context: AudioContext;
  private mixerBus: MixerBus;
  private sfxManager: SFXManager;
  private musicManager: MusicManager;
  private ambientManager: AmbientManager;
  private spatialEngine: SpatialAudioEngine;
  private audioPool: AudioPool;

  // Settings persistence
  private settings: AudioSettings;

  async init(): Promise<void>;

  // Main update loop - call from Game.update()
  update(dt: number, playerPosition: Vector3, cameraPosition: Vector3): void;

  // Volume controls
  setMasterVolume(v: number): void;
  setSFXVolume(v: number): void;
  setMusicVolume(v: number): void;
  setAmbientVolume(v: number): void;

  // Settings
  saveSettings(): void;
  loadSettings(): void;

  dispose(): void;
}

// src/audio/MixerBus.ts
export class MixerBus {
  private masterGain: GainNode;
  private sfxGain: GainNode;
  private musicGain: GainNode;
  private ambientGain: GainNode;

  // Compressor on master for dynamic range control
  private compressor: DynamicsCompressorNode;

  constructor(context: AudioContext) {
    // Create gain nodes
    this.masterGain = context.createGain();
    this.sfxGain = context.createGain();
    this.musicGain = context.createGain();
    this.ambientGain = context.createGain();

    // Create compressor for final output
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Connect routing
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(context.destination);
  }

  getSFXOutput(): GainNode {
    return this.sfxGain;
  }
  getMusicOutput(): GainNode {
    return this.musicGain;
  }
  getAmbientOutput(): GainNode {
    return this.ambientGain;
  }
}
```

### 1.3 Audio Pooling System

```typescript
// src/audio/AudioPool.ts
interface PooledSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  inUse: boolean;
  soundName: string;
  startTime: number;
}

export class AudioPool {
  private pool: Map<string, PooledSound[]> = new Map();
  private context: AudioContext;

  // Pre-allocate instances for frequently-played sounds
  private readonly poolSizes: Record<string, number> = {
    // Physics sounds (high frequency)
    roll_wood: 3,
    roll_metal: 3,
    roll_stone: 3,
    impact_light: 8,
    impact_medium: 6,
    impact_heavy: 4,

    // Interaction sounds (medium frequency)
    jump: 4,
    land: 4,
    gem: 6,
    bounce: 4,

    // UI sounds
    ui_click: 3,
    ui_hover: 2,
  };

  init(context: AudioContext, buffers: Map<string, AudioBuffer>): void {
    this.context = context;

    // Pre-allocate pool for each sound type
    for (const [soundName, size] of Object.entries(this.poolSizes)) {
      const buffer = buffers.get(soundName);
      if (buffer) {
        this.pool.set(
          soundName,
          this.createPooledInstances(soundName, buffer, size),
        );
      }
    }
  }

  private createPooledInstances(
    name: string,
    buffer: AudioBuffer,
    count: number,
  ): PooledSound[] {
    const instances: PooledSound[] = [];
    for (let i = 0; i < count; i++) {
      instances.push(this.createInstance(name, buffer));
    }
    return instances;
  }

  private createInstance(name: string, buffer: AudioBuffer): PooledSound {
    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    const pannerNode = this.context.createStereoPanner();

    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(pannerNode);

    return {
      source,
      gainNode,
      pannerNode,
      inUse: false,
      soundName: name,
      startTime: 0,
    };
  }

  acquire(soundName: string): PooledSound | null {
    const instances = this.pool.get(soundName);
    if (!instances) return null;

    // Find available instance
    const available = instances.find((i) => !i.inUse);
    if (available) {
      available.inUse = true;
      available.startTime = this.context.currentTime;
      return available;
    }

    // Steal oldest if all in use
    const oldest = instances.reduce((a, b) =>
      a.startTime < b.startTime ? a : b,
    );
    oldest.source.stop();
    return this.resetInstance(oldest);
  }

  release(sound: PooledSound): void {
    sound.inUse = false;
  }

  private resetInstance(sound: PooledSound): PooledSound {
    // Create new source node (can't reuse after stop)
    const buffer = sound.source.buffer!;
    const newSource = this.context.createBufferSource();
    newSource.buffer = buffer;
    newSource.connect(sound.gainNode);

    sound.source = newSource;
    sound.inUse = true;
    sound.startTime = this.context.currentTime;
    return sound;
  }
}
```

### 1.4 Settings Persistence

```typescript
// src/audio/AudioSettings.ts
export interface AudioSettings {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  musicVolume: number; // 0-1
  ambientVolume: number; // 0-1
  muted: boolean;
  spatialAudioEnabled: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  ambientVolume: 0.6,
  muted: false,
  spatialAudioEnabled: true,
};

const STORAGE_KEY = "marble-run-audio-settings";

export function loadAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load audio settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save audio settings:", e);
  }
}
```

### 1.5 Integration Points

**Game.ts Integration:**

```typescript
// In Game.update()
this.audioDirector.update(
  dt,
  this.player.getPosition(),
  this.cameraRig.getPosition(),
);
```

**Level Loading:**

```typescript
// When level loads, inform audio system of level theme
audioDirector.setLevelContext({
  theme: level.theme || "default",
  intensity: level.difficulty,
  hasHazards: level.pieces.some((p) => p.type === "hazard"),
});
```

---

## 2. Marble Physics Audio

### 2.1 Rolling Sound System

The rolling sound system dynamically generates audio based on marble velocity and surface material.

```typescript
// src/audio/systems/RollingAudioSystem.ts
export interface SurfaceAudioConfig {
  baseSound: string; // Base rolling loop
  variants: string[]; // Pitch/texture variants
  pitchRange: [number, number]; // Min/max playback rate
  volumeScale: number; // Material loudness modifier
  grainSize: number; // For granular synthesis approach
}

export const SURFACE_CONFIGS: Record<string, SurfaceAudioConfig> = {
  track: {
    baseSound: "roll_track",
    variants: ["roll_track_var1", "roll_track_var2"],
    pitchRange: [0.8, 1.4],
    volumeScale: 0.7,
    grainSize: 0.1,
  },
  metal: {
    baseSound: "roll_metal",
    variants: ["roll_metal_bright", "roll_metal_dark"],
    pitchRange: [0.9, 1.5],
    volumeScale: 0.9,
    grainSize: 0.08,
  },
  ice: {
    baseSound: "roll_ice",
    variants: ["roll_ice_slide"],
    pitchRange: [1.0, 1.6],
    volumeScale: 0.5, // Quieter on ice
    grainSize: 0.15,
  },
  conveyor: {
    baseSound: "roll_conveyor",
    variants: ["roll_conveyor_rubber"],
    pitchRange: [0.7, 1.2],
    volumeScale: 0.8,
    grainSize: 0.12,
  },
};

export class RollingAudioSystem {
  private context: AudioContext;
  private output: GainNode;

  // Active rolling sounds (one per surface type in contact)
  private activeRolls: Map<string, RollingInstance> = new Map();

  // Crossfade duration between surfaces
  private readonly CROSSFADE_TIME = 0.1;

  // Velocity thresholds
  private readonly MIN_VELOCITY = 0.3; // Below this = no sound
  private readonly MAX_VELOCITY = 8.0; // Velocity for max volume/pitch

  update(
    velocity: Vector3,
    contactSurface: string | null,
    isGrounded: boolean,
  ): void {
    const speed = velocity.length();

    // Stop all if not grounded or below threshold
    if (!isGrounded || speed < this.MIN_VELOCITY || !contactSurface) {
      this.fadeOutAll();
      return;
    }

    // Get or create rolling instance for this surface
    const config = SURFACE_CONFIGS[contactSurface] || SURFACE_CONFIGS.track;
    let roll = this.activeRolls.get(contactSurface);

    if (!roll) {
      roll = this.createRollingInstance(contactSurface, config);
      this.activeRolls.set(contactSurface, roll);
    }

    // Calculate parameters from velocity
    const normalizedSpeed = Math.min(speed / this.MAX_VELOCITY, 1);

    // Volume: quadratic curve for natural feel
    const volume = Math.pow(normalizedSpeed, 1.5) * config.volumeScale;

    // Pitch: linear interpolation in pitch range
    const [minPitch, maxPitch] = config.pitchRange;
    const pitch = minPitch + normalizedSpeed * (maxPitch - minPitch);

    // Apply with smoothing
    roll.setVolume(volume);
    roll.setPitch(pitch);

    // Fade out other surfaces
    for (const [surface, instance] of this.activeRolls) {
      if (surface !== contactSurface) {
        instance.fadeOut(this.CROSSFADE_TIME);
      }
    }
  }

  private createRollingInstance(
    surface: string,
    config: SurfaceAudioConfig,
  ): RollingInstance {
    // Implementation creates looping source with gain envelope
    // Uses granular approach for smooth pitch shifting
  }
}

interface RollingInstance {
  setVolume(v: number): void;
  setPitch(p: number): void;
  fadeOut(duration: number): void;
  dispose(): void;
}
```

### 2.2 Collision Sound System

```typescript
// src/audio/systems/CollisionAudioSystem.ts
export interface CollisionEvent {
  impactForce: number; // 0-1 normalized
  relativeVelocity: Vector3;
  surfaceType: string;
  position: Vector3;
}

export class CollisionAudioSystem {
  // Impact thresholds
  private readonly LIGHT_IMPACT = 0.2;
  private readonly MEDIUM_IMPACT = 0.5;
  private readonly HEAVY_IMPACT = 0.8;

  // Cooldown to prevent audio spam
  private lastImpactTime = 0;
  private readonly IMPACT_COOLDOWN = 0.05; // 50ms minimum between impacts

  handleCollision(event: CollisionEvent): void {
    const now = performance.now() / 1000;
    if (now - this.lastImpactTime < this.IMPACT_COOLDOWN) return;
    this.lastImpactTime = now;

    const { impactForce, relativeVelocity, surfaceType, position } = event;

    // Select sound based on impact intensity
    let soundName: string;
    if (impactForce < this.LIGHT_IMPACT) {
      soundName = `impact_${surfaceType}_light`;
    } else if (impactForce < this.MEDIUM_IMPACT) {
      soundName = `impact_${surfaceType}_medium`;
    } else {
      soundName = `impact_${surfaceType}_heavy`;
    }

    // Calculate pitch variation based on impact angle
    const pitchVariation = 0.9 + Math.random() * 0.2;

    // Calculate volume from force
    const volume = 0.3 + impactForce * 0.7;

    // Play with spatial positioning
    this.spatialEngine.playAt(soundName, position, {
      volume,
      playbackRate: pitchVariation,
      rolloff: "exponential",
      refDistance: 2,
      maxDistance: 50,
    });
  }
}
```

### 2.3 Friction and Sliding Audio

```typescript
// src/audio/systems/FrictionAudioSystem.ts
export class FrictionAudioSystem {
  private slideSound: AudioBufferSourceNode | null = null;
  private slideGain: GainNode;

  // State tracking
  private isSliding = false;
  private slideStartTime = 0;

  update(
    velocity: Vector3,
    surfaceNormal: Vector3,
    friction: number,
    isGrounded: boolean,
  ): void {
    // Detect sliding: moving but friction is low (ice) or steep slope
    const speed = velocity.length();
    const isOnIce = friction < 0.1;
    const slopeAngle = Math.acos(surfaceNormal.y) * (180 / Math.PI);
    const isOnSteepSlope = slopeAngle > 30 && isGrounded;

    const shouldSlide = isGrounded && speed > 1 && (isOnIce || isOnSteepSlope);

    if (shouldSlide && !this.isSliding) {
      this.startSlide(isOnIce ? "slide_ice" : "slide_slope");
    } else if (!shouldSlide && this.isSliding) {
      this.stopSlide();
    }

    if (this.isSliding) {
      // Modulate based on speed
      const normalizedSpeed = Math.min(speed / 6, 1);
      this.slideGain.gain.setTargetAtTime(
        normalizedSpeed * 0.6,
        this.context.currentTime,
        0.1,
      );
    }
  }
}
```

### 2.4 Required Assets - Marble Physics

| Asset Name                 | Description                 | Duration | Format    |
| -------------------------- | --------------------------- | -------- | --------- |
| `roll_track.webm`          | Standard track rolling loop | 2s loop  | WebM/Opus |
| `roll_track_var1.webm`     | Track variant (grittier)    | 2s loop  | WebM/Opus |
| `roll_track_var2.webm`     | Track variant (smoother)    | 2s loop  | WebM/Opus |
| `roll_metal.webm`          | Metal surface rolling       | 2s loop  | WebM/Opus |
| `roll_metal_bright.webm`   | Metal variant (high freq)   | 2s loop  | WebM/Opus |
| `roll_ice.webm`            | Ice surface rolling         | 2s loop  | WebM/Opus |
| `roll_ice_slide.webm`      | Ice sliding texture         | 2s loop  | WebM/Opus |
| `roll_conveyor.webm`       | Conveyor rubber surface     | 2s loop  | WebM/Opus |
| `impact_track_light.webm`  | Light track impact          | 0.3s     | WebM/Opus |
| `impact_track_medium.webm` | Medium track impact         | 0.4s     | WebM/Opus |
| `impact_track_heavy.webm`  | Heavy track impact          | 0.5s     | WebM/Opus |
| `impact_metal_light.webm`  | Light metal impact          | 0.3s     | WebM/Opus |
| `impact_metal_medium.webm` | Medium metal impact         | 0.4s     | WebM/Opus |
| `impact_metal_heavy.webm`  | Heavy metal impact          | 0.5s     | WebM/Opus |
| `slide_ice.webm`           | Ice sliding loop            | 2s loop  | WebM/Opus |
| `slide_slope.webm`         | Slope sliding loop          | 2s loop  | WebM/Opus |

---

## 3. Environmental Audio

### 3.1 Spatial Audio Engine

```typescript
// src/audio/SpatialAudioEngine.ts
export interface SpatialConfig {
  volume?: number;
  playbackRate?: number;
  rolloff?: "linear" | "inverse" | "exponential";
  refDistance?: number;
  maxDistance?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

export class SpatialAudioEngine {
  private context: AudioContext;
  private listener: AudioListener;
  private output: GainNode;

  // Active spatial sources
  private activeSources: Map<string, PannerNode> = new Map();

  constructor(context: AudioContext, output: GainNode) {
    this.context = context;
    this.output = output;
    this.listener = context.listener;
  }

  /**
   * Update listener position (call every frame)
   */
  updateListener(position: Vector3, forward: Vector3, up: Vector3): void {
    const t = this.context.currentTime;

    // Position
    if (this.listener.positionX) {
      // Modern API
      this.listener.positionX.setValueAtTime(position.x, t);
      this.listener.positionY.setValueAtTime(position.y, t);
      this.listener.positionZ.setValueAtTime(position.z, t);

      // Orientation
      this.listener.forwardX.setValueAtTime(forward.x, t);
      this.listener.forwardY.setValueAtTime(forward.y, t);
      this.listener.forwardZ.setValueAtTime(forward.z, t);
      this.listener.upX.setValueAtTime(up.x, t);
      this.listener.upY.setValueAtTime(up.y, t);
      this.listener.upZ.setValueAtTime(up.z, t);
    } else {
      // Legacy API fallback
      this.listener.setPosition(position.x, position.y, position.z);
      this.listener.setOrientation(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z,
      );
    }
  }

  /**
   * Play a one-shot sound at a 3D position
   */
  playAt(
    soundName: string,
    position: Vector3,
    config: SpatialConfig = {},
  ): void {
    const buffer = this.buffers.get(soundName);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = config.playbackRate || 1;

    const gainNode = this.context.createGain();
    gainNode.gain.value = config.volume || 1;

    const panner = this.context.createPanner();
    panner.panningModel = "HRTF"; // Realistic 3D audio
    panner.distanceModel = config.rolloff || "inverse";
    panner.refDistance = config.refDistance || 1;
    panner.maxDistance = config.maxDistance || 50;
    panner.rolloffFactor = 1;

    // Set position
    panner.positionX.setValueAtTime(position.x, this.context.currentTime);
    panner.positionY.setValueAtTime(position.y, this.context.currentTime);
    panner.positionZ.setValueAtTime(position.z, this.context.currentTime);

    // Connect chain
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.output);

    source.start();

    // Cleanup on end
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    };
  }

  /**
   * Create a persistent spatial sound source (for ambient loops)
   */
  createSpatialLoop(
    soundName: string,
    position: Vector3,
    config: SpatialConfig = {},
  ): SpatialLoopHandle {
    // Returns handle to control/stop the loop
  }
}
```

### 3.2 Reverb Zones

```typescript
// src/audio/systems/ReverbSystem.ts
export interface ReverbZone {
  id: string;
  position: Vector3;
  radius: number;
  impulseResponse: string; // Convolver buffer name
  wetMix: number; // 0-1 blend
  fadeDistance: number; // Crossfade range
}

export const REVERB_PRESETS: Record<string, Partial<ReverbZone>> = {
  outdoor: {
    impulseResponse: "ir_outdoor",
    wetMix: 0.15,
  },
  indoor: {
    impulseResponse: "ir_room",
    wetMix: 0.35,
  },
  cave: {
    impulseResponse: "ir_cave",
    wetMix: 0.6,
  },
  metallic: {
    impulseResponse: "ir_metallic",
    wetMix: 0.4,
  },
};

export class ReverbSystem {
  private context: AudioContext;
  private convolver: ConvolverNode;
  private dryGain: GainNode;
  private wetGain: GainNode;

  private currentPreset: string = "outdoor";
  private activeZones: ReverbZone[] = [];

  constructor(context: AudioContext, input: GainNode, output: GainNode) {
    this.context = context;

    // Create convolver
    this.convolver = context.createConvolver();

    // Dry/wet mix gains
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    // Routing: input splits to dry and convolver
    input.connect(this.dryGain);
    input.connect(this.convolver);
    this.convolver.connect(this.wetGain);

    // Both merge to output
    this.dryGain.connect(output);
    this.wetGain.connect(output);

    // Default mix
    this.setWetMix(0.2);
  }

  /**
   * Update reverb based on player position
   */
  update(playerPosition: Vector3): void {
    // Find zones player is in, blend based on distance
    let totalWet = 0;
    let dominantPreset = "outdoor";
    let maxInfluence = 0;

    for (const zone of this.activeZones) {
      const dist = playerPosition.distanceTo(zone.position);
      if (dist < zone.radius + zone.fadeDistance) {
        const influence =
          1 - Math.max(0, dist - zone.radius) / zone.fadeDistance;
        totalWet += zone.wetMix * influence;

        if (influence > maxInfluence) {
          maxInfluence = influence;
          dominantPreset = zone.id;
        }
      }
    }

    // Crossfade to new impulse response if dominant zone changed
    if (dominantPreset !== this.currentPreset) {
      this.crossfadeToPreset(dominantPreset);
    }

    this.setWetMix(Math.min(totalWet, 0.8));
  }

  private setWetMix(wet: number): void {
    const dry = 1 - wet * 0.5; // Keep dry mostly intact
    this.dryGain.gain.setTargetAtTime(dry, this.context.currentTime, 0.1);
    this.wetGain.gain.setTargetAtTime(wet, this.context.currentTime, 0.1);
  }

  private async crossfadeToPreset(preset: string): Promise<void> {
    // Load and crossfade to new impulse response
    this.currentPreset = preset;
  }
}
```

### 3.3 Ambient Soundscape Manager

```typescript
// src/audio/AmbientManager.ts
export interface AmbientLayer {
  id: string;
  sound: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
}

export interface LevelAmbience {
  base: AmbientLayer; // Always playing
  layers: AmbientLayer[]; // Conditional layers
  kinematicSounds: KinematicAmbientConfig[];
}

export const LEVEL_AMBIENCE: Record<string, LevelAmbience> = {
  default: {
    base: {
      id: "base",
      sound: "amb_space",
      volume: 0.3,
      fadeIn: 2,
      fadeOut: 1,
      loop: true,
    },
    layers: [
      {
        id: "wind",
        sound: "amb_wind_light",
        volume: 0.15,
        fadeIn: 3,
        fadeOut: 2,
        loop: true,
      },
    ],
    kinematicSounds: [],
  },
  industrial: {
    base: {
      id: "base",
      sound: "amb_industrial",
      volume: 0.35,
      fadeIn: 2,
      fadeOut: 1,
      loop: true,
    },
    layers: [],
    kinematicSounds: [
      {
        pieceType: "conveyorBelt",
        sound: "amb_conveyor_hum",
        spatialRadius: 8,
      },
      {
        pieceType: "rotatingPlatform",
        sound: "amb_rotate_hum",
        spatialRadius: 6,
      },
      {
        pieceType: "spinnerHazard",
        sound: "amb_spinner_whoosh",
        spatialRadius: 10,
      },
    ],
  },
};

export interface KinematicAmbientConfig {
  pieceType: string;
  sound: string;
  spatialRadius: number;
}

export class AmbientManager {
  private activeLayers: Map<string, AmbientLayerInstance> = new Map();
  private kinematicSounds: Map<string, SpatialLoopHandle> = new Map();

  /**
   * Set ambience for level
   */
  setLevelAmbience(levelId: string, pieces: PieceData[]): void {
    const config = LEVEL_AMBIENCE[levelId] || LEVEL_AMBIENCE.default;

    // Fade out existing, fade in new base
    this.transitionToAmbience(config);

    // Register kinematic sounds for pieces
    for (const piece of pieces) {
      const kinematicConfig = config.kinematicSounds.find(
        (k) => k.pieceType === piece.type,
      );
      if (kinematicConfig) {
        this.registerKinematicSound(piece.id, piece.position, kinematicConfig);
      }
    }
  }

  /**
   * Register a spatial ambient sound for a kinematic piece
   */
  private registerKinematicSound(
    pieceId: string,
    position: Vector3,
    config: KinematicAmbientConfig,
  ): void {
    const handle = this.spatialEngine.createSpatialLoop(
      config.sound,
      position,
      {
        refDistance: config.spatialRadius * 0.5,
        maxDistance: config.spatialRadius * 2,
        volume: 0.5,
      },
    );
    this.kinematicSounds.set(pieceId, handle);
  }

  /**
   * Update kinematic piece positions (for moving platforms)
   */
  updateKinematicPosition(pieceId: string, position: Vector3): void {
    const handle = this.kinematicSounds.get(pieceId);
    if (handle) {
      handle.setPosition(position);
    }
  }

  dispose(): void {
    // Fade out and cleanup all ambient sounds
  }
}
```

### 3.4 Required Assets - Environmental

| Asset Name                | Description                | Duration | Format    |
| ------------------------- | -------------------------- | -------- | --------- |
| `amb_space.webm`          | Deep space ambient         | 30s loop | WebM/Opus |
| `amb_wind_light.webm`     | Light wind ambience        | 20s loop | WebM/Opus |
| `amb_industrial.webm`     | Industrial hum             | 30s loop | WebM/Opus |
| `amb_conveyor_hum.webm`   | Conveyor belt motor        | 4s loop  | WebM/Opus |
| `amb_rotate_hum.webm`     | Rotating platform          | 3s loop  | WebM/Opus |
| `amb_spinner_whoosh.webm` | Spinner hazard             | 2s loop  | WebM/Opus |
| `ir_outdoor.webm`         | Impulse response - outdoor | 2s       | WebM/Opus |
| `ir_room.webm`            | Impulse response - room    | 2s       | WebM/Opus |
| `ir_cave.webm`            | Impulse response - cave    | 3s       | WebM/Opus |
| `ir_metallic.webm`        | Impulse response - metal   | 2s       | WebM/Opus |

---

## 4. Interactive Element Sounds

### 4.1 Element Sound Catalog

```typescript
// src/audio/config/ElementSounds.ts
export interface ElementSoundConfig {
  trigger?: string; // One-shot on trigger
  anticipation?: string; // Sound before trigger
  sustain?: string; // Loop while active
  release?: string; // Sound when ending
  volume: number;
  spatial: boolean; // Use 3D positioning
  cooldown?: number; // Min time between plays
}

export const ELEMENT_SOUNDS: Record<string, ElementSoundConfig> = {
  // ============ COLLECTIBLES ============
  gem: {
    trigger: "gem_collect",
    anticipation: "gem_sparkle", // Nearby gems sparkle
    volume: 0.7,
    spatial: true,
  },
  checkpoint: {
    trigger: "checkpoint_activate",
    sustain: "checkpoint_hum", // Active checkpoint hums
    volume: 0.6,
    spatial: true,
  },
  goalGate: {
    anticipation: "goal_pulse", // Goal pulses when visible
    trigger: "goal_victory",
    volume: 0.8,
    spatial: true,
  },

  // ============ LAUNCHERS ============
  bouncePad: {
    trigger: "bounce_spring",
    anticipation: "bounce_charge", // Optional: charge sound
    volume: 0.7,
    spatial: true,
    cooldown: 0.1,
  },
  teleporter: {
    trigger: "teleport_whoosh",
    anticipation: "teleport_charge",
    release: "teleport_arrive",
    volume: 0.6,
    spatial: true,
    cooldown: 1.0,
  },

  // ============ HAZARDS ============
  spinnerHazard: {
    sustain: "spinner_whoosh",
    trigger: "hazard_hit",
    volume: 0.7,
    spatial: true,
  },
  collapsingPlatform: {
    anticipation: "collapse_creak", // Warning creak
    trigger: "collapse_break", // Platform breaks
    release: "collapse_respawn", // Platform respawns
    volume: 0.6,
    spatial: true,
  },

  // ============ PLATFORMS ============
  movingPlatform: {
    sustain: "platform_hum",
    volume: 0.4,
    spatial: true,
  },
  rotatingPlatform: {
    sustain: "rotate_whir",
    volume: 0.4,
    spatial: true,
  },
  conveyorBelt: {
    sustain: "conveyor_motor",
    volume: 0.5,
    spatial: true,
  },

  // ============ SURFACES ============
  iceSurface: {
    trigger: "ice_land",
    volume: 0.5,
    spatial: true,
  },

  // ============ POWER-UPS ============
  speedBoost: {
    trigger: "powerup_speed",
    sustain: "powerup_speed_active",
    release: "powerup_expire",
    volume: 0.7,
    spatial: true,
  },
  doubleJump: {
    trigger: "powerup_jump",
    release: "powerup_expire",
    volume: 0.7,
    spatial: true,
  },
  shield: {
    trigger: "powerup_shield",
    sustain: "shield_hum",
    release: "shield_break",
    volume: 0.6,
    spatial: true,
  },
};
```

### 4.2 Interaction Sound Manager

```typescript
// src/audio/systems/InteractionSoundManager.ts
export class InteractionSoundManager {
  private sustainingSounds: Map<string, SustainInstance> = new Map();
  private cooldowns: Map<string, number> = new Map();

  constructor(
    private sfxManager: SFXManager,
    private spatialEngine: SpatialAudioEngine,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Gems
    eventBus.on(GameEvents.GEM_COLLECTED, (data: { position: Vector3 }) => {
      this.playElementSound("gem", "trigger", data.position);
    });

    // Checkpoint
    eventBus.on(
      GameEvents.CHECKPOINT_ACTIVATED,
      (data: { position: Vector3 }) => {
        this.playElementSound("checkpoint", "trigger", data.position);
        this.startSustain("checkpoint", data.position);
      },
    );

    // Bounce
    eventBus.on(GameEvents.BOUNCE_PAD_HIT, (data: { position: Vector3 }) => {
      this.playElementSound("bouncePad", "trigger", data.position);
    });

    // Teleport
    eventBus.on(GameEvents.TELEPORT, (data: { from: Vector3; to: Vector3 }) => {
      this.playElementSound("teleporter", "trigger", data.from);
      setTimeout(() => {
        this.playElementSound("teleporter", "release", data.to);
      }, 100);
    });

    // Collapsing platform
    eventBus.on(
      GameEvents.PLATFORM_COLLAPSING,
      (data: { position: Vector3 }) => {
        this.playElementSound(
          "collapsingPlatform",
          "anticipation",
          data.position,
        );
      },
    );
    eventBus.on(GameEvents.PLATFORM_FELL, (data: { position: Vector3 }) => {
      this.playElementSound("collapsingPlatform", "trigger", data.position);
    });

    // Hazard
    eventBus.on(GameEvents.HAZARD_HIT, (data: { position: Vector3 }) => {
      this.playElementSound("spinnerHazard", "trigger", data.position);
    });

    // Power-ups
    eventBus.on(
      GameEvents.POWERUP_COLLECTED,
      (data: { type: string; position: Vector3 }) => {
        this.playElementSound(data.type, "trigger", data.position);
        this.startSustain(data.type, data.position);
      },
    );
    eventBus.on(GameEvents.POWERUP_EXPIRED, (data: { type: string }) => {
      this.playRelease(data.type);
      this.stopSustain(data.type);
    });

    // Goal
    eventBus.on(GameEvents.GOAL_REACHED, () => {
      this.sfxManager.play("goal_victory", { volume: 0.9 });
    });
  }

  private playElementSound(
    element: string,
    soundType: "trigger" | "anticipation" | "release",
    position?: Vector3,
  ): void {
    const config = ELEMENT_SOUNDS[element];
    if (!config) return;

    const soundName = config[soundType];
    if (!soundName) return;

    // Check cooldown
    const cooldownKey = `${element}_${soundType}`;
    const lastPlay = this.cooldowns.get(cooldownKey) || 0;
    const now = performance.now();
    if (config.cooldown && now - lastPlay < config.cooldown * 1000) {
      return;
    }
    this.cooldowns.set(cooldownKey, now);

    // Play spatial or non-spatial
    if (config.spatial && position) {
      this.spatialEngine.playAt(soundName, position, {
        volume: config.volume,
      });
    } else {
      this.sfxManager.play(soundName, { volume: config.volume });
    }
  }

  private startSustain(element: string, position: Vector3): void {
    const config = ELEMENT_SOUNDS[element];
    if (!config?.sustain) return;

    const handle = this.spatialEngine.createSpatialLoop(
      config.sustain,
      position,
      { volume: config.volume * 0.7 },
    );
    this.sustainingSounds.set(element, { handle, position });
  }

  private stopSustain(element: string): void {
    const instance = this.sustainingSounds.get(element);
    if (instance) {
      instance.handle.fadeOut(0.3);
      this.sustainingSounds.delete(element);
    }
  }

  private playRelease(element: string): void {
    const instance = this.sustainingSounds.get(element);
    const config = ELEMENT_SOUNDS[element];

    if (config?.release) {
      if (instance) {
        this.spatialEngine.playAt(config.release, instance.position, {
          volume: config.volume,
        });
      } else {
        this.sfxManager.play(config.release, { volume: config.volume });
      }
    }
  }
}

interface SustainInstance {
  handle: SpatialLoopHandle;
  position: Vector3;
}
```

### 4.3 Anticipation System

```typescript
// src/audio/systems/AnticipationSystem.ts
/**
 * Plays anticipation sounds when player approaches interactive elements
 */
export class AnticipationSystem {
  private anticipatingElements: Set<string> = new Set();

  // Distance thresholds
  private readonly ANTICIPATION_RANGE = 8; // Start anticipation
  private readonly TRIGGER_RANGE = 2; // Stop anticipation (about to trigger)

  update(
    playerPosition: Vector3,
    interactiveElements: InteractiveElement[],
  ): void {
    for (const element of interactiveElements) {
      const distance = playerPosition.distanceTo(element.position);
      const config = ELEMENT_SOUNDS[element.type];

      if (!config?.anticipation) continue;

      const isAnticipating = this.anticipatingElements.has(element.id);

      if (distance < this.ANTICIPATION_RANGE && distance > this.TRIGGER_RANGE) {
        if (!isAnticipating) {
          // Start anticipation
          this.startAnticipation(element);
        }
      } else if (isAnticipating) {
        // Stop anticipation
        this.stopAnticipation(element);
      }
    }
  }

  private startAnticipation(element: InteractiveElement): void {
    this.anticipatingElements.add(element.id);

    const config = ELEMENT_SOUNDS[element.type];
    if (config?.anticipation) {
      // Play looping anticipation or trigger one-shot
      this.spatialEngine.playAt(config.anticipation, element.position, {
        volume: config.volume * 0.5,
      });
    }
  }
}
```

### 4.4 Required Assets - Interactive Elements

| Asset Name                  | Description           | Duration | Format    |
| --------------------------- | --------------------- | -------- | --------- |
| **Collectibles**            |
| `gem_collect.webm`          | Gem collection chime  | 0.4s     | WebM/Opus |
| `gem_sparkle.webm`          | Nearby gem sparkle    | 1s loop  | WebM/Opus |
| `checkpoint_activate.webm`  | Checkpoint activation | 0.6s     | WebM/Opus |
| `checkpoint_hum.webm`       | Active checkpoint     | 2s loop  | WebM/Opus |
| `goal_pulse.webm`           | Goal anticipation     | 2s loop  | WebM/Opus |
| `goal_victory.webm`         | Goal reached fanfare  | 2s       | WebM/Opus |
| **Launchers**               |
| `bounce_spring.webm`        | Bounce pad spring     | 0.3s     | WebM/Opus |
| `bounce_charge.webm`        | Bounce anticipation   | 0.5s     | WebM/Opus |
| `teleport_whoosh.webm`      | Teleport departure    | 0.5s     | WebM/Opus |
| `teleport_arrive.webm`      | Teleport arrival      | 0.4s     | WebM/Opus |
| **Hazards**                 |
| `hazard_hit.webm`           | Generic hazard hit    | 0.4s     | WebM/Opus |
| `spinner_whoosh.webm`       | Spinner hazard loop   | 2s loop  | WebM/Opus |
| `collapse_creak.webm`       | Platform warning      | 0.8s     | WebM/Opus |
| `collapse_break.webm`       | Platform collapse     | 0.6s     | WebM/Opus |
| `collapse_respawn.webm`     | Platform respawn      | 0.4s     | WebM/Opus |
| **Platforms**               |
| `platform_hum.webm`         | Moving platform       | 3s loop  | WebM/Opus |
| `rotate_whir.webm`          | Rotating platform     | 2s loop  | WebM/Opus |
| `conveyor_motor.webm`       | Conveyor belt         | 3s loop  | WebM/Opus |
| **Power-ups**               |
| `powerup_speed.webm`        | Speed boost collect   | 0.5s     | WebM/Opus |
| `powerup_speed_active.webm` | Speed boost active    | 2s loop  | WebM/Opus |
| `powerup_jump.webm`         | Double jump collect   | 0.5s     | WebM/Opus |
| `powerup_shield.webm`       | Shield collect        | 0.5s     | WebM/Opus |
| `shield_hum.webm`           | Shield active         | 2s loop  | WebM/Opus |
| `shield_break.webm`         | Shield depleted       | 0.6s     | WebM/Opus |
| `powerup_expire.webm`       | Generic expire        | 0.4s     | WebM/Opus |
| **Surfaces**                |
| `ice_land.webm`             | Land on ice           | 0.3s     | WebM/Opus |

---

## 5. Dynamic Music System

### 5.1 Adaptive Music Architecture

```typescript
// src/audio/MusicManager.ts
export enum MusicState {
  MENU = "menu",
  EXPLORATION = "exploration",
  ACTION = "action",
  TENSION = "tension",
  VICTORY = "victory",
  FAILURE = "failure",
}

export interface MusicTrack {
  id: string;
  stems: MusicStem[];
  bpm: number;
  beatsPerBar: number;
  transitionBars: number; // How many bars to wait for clean transition
}

export interface MusicStem {
  name: string;
  url: string;
  states: MusicState[]; // Which states this stem plays in
  baseVolume: number;
}

export const MUSIC_TRACKS: Record<string, MusicTrack> = {
  main: {
    id: "main",
    bpm: 120,
    beatsPerBar: 4,
    transitionBars: 2,
    stems: [
      {
        name: "drums_light",
        url: "/audio/music/main_drums_light.webm",
        states: [MusicState.EXPLORATION, MusicState.MENU],
        baseVolume: 0.6,
      },
      {
        name: "drums_full",
        url: "/audio/music/main_drums_full.webm",
        states: [MusicState.ACTION, MusicState.TENSION],
        baseVolume: 0.7,
      },
      {
        name: "bass",
        url: "/audio/music/main_bass.webm",
        states: [MusicState.EXPLORATION, MusicState.ACTION, MusicState.TENSION],
        baseVolume: 0.5,
      },
      {
        name: "synth_pad",
        url: "/audio/music/main_pad.webm",
        states: [MusicState.MENU, MusicState.EXPLORATION],
        baseVolume: 0.4,
      },
      {
        name: "synth_lead",
        url: "/audio/music/main_lead.webm",
        states: [MusicState.ACTION],
        baseVolume: 0.5,
      },
      {
        name: "tension_layer",
        url: "/audio/music/main_tension.webm",
        states: [MusicState.TENSION],
        baseVolume: 0.6,
      },
    ],
  },
};

export class MusicManager {
  private context: AudioContext;
  private output: GainNode;

  // Active track state
  private currentTrack: MusicTrack | null = null;
  private stemSources: Map<string, AudioBufferSourceNode> = new Map();
  private stemGains: Map<string, GainNode> = new Map();

  // Timing
  private startTime: number = 0;
  private currentState: MusicState = MusicState.MENU;
  private targetState: MusicState = MusicState.MENU;
  private transitionScheduled: boolean = false;

  // Intensity tracking (0-1)
  private intensity: number = 0;
  private targetIntensity: number = 0;
  private readonly INTENSITY_LERP = 0.02;

  /**
   * Start playing a music track
   */
  async playTrack(trackId: string): Promise<void> {
    const track = MUSIC_TRACKS[trackId];
    if (!track) return;

    await this.loadTrack(track);

    this.currentTrack = track;
    this.startTime = this.context.currentTime;

    // Start all stems at same time (synchronized)
    for (const stem of track.stems) {
      const source = this.context.createBufferSource();
      const buffer = this.buffers.get(stem.url);
      if (!buffer) continue;

      source.buffer = buffer;
      source.loop = true;

      const gain = this.context.createGain();
      gain.gain.value = this.getStemVolume(stem);

      source.connect(gain);
      gain.connect(this.output);

      source.start(this.startTime);

      this.stemSources.set(stem.name, source);
      this.stemGains.set(stem.name, gain);
    }
  }

  /**
   * Request a state transition (waits for musical moment)
   */
  setState(state: MusicState): void {
    if (state === this.currentState) return;

    this.targetState = state;

    if (!this.transitionScheduled) {
      this.scheduleTransition();
    }
  }

  /**
   * Set gameplay intensity (affects stem mixing)
   */
  setIntensity(intensity: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Update music system (call every frame)
   */
  update(dt: number): void {
    // Lerp intensity
    this.intensity +=
      (this.targetIntensity - this.intensity) * this.INTENSITY_LERP;

    // Update stem volumes based on current state and intensity
    if (this.currentTrack) {
      for (const stem of this.currentTrack.stems) {
        const gain = this.stemGains.get(stem.name);
        if (gain) {
          const targetVolume = this.getStemVolume(stem);
          gain.gain.setTargetAtTime(
            targetVolume,
            this.context.currentTime,
            0.5, // Smooth volume changes
          );
        }
      }
    }
  }

  /**
   * Schedule state transition on next bar boundary
   */
  private scheduleTransition(): void {
    if (!this.currentTrack) return;

    const track = this.currentTrack;
    const barDuration = (60 / track.bpm) * track.beatsPerBar;
    const elapsed = this.context.currentTime - this.startTime;
    const currentBar = Math.floor(elapsed / barDuration);
    const nextTransitionBar = currentBar + track.transitionBars;
    const transitionTime = this.startTime + nextTransitionBar * barDuration;

    this.transitionScheduled = true;

    // Schedule the transition
    setTimeout(
      () => {
        this.currentState = this.targetState;
        this.transitionScheduled = false;

        // Check if state changed again during wait
        if (this.targetState !== this.currentState) {
          this.scheduleTransition();
        }
      },
      (transitionTime - this.context.currentTime) * 1000,
    );
  }

  /**
   * Calculate stem volume based on state and intensity
   */
  private getStemVolume(stem: MusicStem): number {
    const isActive = stem.states.includes(this.currentState);
    if (!isActive) return 0;

    // Modulate by intensity for certain stems
    let volume = stem.baseVolume;

    // Action stems increase with intensity
    if (stem.states.includes(MusicState.ACTION)) {
      volume *= 0.5 + this.intensity * 0.5;
    }

    // Exploration stems decrease with intensity
    if (
      stem.states.includes(MusicState.EXPLORATION) &&
      !stem.states.includes(MusicState.ACTION)
    ) {
      volume *= 1 - this.intensity * 0.3;
    }

    return volume;
  }

  /**
   * Play a musical stinger (one-shot on top of music)
   */
  playStinger(stingerId: string): void {
    // Stingers are short musical phrases for key moments
    this.sfxManager.play(stingerId, { volume: 0.8 });
  }

  /**
   * Stop music with fadeout
   */
  stop(fadeTime: number = 1): void {
    const now = this.context.currentTime;

    for (const [, gain] of this.stemGains) {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeTime);
    }

    setTimeout(() => {
      for (const [, source] of this.stemSources) {
        source.stop();
      }
      this.stemSources.clear();
      this.stemGains.clear();
      this.currentTrack = null;
    }, fadeTime * 1000);
  }
}
```

### 5.2 Intensity Calculator

```typescript
// src/audio/systems/IntensityCalculator.ts
/**
 * Calculates gameplay intensity for adaptive music
 */
export class IntensityCalculator {
  // Factors affecting intensity
  private speed: number = 0;
  private nearHazards: number = 0;
  private recentCollections: number = 0;
  private platformStability: number = 1; // 0 = unstable (collapsing), 1 = stable
  private timePressure: number = 0; // For timed levels

  // Decay rates
  private readonly COLLECTION_DECAY = 0.95; // Per frame

  // Collection tracking
  private collectionTimes: number[] = [];

  constructor() {
    eventBus.on(GameEvents.GEM_COLLECTED, () => this.onCollection());
    eventBus.on(GameEvents.BOUNCE_PAD_HIT, () => this.onCollection());
    eventBus.on(GameEvents.PLATFORM_COLLAPSING, () =>
      this.onPlatformCollapse(),
    );
  }

  update(
    playerVelocity: Vector3,
    hazardDistances: number[],
    dt: number,
  ): number {
    // Speed component (0-1)
    this.speed = Math.min(playerVelocity.length() / 8, 1);

    // Hazard proximity (0-1)
    const minHazardDist =
      hazardDistances.length > 0 ? Math.min(...hazardDistances) : Infinity;
    this.nearHazards = Math.max(0, 1 - minHazardDist / 10);

    // Decay recent collections
    this.recentCollections *= this.COLLECTION_DECAY;

    // Platform stability recovers over time
    this.platformStability = Math.min(1, this.platformStability + dt * 0.5);

    // Calculate combined intensity
    const intensity = Math.min(
      1,
      this.speed * 0.3 +
        this.nearHazards * 0.3 +
        this.recentCollections * 0.2 +
        (1 - this.platformStability) * 0.2,
    );

    return intensity;
  }

  private onCollection(): void {
    this.recentCollections = Math.min(1, this.recentCollections + 0.3);
  }

  private onPlatformCollapse(): void {
    this.platformStability = 0;
  }
}
```

### 5.3 Stinger System

```typescript
// src/audio/systems/StingerManager.ts
export const STINGERS = {
  // Victory/Achievement
  levelComplete: "stinger_victory",
  allGemsCollected: "stinger_all_gems",
  newBestTime: "stinger_best_time",

  // Tension/Warning
  lowTime: "stinger_time_warning",
  lastGem: "stinger_last_gem",

  // Failure
  fall: "stinger_fall",
  hazardDeath: "stinger_death",

  // Power-ups
  speedBoostStart: "stinger_speed",
  shieldBreak: "stinger_shield_break",
};

export class StingerManager {
  private lastStingerTime: Map<string, number> = new Map();
  private readonly MIN_STINGER_GAP = 2; // Seconds between same stinger

  constructor(private sfxManager: SFXManager) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on(GameEvents.LEVEL_COMPLETE, () => {
      this.playStinger("levelComplete");
    });

    eventBus.on(GameEvents.LEVEL_FAILED, () => {
      this.playStinger("fall");
    });

    eventBus.on(GameEvents.HAZARD_HIT, () => {
      this.playStinger("hazardDeath");
    });
  }

  playStinger(stingerId: keyof typeof STINGERS): void {
    const now = performance.now() / 1000;
    const lastTime = this.lastStingerTime.get(stingerId) || 0;

    if (now - lastTime < this.MIN_STINGER_GAP) return;

    this.lastStingerTime.set(stingerId, now);
    this.sfxManager.play(STINGERS[stingerId], { volume: 0.85 });
  }
}
```

### 5.4 Required Assets - Music

| Asset Name                  | Description               | Duration     | Format    |
| --------------------------- | ------------------------- | ------------ | --------- |
| **Main Track Stems**        |
| `main_drums_light.webm`     | Light drums (exploration) | 32 bars loop | WebM/Opus |
| `main_drums_full.webm`      | Full drums (action)       | 32 bars loop | WebM/Opus |
| `main_bass.webm`            | Bass line                 | 32 bars loop | WebM/Opus |
| `main_pad.webm`             | Synth pad (ambient)       | 32 bars loop | WebM/Opus |
| `main_lead.webm`            | Lead synth (action)       | 32 bars loop | WebM/Opus |
| `main_tension.webm`         | Tension layer             | 32 bars loop | WebM/Opus |
| **Stingers**                |
| `stinger_victory.webm`      | Level complete fanfare    | 2s           | WebM/Opus |
| `stinger_all_gems.webm`     | All gems collected        | 1s           | WebM/Opus |
| `stinger_best_time.webm`    | New best time             | 1.5s         | WebM/Opus |
| `stinger_time_warning.webm` | Low time warning          | 0.5s         | WebM/Opus |
| `stinger_last_gem.webm`     | One gem remaining         | 0.8s         | WebM/Opus |
| `stinger_fall.webm`         | Fall/respawn              | 0.8s         | WebM/Opus |
| `stinger_death.webm`        | Hazard death              | 0.6s         | WebM/Opus |
| `stinger_speed.webm`        | Speed boost               | 0.5s         | WebM/Opus |
| `stinger_shield_break.webm` | Shield depleted           | 0.6s         | WebM/Opus |
| **Menu Music**              |
| `menu_loop.webm`            | Menu background           | 60s loop     | WebM/Opus |

---

## 6. Audio Feedback Systems

### 6.1 UI Sound System

```typescript
// src/audio/systems/UISoundManager.ts
export const UI_SOUNDS = {
  // Navigation
  hover: { sound: "ui_hover", volume: 0.3 },
  click: { sound: "ui_click", volume: 0.5 },
  back: { sound: "ui_back", volume: 0.4 },

  // Transitions
  menuOpen: { sound: "ui_menu_open", volume: 0.5 },
  menuClose: { sound: "ui_menu_close", volume: 0.4 },
  levelSelect: { sound: "ui_level_select", volume: 0.5 },

  // Notifications
  notification: { sound: "ui_notification", volume: 0.6 },
  error: { sound: "ui_error", volume: 0.5 },
  success: { sound: "ui_success", volume: 0.6 },

  // Timer
  timerTick: { sound: "ui_tick", volume: 0.2 },
  timerWarning: { sound: "ui_timer_warning", volume: 0.5 },

  // Results
  scoreReveal: { sound: "ui_score_reveal", volume: 0.5 },
  starEarned: { sound: "ui_star", volume: 0.6 },
};

export class UISoundManager {
  constructor(private sfxManager: SFXManager) {
    this.setupUIEventListeners();
  }

  private setupUIEventListeners(): void {
    // Hook into UI events
    eventBus.on(GameEvents.UI_SHOW_MENU, () => this.play("menuOpen"));
    eventBus.on(GameEvents.UI_SHOW_PAUSE, () => this.play("menuOpen"));
    eventBus.on(GameEvents.UI_HIDE_ALL, () => this.play("menuClose"));
    eventBus.on(GameEvents.UI_SHOW_RESULTS, () => this.play("notification"));
  }

  play(soundId: keyof typeof UI_SOUNDS): void {
    const config = UI_SOUNDS[soundId];
    this.sfxManager.play(config.sound, { volume: config.volume });
  }

  // Call from UI button handlers
  onButtonHover(): void {
    this.play("hover");
  }

  onButtonClick(): void {
    this.play("click");
  }

  onBack(): void {
    this.play("back");
  }
}
```

### 6.2 Player Feedback System

```typescript
// src/audio/systems/PlayerFeedbackSound.ts
export class PlayerFeedbackSound {
  // Combo tracking for escalating feedback
  private comboCount: number = 0;
  private lastCollectionTime: number = 0;
  private readonly COMBO_TIMEOUT = 2; // Seconds

  // Near-miss detection
  private nearMissWindow: number = 0;

  constructor(
    private sfxManager: SFXManager,
    private musicManager: MusicManager,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track gem combos
    eventBus.on(GameEvents.GEM_COLLECTED, () => {
      const now = performance.now() / 1000;

      if (now - this.lastCollectionTime < this.COMBO_TIMEOUT) {
        this.comboCount++;
        this.playComboFeedback();
      } else {
        this.comboCount = 1;
      }

      this.lastCollectionTime = now;
    });

    // Near-miss detection (narrow escape from hazard)
    eventBus.on("player:nearMiss", (data: { distance: number }) => {
      if (data.distance < 0.5) {
        this.playNearMiss();
      }
    });

    // Success/Failure
    eventBus.on(GameEvents.LEVEL_COMPLETE, () => {
      this.sfxManager.play("feedback_success", { volume: 0.7 });
    });

    eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
      this.sfxManager.play("feedback_respawn", { volume: 0.5 });
      this.comboCount = 0; // Reset combo
    });
  }

  private playComboFeedback(): void {
    // Escalating pitch for combos
    const pitchMultiplier = 1 + (this.comboCount - 1) * 0.1;
    const maxPitch = 1.5;
    const pitch = Math.min(pitchMultiplier, maxPitch);

    this.sfxManager.play("feedback_combo", {
      volume: 0.6,
      playbackRate: pitch,
    });

    // Big combo milestone
    if (this.comboCount === 5) {
      this.musicManager.playStinger("combo5");
    } else if (this.comboCount === 10) {
      this.musicManager.playStinger("combo10");
    }
  }

  private playNearMiss(): void {
    this.sfxManager.play("feedback_near_miss", { volume: 0.5 });
  }

  update(dt: number): void {
    // Decay combo if no recent collections
    const now = performance.now() / 1000;
    if (
      now - this.lastCollectionTime > this.COMBO_TIMEOUT &&
      this.comboCount > 0
    ) {
      this.comboCount = 0;
    }
  }
}
```

### 6.3 Accessibility Audio Cues

```typescript
// src/audio/systems/AccessibilityAudio.ts
export interface AccessibilitySettings {
  audioDescriptions: boolean; // Announce game events
  soundIndicators: boolean; // Audio cues for visual elements
  reducedMotionAudio: boolean; // Calmer audio profile
}

export class AccessibilityAudio {
  private settings: AccessibilitySettings = {
    audioDescriptions: false,
    soundIndicators: true,
    reducedMotionAudio: false,
  };

  // Directional audio cues
  playDirectionalCue(
    direction: "left" | "right" | "up" | "down" | "ahead",
    importance: "low" | "medium" | "high",
  ): void {
    if (!this.settings.soundIndicators) return;

    const soundName = `cue_${direction}_${importance}`;

    // Use stereo panning for left/right
    const pan = direction === "left" ? -0.8 : direction === "right" ? 0.8 : 0;

    this.sfxManager.play(soundName, {
      volume: importance === "high" ? 0.7 : importance === "medium" ? 0.5 : 0.3,
      pan,
    });
  }

  // Audio description of game state
  announceGameState(state: string): void {
    if (!this.settings.audioDescriptions) return;

    // Use Web Speech API for announcements
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(state);
      utterance.rate = 1.2;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  }

  // Proximity warning sounds (distance to goal, hazards)
  playProximityPulse(distance: number, type: "goal" | "hazard"): void {
    if (!this.settings.soundIndicators) return;

    // Higher frequency pulse = closer
    const interval = 100 + distance * 50; // ms
    const soundName = type === "goal" ? "proximity_goal" : "proximity_hazard";

    // Pulse rate indicates distance
    this.sfxManager.play(soundName, { volume: 0.3 });
  }
}
```

### 6.4 Required Assets - Feedback

| Asset Name                | Description            | Duration | Format    |
| ------------------------- | ---------------------- | -------- | --------- |
| **UI Sounds**             |
| `ui_hover.webm`           | Button hover           | 0.1s     | WebM/Opus |
| `ui_click.webm`           | Button click           | 0.15s    | WebM/Opus |
| `ui_back.webm`            | Back/cancel            | 0.2s     | WebM/Opus |
| `ui_menu_open.webm`       | Menu appears           | 0.3s     | WebM/Opus |
| `ui_menu_close.webm`      | Menu closes            | 0.25s    | WebM/Opus |
| `ui_level_select.webm`    | Level selected         | 0.3s     | WebM/Opus |
| `ui_notification.webm`    | Notification pop       | 0.25s    | WebM/Opus |
| `ui_error.webm`           | Error/invalid          | 0.3s     | WebM/Opus |
| `ui_success.webm`         | Success confirm        | 0.35s    | WebM/Opus |
| `ui_tick.webm`            | Timer tick             | 0.1s     | WebM/Opus |
| `ui_timer_warning.webm`   | Time running out       | 0.3s     | WebM/Opus |
| `ui_score_reveal.webm`    | Score counting         | 0.2s     | WebM/Opus |
| `ui_star.webm`            | Star earned            | 0.4s     | WebM/Opus |
| **Player Feedback**       |
| `feedback_combo.webm`     | Combo increase         | 0.2s     | WebM/Opus |
| `feedback_near_miss.webm` | Close call             | 0.3s     | WebM/Opus |
| `feedback_success.webm`   | Level success          | 0.5s     | WebM/Opus |
| `feedback_respawn.webm`   | Respawn                | 0.4s     | WebM/Opus |
| **Accessibility**         |
| `cue_left_high.webm`      | Left direction cue     | 0.15s    | WebM/Opus |
| `cue_right_high.webm`     | Right direction cue    | 0.15s    | WebM/Opus |
| `cue_ahead_high.webm`     | Forward direction cue  | 0.15s    | WebM/Opus |
| `proximity_goal.webm`     | Goal proximity pulse   | 0.1s     | WebM/Opus |
| `proximity_hazard.webm`   | Hazard proximity pulse | 0.1s     | WebM/Opus |

---

## 7. Asset Specifications

### 7.1 Audio Format Guidelines

**Primary Format: WebM with Opus codec**

- Best compression-to-quality ratio for web
- Native browser support (Chrome, Firefox, Edge)
- Target bitrate: 96-128 kbps for SFX, 128-192 kbps for music

**Fallback Format: MP3**

- For Safari/older browsers
- Target bitrate: 128 kbps

**Recording Specifications:**

- Sample rate: 48 kHz (matches Web Audio API default)
- Bit depth: 16-bit minimum
- Channels: Mono for SFX, Stereo for music and ambience

### 7.2 Naming Convention

```
{category}_{element}_{variant}.{format}

Categories:
- sfx_       Sound effects (one-shot)
- amb_       Ambient/environmental
- music_     Music tracks
- ui_        User interface
- roll_      Rolling/surface sounds
- impact_    Collision sounds

Examples:
- sfx_gem_collect.webm
- amb_conveyor_hum.webm
- music_main_drums_light.webm
- ui_click.webm
- roll_metal_bright.webm
- impact_track_heavy.webm
```

### 7.3 Complete Asset List Summary

| Category             | Asset Count | Total Duration (approx) |
| -------------------- | ----------- | ----------------------- |
| Marble Physics       | 16          | 25s                     |
| Environmental        | 10          | 90s                     |
| Interactive Elements | 25          | 35s                     |
| Music                | 16          | 5+ min                  |
| UI/Feedback          | 23          | 8s                      |
| **Total**            | **90**      | **~6 min**              |

### 7.4 File Size Budget

Target total audio payload: **< 3 MB** (compressed)

| Category            | Target Size |
| ------------------- | ----------- |
| Core SFX (preload)  | 500 KB      |
| Music stems         | 1.5 MB      |
| Ambient/Environment | 500 KB      |
| UI sounds           | 200 KB      |
| Impulse responses   | 300 KB      |

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Core Architecture)

1. Implement `AudioDirector` as main controller
2. Implement `MixerBus` with gain hierarchy
3. Implement `AudioPool` for performance
4. Add settings persistence
5. Integrate with existing `Game.ts`

**Deliverables:**

- `src/audio/AudioDirector.ts`
- `src/audio/MixerBus.ts`
- `src/audio/AudioPool.ts`
- `src/audio/AudioSettings.ts`
- Update `src/audio/AudioManager.ts` (refactor to use new architecture)

### Phase 2: Spatial Audio

1. Implement `SpatialAudioEngine`
2. Add listener position updates from camera
3. Implement `ReverbSystem` with zones
4. Add reverb presets

**Deliverables:**

- `src/audio/SpatialAudioEngine.ts`
- `src/audio/systems/ReverbSystem.ts`

### Phase 3: Physics Audio

1. Implement `RollingAudioSystem`
2. Implement `CollisionAudioSystem`
3. Add `FrictionAudioSystem`
4. Create surface detection from physics colliders

**Deliverables:**

- `src/audio/systems/RollingAudioSystem.ts`
- `src/audio/systems/CollisionAudioSystem.ts`
- `src/audio/systems/FrictionAudioSystem.ts`

### Phase 4: Interactive Elements

1. Implement `InteractionSoundManager`
2. Add `AnticipationSystem`
3. Configure all element sounds
4. Add kinematic piece ambient sounds

**Deliverables:**

- `src/audio/systems/InteractionSoundManager.ts`
- `src/audio/systems/AnticipationSystem.ts`
- `src/audio/config/ElementSounds.ts`

### Phase 5: Ambient System

1. Implement `AmbientManager`
2. Add level-specific ambience configurations
3. Implement kinematic sound positioning

**Deliverables:**

- `src/audio/AmbientManager.ts`
- `src/audio/config/LevelAmbience.ts`

### Phase 6: Music System

1. Implement `MusicManager` with stem mixing
2. Add `IntensityCalculator`
3. Implement `StingerManager`
4. Create music track configurations

**Deliverables:**

- `src/audio/MusicManager.ts`
- `src/audio/systems/IntensityCalculator.ts`
- `src/audio/systems/StingerManager.ts`
- `src/audio/config/MusicTracks.ts`

### Phase 7: UI & Feedback

1. Implement `UISoundManager`
2. Add `PlayerFeedbackSound`
3. Implement `AccessibilityAudio`
4. Hook into all UI components

**Deliverables:**

- `src/audio/systems/UISoundManager.ts`
- `src/audio/systems/PlayerFeedbackSound.ts`
- `src/audio/systems/AccessibilityAudio.ts`

### Phase 8: Polish & Optimization

1. Audio latency profiling
2. Memory optimization
3. Mobile platform testing
4. Add audio options UI panel

---

## Performance Considerations

### Latency Requirements

- SFX trigger to audio output: < 20ms
- Use `AudioContext.currentTime` for precise scheduling
- Pre-decode all audio buffers on load

### Memory Management

- Use `AudioPool` for frequently-played sounds
- Implement lazy loading for music stems
- Dispose unused buffers on level unload

### Mobile Optimization

- Reduce concurrent voice count (max 16)
- Use mono sounds where stereo unnecessary
- Implement audio focus handling (pause on background)

### CPU Budget

- Target < 5% CPU on audio processing
- Limit real-time effects (reverb is expensive)
- Use `setTargetAtTime` instead of per-frame updates

---

## Integration Example

```typescript
// Game.ts integration
import { AudioDirector } from "./audio/AudioDirector";

class Game {
  private audioDirector: AudioDirector;

  async start() {
    this.audioDirector = new AudioDirector();
    await this.audioDirector.init();

    // Start menu music
    this.audioDirector.getMusicManager().playTrack("menu");
  }

  update(dt: number) {
    // Update audio with current state
    this.audioDirector.update(
      dt,
      this.player.getPosition(),
      this.cameraRig.getPosition(),
    );

    // Update music intensity based on gameplay
    const intensity = this.intensityCalculator.update(
      this.player.getVelocity(),
      this.getHazardDistances(),
      dt,
    );
    this.audioDirector.getMusicManager().setIntensity(intensity);
  }

  onLevelLoad(level: LevelDefinition) {
    // Set level ambience
    this.audioDirector
      .getAmbientManager()
      .setLevelAmbience(level.id, level.pieces);

    // Transition music to gameplay state
    this.audioDirector.getMusicManager().setState(MusicState.EXPLORATION);
  }

  dispose() {
    this.audioDirector.dispose();
  }
}
```

---

## Appendix: Sound Design Guidelines

### Marble Character

- Bright, resonant tones
- Slight metallic shimmer on impacts
- Satisfying "clunk" for heavy collisions

### Environmental Feel

- Spacey, ethereal ambience (matches visual theme)
- Industrial undertones for mechanical pieces
- Clean, modern UI sounds

### Emotional Arc

- **Start**: Calm, exploratory
- **Mid-level**: Building tension and action
- **Climax**: Triumphant victory or dramatic failure
- **Menu**: Inviting, relaxed

### Audio Brand Identity

- Consistent reverb tail length
- Unified frequency spectrum (no harsh highs)
- Recognizable gem collection "signature"
