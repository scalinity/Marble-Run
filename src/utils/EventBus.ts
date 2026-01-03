type EventCallback<T = unknown> = (data: T) => void;

/**
 * Simple pub/sub event system
 */
export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event (one-time)
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    const wrapper: EventCallback<T> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
    }
  }

  /**
   * Emit an event with data
   */
  emit<T = unknown>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Game events
export const GameEvents = {
  // Game state
  GAME_START: "game:start",
  GAME_PAUSE: "game:pause",
  GAME_RESUME: "game:resume",
  GAME_RESET: "game:reset",

  // Level
  LEVEL_LOAD: "level:load",
  LEVEL_COMPLETE: "level:complete",
  LEVEL_FAILED: "level:failed",

  // Player
  PLAYER_SPAWN: "player:spawn",
  PLAYER_RESPAWN: "player:respawn",
  PLAYER_JUMP: "player:jump",
  PLAYER_LAND: "player:land",

  // Collectibles
  GEM_COLLECTED: "gem:collected",
  CHECKPOINT_ACTIVATED: "checkpoint:activated",
  GOAL_REACHED: "goal:reached",

  // New mechanics
  BOUNCE_PAD_HIT: "bounce:hit",
  TELEPORT: "teleport:activate",
  PLATFORM_COLLAPSING: "platform:collapsing",
  PLATFORM_FELL: "platform:fell",
  HAZARD_HIT: "hazard:hit",
  SPINNER_HIT: "spinner:hit",

  // Power-ups
  POWERUP_COLLECTED: "powerup:collected",
  POWERUP_EXPIRED: "powerup:expired",

  // UI
  UI_SHOW_MENU: "ui:showMenu",
  UI_SHOW_LEVEL_SELECT: "ui:showLevelSelect",
  UI_SHOW_PAUSE: "ui:showPause",
  UI_SHOW_RESULTS: "ui:showResults",
  UI_HIDE_ALL: "ui:hideAll",
} as const;

// Global event bus instance
export const eventBus = new EventBus();
