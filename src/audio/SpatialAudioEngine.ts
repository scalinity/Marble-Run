/**
 * Spatial audio engine for 3D sound positioning
 * Uses Web Audio API PannerNode with HRTF for realistic spatial audio
 */

import * as THREE from "three";

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

export interface SpatialLoopHandle {
  setPosition(position: THREE.Vector3): void;
  setVolume(volume: number): void;
  fadeOut(duration: number): void;
  stop(): void;
  isPlaying(): boolean;
}

interface ActiveSpatialSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  panner: PannerNode;
  isLoop: boolean;
}

export class SpatialAudioEngine {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private activeSounds: Map<string, ActiveSpatialSound> = new Map();
  private loopCounter = 0;

  // Temp vectors for calculations
  private tempVec = new THREE.Vector3();

  init(context: AudioContext, output: GainNode): void {
    this.context = context;
    this.output = output;
  }

  /**
   * Set the buffer map (shared with SFXManager)
   */
  setBuffers(buffers: Map<string, AudioBuffer>): void {
    this.buffers = buffers;
  }

  /**
   * Update listener position and orientation (call every frame)
   */
  updateListener(
    position: THREE.Vector3,
    forward: THREE.Vector3,
    up: THREE.Vector3,
  ): void {
    if (!this.context) return;

    const listener = this.context.listener;
    const t = this.context.currentTime;

    // Use modern API if available
    if (listener.positionX) {
      listener.positionX.setValueAtTime(position.x, t);
      listener.positionY.setValueAtTime(position.y, t);
      listener.positionZ.setValueAtTime(position.z, t);

      listener.forwardX.setValueAtTime(forward.x, t);
      listener.forwardY.setValueAtTime(forward.y, t);
      listener.forwardZ.setValueAtTime(forward.z, t);
      listener.upX.setValueAtTime(up.x, t);
      listener.upY.setValueAtTime(up.y, t);
      listener.upZ.setValueAtTime(up.z, t);
    } else {
      // Legacy API fallback
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(
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
    position: THREE.Vector3,
    config: SpatialConfig = {},
  ): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer) {
      console.debug(`SpatialAudioEngine: Buffer not found: ${soundName}`);
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = config.playbackRate ?? 1;

    const gainNode = this.context.createGain();
    gainNode.gain.value = config.volume ?? 1;

    const panner = this.createPanner(config);
    this.setPannerPosition(panner, position);

    // Connect chain: source -> gain -> panner -> output
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.output);

    // Cleanup on end
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    };

    source.start();
  }

  /**
   * Create a persistent spatial sound loop
   */
  createSpatialLoop(
    soundName: string,
    position: THREE.Vector3,
    config: SpatialConfig = {},
  ): SpatialLoopHandle {
    const loopId = `loop_${this.loopCounter++}`;

    if (!this.context || !this.output) {
      return this.createNullHandle();
    }

    const buffer = this.buffers.get(soundName);
    if (!buffer) {
      console.debug(
        `SpatialAudioEngine: Buffer not found for loop: ${soundName}`,
      );
      return this.createNullHandle();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = config.playbackRate ?? 1;

    const gainNode = this.context.createGain();
    gainNode.gain.value = config.volume ?? 1;

    const panner = this.createPanner(config);
    this.setPannerPosition(panner, position);

    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.output);

    const soundData: ActiveSpatialSound = {
      source,
      gainNode,
      panner,
      isLoop: true,
    };

    this.activeSounds.set(loopId, soundData);

    source.onended = () => {
      this.activeSounds.delete(loopId);
    };

    source.start();

    // Track fade timeout for cleanup
    let fadeTimeout: number | null = null;

    // Return handle for controlling the loop
    return {
      setPosition: (pos: THREE.Vector3) => {
        if (!this.context) return;
        this.setPannerPosition(panner, pos);
      },
      setVolume: (vol: number) => {
        if (!this.context) return;
        gainNode.gain.setTargetAtTime(vol, this.context.currentTime, 0.1);
      },
      fadeOut: (duration: number) => {
        if (!this.context) return;
        gainNode.gain.setTargetAtTime(
          0,
          this.context.currentTime,
          duration / 3,
        );
        fadeTimeout = window.setTimeout(() => {
          fadeTimeout = null;
          try {
            source.stop();
          } catch {
            // Already stopped
          }
          this.activeSounds.delete(loopId);
        }, duration * 1000);
      },
      stop: () => {
        // Clear any pending fade timeout
        if (fadeTimeout !== null) {
          clearTimeout(fadeTimeout);
          fadeTimeout = null;
        }
        try {
          source.stop();
        } catch {
          // Already stopped
        }
        source.disconnect();
        gainNode.disconnect();
        panner.disconnect();
        this.activeSounds.delete(loopId);
      },
      isPlaying: () => this.activeSounds.has(loopId),
    };
  }

  /**
   * Play a sound with simple stereo panning based on position relative to listener
   */
  playWithPan(
    soundName: string,
    worldPosition: THREE.Vector3,
    listenerPosition: THREE.Vector3,
    listenerForward: THREE.Vector3,
    config: {
      volume?: number;
      playbackRate?: number;
      maxDistance?: number;
    } = {},
  ): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer) return;

    // Calculate distance-based volume
    const maxDist = config.maxDistance ?? 50;
    const distance = worldPosition.distanceTo(listenerPosition);
    if (distance > maxDist) return; // Too far to hear

    const distanceVolume = 1 - Math.min(distance / maxDist, 1);

    // Calculate stereo pan
    this.tempVec.subVectors(worldPosition, listenerPosition).normalize();
    const right = new THREE.Vector3()
      .crossVectors(listenerForward, new THREE.Vector3(0, 1, 0))
      .normalize();
    const pan = Math.max(-1, Math.min(1, this.tempVec.dot(right)));

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = config.playbackRate ?? 1;

    const gainNode = this.context.createGain();
    gainNode.gain.value = (config.volume ?? 1) * distanceVolume;

    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;

    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.output);

    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    };

    source.start();
  }

  private createPanner(config: SpatialConfig): PannerNode {
    if (!this.context) throw new Error("Context not initialized");

    const panner = this.context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = config.rolloff ?? "inverse";
    panner.refDistance = config.refDistance ?? 1;
    panner.maxDistance = config.maxDistance ?? 50;
    panner.rolloffFactor = 1;

    if (config.coneInnerAngle !== undefined) {
      panner.coneInnerAngle = config.coneInnerAngle;
    }
    if (config.coneOuterAngle !== undefined) {
      panner.coneOuterAngle = config.coneOuterAngle;
    }
    if (config.coneOuterGain !== undefined) {
      panner.coneOuterGain = config.coneOuterGain;
    }

    return panner;
  }

  private setPannerPosition(panner: PannerNode, position: THREE.Vector3): void {
    if (!this.context) return;

    const t = this.context.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, t);
      panner.positionY.setValueAtTime(position.y, t);
      panner.positionZ.setValueAtTime(position.z, t);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  private createNullHandle(): SpatialLoopHandle {
    return {
      setPosition: () => {},
      setVolume: () => {},
      fadeOut: () => {},
      stop: () => {},
      isPlaying: () => false,
    };
  }

  /**
   * Stop all spatial sounds
   */
  stopAll(): void {
    for (const sound of this.activeSounds.values()) {
      try {
        sound.source.stop();
      } catch {
        // Already stopped
      }
      sound.source.disconnect();
      sound.gainNode.disconnect();
      sound.panner.disconnect();
    }
    this.activeSounds.clear();
  }

  dispose(): void {
    this.stopAll();
    this.context = null;
    this.output = null;
  }
}
