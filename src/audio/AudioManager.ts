import { eventBus, GameEvents } from '../utils/EventBus';

interface SoundConfig {
  url: string;
  volume?: number;
  loop?: boolean;
}

/**
 * Audio system using Web Audio API
 * Subscribes to game events and plays appropriate sounds
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private masterVolume = 0.5;
  private sfxVolume = 0.7;
  private musicVolume = 0.3;
  private muted = false;
  private initialized = false;

  // Track active sources for stopping
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();

  // Event unsubscribe functions to prevent memory leaks
  private unsubscribers: (() => void)[] = [];

  // Sound definitions
  private readonly soundConfigs: Record<string, SoundConfig> = {
    jump: { url: '/audio/jump.webm', volume: 0.6 },
    land: { url: '/audio/land.webm', volume: 0.4 },
    gem: { url: '/audio/gem.webm', volume: 0.7 },
    checkpoint: { url: '/audio/checkpoint.webm', volume: 0.6 },
    goal: { url: '/audio/goal.webm', volume: 0.8 },
    respawn: { url: '/audio/respawn.webm', volume: 0.5 },
    bounce: { url: '/audio/bounce.webm', volume: 0.7 },
    teleport: { url: '/audio/teleport.webm', volume: 0.6 },
    powerup: { url: '/audio/powerup.webm', volume: 0.7 },
    powerupExpire: { url: '/audio/powerup_expire.webm', volume: 0.4 },
    collapse: { url: '/audio/collapse.webm', volume: 0.6 },
    hazard: { url: '/audio/hazard.webm', volume: 0.7 },
    levelStart: { url: '/audio/level_start.webm', volume: 0.5 },
  };

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await this.loadAllSounds();
      this.initialized = true;
    } catch (error) {
      console.warn('AudioManager: Failed to initialize audio context', error);
    }
  }

  /**
   * Resume audio context (required after user gesture on some browsers)
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Load all sound files
   */
  private async loadAllSounds(): Promise<void> {
    const loadPromises = Object.entries(this.soundConfigs).map(
      async ([name, config]) => {
        try {
          await this.loadSound(name, config.url);
        } catch {
          // Sound file doesn't exist yet - that's OK, we'll add them later
          console.debug(`AudioManager: Sound not found: ${config.url}`);
        }
      }
    );

    await Promise.allSettled(loadPromises);
  }

  /**
   * Load a single sound file
   */
  private async loadSound(name: string, url: string): Promise<void> {
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
   * Play a sound by name
   */
  play(name: string, volumeOverride?: number): void {
    if (!this.context || !this.initialized || this.muted) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      // Resume context if suspended
      if (this.context.state === 'suspended') {
        this.context.resume();
      }

      const config = this.soundConfigs[name];
      const volume = volumeOverride ?? config?.volume ?? 1;

      // Create source and gain nodes
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume * this.sfxVolume * this.masterVolume;

      source.connect(gainNode);
      gainNode.connect(this.context.destination);

      // Clean up when done
      source.onended = () => {
        this.activeSources.delete(name);
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
      console.warn(`AudioManager: Failed to play sound "${name}"`, error);
      this.activeSources.delete(name);
    }
  }

  /**
   * Stop a playing sound
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
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set SFX volume (0-1)
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopAll();
    }
    return this.muted;
  }

  /**
   * Check if muted
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Set up event listeners for game events
   */
  private setupEventListeners(): void {
    // Store unsubscribe functions to prevent memory leaks
    this.unsubscribers.push(
      // Player events
      eventBus.on(GameEvents.PLAYER_JUMP, () => this.play('jump')),
      eventBus.on(GameEvents.PLAYER_LAND, () => this.play('land')),
      eventBus.on(GameEvents.PLAYER_RESPAWN, () => this.play('respawn')),

      // Collectibles
      eventBus.on(GameEvents.GEM_COLLECTED, () => this.play('gem')),
      eventBus.on(GameEvents.CHECKPOINT_ACTIVATED, () => this.play('checkpoint')),
      eventBus.on(GameEvents.GOAL_REACHED, () => this.play('goal')),

      // New mechanics
      eventBus.on(GameEvents.BOUNCE_PAD_HIT, () => this.play('bounce')),
      eventBus.on(GameEvents.TELEPORT, () => this.play('teleport')),
      eventBus.on(GameEvents.PLATFORM_COLLAPSING, () => this.play('collapse')),
      eventBus.on(GameEvents.HAZARD_HIT, () => this.play('hazard')),

      // Power-ups
      eventBus.on(GameEvents.POWERUP_COLLECTED, () => this.play('powerup')),
      eventBus.on(GameEvents.POWERUP_EXPIRED, () => this.play('powerupExpire')),

      // Level
      eventBus.on(GameEvents.LEVEL_LOAD, () => this.play('levelStart'))
    );
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Unsubscribe from all events to prevent memory leaks
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.stopAll();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.buffers.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
