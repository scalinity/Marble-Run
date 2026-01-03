/**
 * Player feedback sound system
 * Handles combo sounds, near-miss audio, and gameplay feedback
 */

import { eventBus, GameEvents } from "../../utils/EventBus";
import { SFXManager } from "../SFXManager";

export class PlayerFeedbackSound {
  private sfxManager: SFXManager | null = null;

  // Combo tracking
  private comboCount: number = 0;
  private lastCollectionTime: number = 0;
  private readonly COMBO_TIMEOUT = 2; // Seconds

  // Event unsubscribe functions
  private unsubscribers: (() => void)[] = [];

  init(sfxManager: SFXManager): void {
    this.sfxManager = sfxManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track gem combos
    this.unsubscribers.push(
      eventBus.on(GameEvents.GEM_COLLECTED, () => {
        const now = performance.now() / 1000;

        if (now - this.lastCollectionTime < this.COMBO_TIMEOUT) {
          this.comboCount++;
          this.playComboFeedback();
        } else {
          this.comboCount = 1;
        }

        this.lastCollectionTime = now;
      }),

      // Success/Failure
      eventBus.on(GameEvents.LEVEL_COMPLETE, () => {
        this.sfxManager?.play("stinger_victory", { volume: 0.8 });
      }),

      eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
        this.sfxManager?.play("stinger_fall", { volume: 0.6 });
        this.comboCount = 0; // Reset combo
      }),

      eventBus.on(GameEvents.HAZARD_HIT, () => {
        this.sfxManager?.play("stinger_death", { volume: 0.6 });
      }),
    );
  }

  private playComboFeedback(): void {
    if (!this.sfxManager) return;

    // Escalating pitch for combos
    const pitchMultiplier = 1 + (this.comboCount - 1) * 0.1;
    const maxPitch = 1.5;
    const pitch = Math.min(pitchMultiplier, maxPitch);

    this.sfxManager.play("feedback_combo", {
      volume: 0.5,
      playbackRate: pitch,
    });
  }

  /**
   * Play a near-miss sound
   */
  playNearMiss(): void {
    this.sfxManager?.play("feedback_near_miss", { volume: 0.4 });
  }

  /**
   * Update combo decay
   */
  update(dt: number): void {
    const now = performance.now() / 1000;
    if (
      now - this.lastCollectionTime > this.COMBO_TIMEOUT &&
      this.comboCount > 0
    ) {
      this.comboCount = 0;
    }
  }

  /**
   * Reset feedback state (for level restart)
   */
  reset(): void {
    this.comboCount = 0;
    this.lastCollectionTime = 0;
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.sfxManager = null;
  }
}
