/**
 * Sound effects manager for one-shot sounds
 * Handles loading, caching, and playing sound effects
 * Falls back to procedural audio when files are missing
 */

import { AudioPool } from "./AudioPool";
import { ProceduralAudio } from "./ProceduralAudio";

export interface SFXConfig {
  url: string;
  volume?: number;
  pooled?: boolean;
}

export interface PlayOptions {
  volume?: number;
  playbackRate?: number;
  pan?: number;
}

export class SFXManager {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private configs: Map<string, SFXConfig> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private pool: AudioPool;
  private proceduralAudio: ProceduralAudio | null = null;

  constructor() {
    this.pool = new AudioPool();
  }

  async init(context: AudioContext, output: GainNode): Promise<void> {
    this.context = context;
    this.output = output;

    // Initialize procedural audio generator
    this.proceduralAudio = new ProceduralAudio(context);
  }

  /**
   * Register a sound configuration
   */
  register(name: string, config: SFXConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Register multiple sounds at once
   */
  registerAll(configs: Record<string, SFXConfig>): void {
    for (const [name, config] of Object.entries(configs)) {
      this.register(name, config);
    }
  }

  /**
   * Load all registered sounds
   * Falls back to procedural audio for missing files
   */
  async loadAll(): Promise<void> {
    // First, try to load from files
    const loadPromises = Array.from(this.configs.entries()).map(
      async ([name, config]) => {
        try {
          await this.loadSound(name, config.url);
        } catch {
          // File not found - will use procedural fallback
        }
      },
    );

    await Promise.allSettled(loadPromises);

    // Generate procedural audio for any missing sounds
    if (this.proceduralAudio) {
      const proceduralBuffers = this.proceduralAudio.generateAll();
      let proceduralCount = 0;

      for (const [name] of this.configs) {
        if (!this.buffers.has(name) && proceduralBuffers.has(name)) {
          this.buffers.set(name, proceduralBuffers.get(name)!);
          proceduralCount++;
        }
      }

      if (proceduralCount > 0) {
        console.log(
          `SFXManager: Generated ${proceduralCount} procedural sounds`,
        );
      }
    }

    // Initialize pool with loaded buffers
    if (this.context && this.output) {
      this.pool.init(this.context, this.output, this.buffers);
    }
  }

  /**
   * Load a single sound
   */
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.context) return;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.buffers.set(name, audioBuffer);
  }

  /**
   * Check if a sound is loaded
   */
  hasSound(name: string): boolean {
    return this.buffers.has(name);
  }

  /**
   * Play a sound by name
   */
  play(name: string, options: PlayOptions = {}): void {
    if (!this.context || !this.output) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const config = this.configs.get(name);
    const baseVolume = config?.volume ?? 1;
    const finalVolume = (options.volume ?? 1) * baseVolume;

    // Try pooled playback first for pooled sounds
    if (this.pool.hasPool(name)) {
      this.pool.play(name, {
        volume: finalVolume,
        pan: options.pan,
        playbackRate: options.playbackRate,
      });
      return;
    }

    // Regular playback for non-pooled sounds
    try {
      // Resume context if suspended
      if (this.context.state === "suspended") {
        this.context.resume();
      }

      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      let panner: StereoPannerNode | null = null;

      source.buffer = buffer;
      source.playbackRate.value = options.playbackRate ?? 1;
      gainNode.gain.value = finalVolume;

      // Add panning if specified
      if (options.pan !== undefined) {
        panner = this.context.createStereoPanner();
        panner.pan.value = options.pan;
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.output);
      } else {
        source.connect(gainNode);
        gainNode.connect(this.output);
      }

      // Clean up when done
      source.onended = () => {
        this.activeSources.delete(name);
        source.disconnect();
        gainNode.disconnect();
        if (panner) {
          panner.disconnect();
        }
      };

      // Stop previous instance if playing
      const existing = this.activeSources.get(name);
      if (existing) {
        try {
          existing.stop();
        } catch {
          // Already stopped
        }
      }

      this.activeSources.set(name, source);
      source.start();
    } catch (error) {
      console.warn(`SFXManager: Failed to play sound "${name}"`, error);
      this.activeSources.delete(name);
    }
  }

  /**
   * Stop a specific sound
   */
  stop(name: string): void {
    const source = this.activeSources.get(name);
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      this.activeSources.delete(name);
    }
  }

  /**
   * Stop all sounds
   */
  stopAll(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    });
    this.activeSources.clear();
    this.pool.stopAll();
  }

  /**
   * Get a buffer for external use (e.g., spatial audio)
   */
  getBuffer(name: string): AudioBuffer | undefined {
    return this.buffers.get(name);
  }

  /**
   * Get all loaded buffers
   */
  getBuffers(): Map<string, AudioBuffer> {
    return this.buffers;
  }

  dispose(): void {
    this.stopAll();
    this.pool.dispose();
    this.buffers.clear();
    this.configs.clear();
    this.context = null;
    this.output = null;
  }
}
