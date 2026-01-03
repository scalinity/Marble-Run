/**
 * UI sound manager for menu and interface sounds
 * Handles hover, click, and transition sounds
 */

import { eventBus, GameEvents } from "../../utils/EventBus";
import { SFXManager } from "../SFXManager";

const UI_SOUNDS = {
  // Navigation
  hover: { sound: "ui_hover", volume: 0.3 },
  click: { sound: "ui_click", volume: 0.5 },
  back: { sound: "ui_back", volume: 0.4 },

  // Transitions
  menuOpen: { sound: "ui_menu_open", volume: 0.5 },
  menuClose: { sound: "ui_menu_close", volume: 0.4 },

  // Notifications
  notification: { sound: "ui_notification", volume: 0.5 },
};

export class UISoundManager {
  private sfxManager: SFXManager | null = null;
  private unsubscribers: (() => void)[] = [];

  init(sfxManager: SFXManager): void {
    this.sfxManager = sfxManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.unsubscribers.push(
      eventBus.on(GameEvents.UI_SHOW_MENU, () => this.play("menuOpen")),
      eventBus.on(GameEvents.UI_SHOW_PAUSE, () => this.play("menuOpen")),
      eventBus.on(GameEvents.UI_HIDE_ALL, () => this.play("menuClose")),
      eventBus.on(GameEvents.UI_SHOW_RESULTS, () => this.play("notification")),
    );
  }

  /**
   * Play a UI sound
   */
  play(soundId: keyof typeof UI_SOUNDS): void {
    if (!this.sfxManager) return;

    const config = UI_SOUNDS[soundId];
    if (!config) return;

    this.sfxManager.play(config.sound, { volume: config.volume });
  }

  /**
   * Call from UI button hover handlers
   */
  onButtonHover(): void {
    this.play("hover");
  }

  /**
   * Call from UI button click handlers
   */
  onButtonClick(): void {
    this.play("click");
  }

  /**
   * Call from back/cancel handlers
   */
  onBack(): void {
    this.play("back");
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.sfxManager = null;
  }
}
