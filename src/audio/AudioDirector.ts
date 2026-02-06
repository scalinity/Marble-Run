/**
 * AudioDirector - Main audio system controller
 * Coordinates all audio subsystems and provides unified API
 */

import * as THREE from "three";
import { eventBus, GameEvents } from "../utils/EventBus";

import { MixerBus } from "./MixerBus";
import { SFXManager } from "./SFXManager";
import { SpatialAudioEngine } from "./SpatialAudioEngine";
import { MusicManager, MusicState } from "./MusicManager";
import { AmbientManager } from "./AmbientManager";
import { RollingAudioSystem } from "./systems/RollingAudioSystem";
import { CollisionAudioSystem } from "./systems/CollisionAudioSystem";
import { IntensityCalculator } from "./systems/IntensityCalculator";
import { UISoundManager } from "./systems/UISoundManager";
import { PlayerFeedbackSound } from "./systems/PlayerFeedbackSound";
import {
  AudioSettings,
  loadAudioSettings,
  saveAudioSettings,
} from "./AudioSettings";
import { SOUND_CONFIGS, AMBIENT_CONFIGS } from "./config/SoundConfigs";

interface PieceData {
  id: string;
  type: string;
  position: [number, number, number];
}

export class AudioDirector {
  private context: AudioContext | null = null;
  private initialized = false;

  // Core systems
  private mixerBus: MixerBus | null = null;
  private sfxManager: SFXManager;
  private spatialEngine: SpatialAudioEngine;
  private musicManager: MusicManager;
  private ambientManager: AmbientManager;

  // Physics audio
  private rollingAudio: RollingAudioSystem;
  private collisionAudio: CollisionAudioSystem;

  // Feedback systems
  private intensityCalculator: IntensityCalculator;
  private uiSoundManager: UISoundManager;
  private playerFeedback: PlayerFeedbackSound;

  // Settings
  private settings: AudioSettings;
  private muted = false;

  // Event tracking
  private unsubscribers: (() => void)[] = [];

  // Camera/listener tracking
  private listenerPosition = new THREE.Vector3();
  private listenerForward = new THREE.Vector3(0, 0, -1);
  private listenerUp = new THREE.Vector3(0, 1, 0);

  constructor() {
    // Load settings
    this.settings = loadAudioSettings();
    this.muted = this.settings.muted;

    // Create subsystems
    this.sfxManager = new SFXManager();
    this.spatialEngine = new SpatialAudioEngine();
    this.musicManager = new MusicManager();
    this.ambientManager = new AmbientManager();
    this.rollingAudio = new RollingAudioSystem();
    this.collisionAudio = new CollisionAudioSystem();
    this.intensityCalculator = new IntensityCalculator();
    this.uiSoundManager = new UISoundManager();
    this.playerFeedback = new PlayerFeedbackSound();
  }

  /**
   * Initialize the audio system (must be called after user interaction)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true; // Set immediately to prevent re-entry

    try {
      // Create audio context
      this.context = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();

      // Create mixer bus
      this.mixerBus = new MixerBus(this.context);

      // Apply settings
      this.mixerBus.setMasterVolume(this.settings.masterVolume);
      this.mixerBus.setSFXVolume(this.settings.sfxVolume);
      this.mixerBus.setMusicVolume(this.settings.musicVolume);
      this.mixerBus.setAmbientVolume(this.settings.ambientVolume);

      if (this.muted) {
        this.mixerBus.mute();
      }

      // Initialize SFX manager
      await this.sfxManager.init(this.context, this.mixerBus.getSFXOutput());
      this.sfxManager.registerAll(SOUND_CONFIGS);
      this.sfxManager.registerAll(AMBIENT_CONFIGS);
      await this.sfxManager.loadAll();

      // Initialize spatial engine
      this.spatialEngine.init(this.context, this.mixerBus.getSFXOutput());
      this.spatialEngine.setBuffers(this.sfxManager.getBuffers());

      // Initialize music manager
      await this.musicManager.init(
        this.context,
        this.mixerBus.getMusicOutput(),
      );

      // Initialize ambient manager
      this.ambientManager.init(
        this.context,
        this.mixerBus.getAmbientOutput(),
        this.spatialEngine,
      );
      this.ambientManager.setBuffers(this.sfxManager.getBuffers());

      // Initialize physics audio
      this.rollingAudio.init(this.context, this.mixerBus.getSFXOutput());
      this.rollingAudio.setBuffers(this.sfxManager.getBuffers());

      this.collisionAudio.init(
        this.context,
        this.mixerBus.getSFXOutput(),
        this.spatialEngine,
      );
      this.collisionAudio.setBuffers(this.sfxManager.getBuffers());

      // Initialize feedback systems
      this.uiSoundManager.init(this.sfxManager);
      this.playerFeedback.init(this.sfxManager);

      // Setup game event listeners
      this.setupGameEventListeners();

      console.log("AudioDirector: Initialized");
    } catch (error) {
      this.initialized = false; // Reset on failure
      console.warn("AudioDirector: Failed to initialize", error);
    }
  }

  /**
   * Setup listeners for game events
   */
  private setupGameEventListeners(): void {
    // Player actions
    this.unsubscribers.push(
      eventBus.on(GameEvents.PLAYER_JUMP, () => {
        this.sfxManager.play("jump");
      }),
      eventBus.on(GameEvents.PLAYER_LAND, () => {
        this.sfxManager.play("land");
      }),
      eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
        this.sfxManager.play("respawn");
      }),

      // Collectibles
      eventBus.on(GameEvents.GEM_COLLECTED, () => {
        this.sfxManager.play("gem");
      }),
      eventBus.on(GameEvents.CHECKPOINT_ACTIVATED, () => {
        this.sfxManager.play("checkpoint");
      }),
      eventBus.on(GameEvents.GOAL_REACHED, () => {
        this.sfxManager.play("goal");
        this.musicManager.setState(MusicState.VICTORY);
      }),

      // Mechanics
      eventBus.on(GameEvents.BOUNCE_PAD_HIT, () => {
        this.sfxManager.play("bounce");
      }),
      eventBus.on(GameEvents.TELEPORT_SUCCESS, () => {
        this.sfxManager.play("teleport");
      }),
      eventBus.on(GameEvents.PLATFORM_COLLAPSING, () => {
        this.sfxManager.play("collapse");
      }),
      eventBus.on(GameEvents.HAZARD_HIT, () => {
        this.sfxManager.play("hazard");
        this.musicManager.setState(MusicState.FAILURE);
      }),

      // Power-ups
      eventBus.on(GameEvents.POWERUP_COLLECTED, () => {
        this.sfxManager.play("powerup");
      }),
      eventBus.on(GameEvents.POWERUP_EXPIRED, () => {
        this.sfxManager.play("powerup_expire");
      }),

      // Level
      eventBus.on(GameEvents.LEVEL_LOAD, () => {
        this.sfxManager.play("level_start");
        this.musicManager.setState(MusicState.EXPLORATION);
        this.intensityCalculator.reset();
        this.playerFeedback.reset();
      }),

      // Game state
      eventBus.on(GameEvents.GAME_PAUSE, () => {
        this.ambientManager.pause();
      }),
      eventBus.on(GameEvents.GAME_RESUME, () => {
        this.ambientManager.resume();
      }),
    );
  }

  /**
   * Resume audio context (required after user gesture on some browsers)
   * Non-blocking - doesn't wait for the resume to complete since it may
   * require a user gesture that hasn't happened yet
   */
  async resume(): Promise<void> {
    if (this.context?.state === "suspended") {
      // Don't await - context.resume() may hang without user gesture
      this.context.resume().catch(() => {
        // Silently ignore - will be resumed on user interaction
      });
    }
  }

  /**
   * Update audio system (call every frame)
   */
  update(
    dt: number,
    playerPosition: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    cameraPosition: THREE.Vector3,
    cameraForward: THREE.Vector3,
    isGrounded: boolean,
    surfaceType: string | null = null,
    hazardDistances: number[] = [],
  ): void {
    if (!this.initialized || !this.context) return;

    // Update listener position for spatial audio
    this.listenerPosition.copy(cameraPosition);
    this.listenerForward.copy(cameraForward);

    if (this.settings.spatialAudioEnabled) {
      this.spatialEngine.updateListener(
        this.listenerPosition,
        this.listenerForward,
        this.listenerUp,
      );
    }

    // Update rolling audio based on player state
    this.rollingAudio.update(playerVelocity, surfaceType, isGrounded);

    // Update music intensity
    const intensity = this.intensityCalculator.update(
      playerVelocity,
      hazardDistances,
      dt,
    );
    this.musicManager.setIntensity(intensity);
    this.musicManager.update(dt);

    // Update player feedback
    this.playerFeedback.update(dt);
  }

  /**
   * Handle collision for impact sounds
   */
  handleCollision(
    impactForce: number,
    position: THREE.Vector3,
    surfaceType?: string,
  ): void {
    this.collisionAudio.handleCollision({
      impactForce,
      position,
      surfaceType,
    });
  }

  /**
   * Set level ambience and kinematic sounds
   */
  setLevelAmbience(levelId: string, pieces: PieceData[]): void {
    this.ambientManager.setLevelAmbience(levelId, pieces);
  }

  /**
   * Update kinematic piece position (for moving platforms)
   */
  updateKinematicPosition(pieceId: string, position: THREE.Vector3): void {
    this.ambientManager.updateKinematicPosition(pieceId, position);
  }

  /**
   * Play the main gameplay music
   */
  playGameMusic(): void {
    this.musicManager.playTrack("main");
    this.musicManager.setState(MusicState.EXPLORATION);
  }

  /**
   * Play menu music
   */
  playMenuMusic(): void {
    this.musicManager.playTrack("menu");
    this.musicManager.setState(MusicState.MENU);
  }

  /**
   * Stop all music
   */
  stopMusic(fadeTime: number = 1): void {
    this.musicManager.stop(fadeTime);
  }

  /**
   * Get music manager for direct access
   */
  getMusicManager(): MusicManager {
    return this.musicManager;
  }

  /**
   * Get ambient manager for direct access
   */
  getAmbientManager(): AmbientManager {
    return this.ambientManager;
  }

  /**
   * Get UI sound manager
   */
  getUISoundManager(): UISoundManager {
    return this.uiSoundManager;
  }

  /**
   * Play a sound effect by name
   */
  playSFX(
    name: string,
    options?: { volume?: number; playbackRate?: number },
  ): void {
    this.sfxManager.play(name, options);
  }

  /**
   * Play a spatial sound at a position
   */
  playSpatial(
    name: string,
    position: THREE.Vector3,
    options?: { volume?: number; playbackRate?: number },
  ): void {
    this.spatialEngine.playAt(name, position, options);
  }

  // ============ Volume Controls ============

  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
    this.mixerBus?.setMasterVolume(this.settings.masterVolume);
    this.saveSettings();
  }

  setSFXVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    this.mixerBus?.setSFXVolume(this.settings.sfxVolume);
    this.saveSettings();
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.mixerBus?.setMusicVolume(this.settings.musicVolume);
    this.saveSettings();
  }

  setAmbientVolume(volume: number): void {
    this.settings.ambientVolume = Math.max(0, Math.min(1, volume));
    this.mixerBus?.setAmbientVolume(this.settings.ambientVolume);
    this.saveSettings();
  }

  getMasterVolume(): number {
    return this.settings.masterVolume;
  }

  getSFXVolume(): number {
    return this.settings.sfxVolume;
  }

  getMusicVolume(): number {
    return this.settings.musicVolume;
  }

  getAmbientVolume(): number {
    return this.settings.ambientVolume;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.settings.muted = this.muted;

    if (this.muted) {
      this.mixerBus?.mute();
      this.sfxManager.stopAll();
    } else {
      this.mixerBus?.unmute(this.settings.masterVolume);
    }

    this.saveSettings();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setSpatialAudioEnabled(enabled: boolean): void {
    this.settings.spatialAudioEnabled = enabled;
    this.saveSettings();
  }

  isSpatialAudioEnabled(): boolean {
    return this.settings.spatialAudioEnabled;
  }

  private saveSettings(): void {
    saveAudioSettings(this.settings);
  }

  // ============ Cleanup ============

  /**
   * Stop all audio
   */
  stopAll(): void {
    this.sfxManager.stopAll();
    this.musicManager.stop(0.5);
    this.ambientManager.stopAll();
    this.rollingAudio.stop();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Unsubscribe from events
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    // Dispose subsystems
    this.sfxManager.dispose();
    this.spatialEngine.dispose();
    this.musicManager.dispose();
    this.ambientManager.dispose();
    this.rollingAudio.dispose();
    this.collisionAudio.dispose();
    this.intensityCalculator.dispose();
    this.uiSoundManager.dispose();
    this.playerFeedback.dispose();

    // Dispose mixer
    this.mixerBus?.dispose();

    // Close context (fire and forget - close() returns a Promise)
    if (this.context) {
      const ctx = this.context;
      this.context = null;
      ctx.close().catch(() => {
        // Ignore close errors
      });
    }

    this.initialized = false;
    console.log("AudioDirector: Disposed");
  }
}

// Singleton instance
export const audioDirector = new AudioDirector();
