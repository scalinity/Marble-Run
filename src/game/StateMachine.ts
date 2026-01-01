import { eventBus, GameEvents } from '../utils/EventBus';

/**
 * Game states
 */
export enum GameState {
  MENU = 'MENU',
  LEVEL_SELECT = 'LEVEL_SELECT',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

/**
 * State transition callbacks
 */
export interface StateCallbacks {
  onEnter?: () => void;
  onExit?: () => void;
  onUpdate?: (dt: number) => void;
}

/**
 * Game state machine
 */
export class StateMachine {
  private currentState: GameState = GameState.MENU;
  private previousState: GameState = GameState.MENU;
  private stateCallbacks: Map<GameState, StateCallbacks> = new Map();

  constructor() {
    // Set default empty callbacks for all states
    Object.values(GameState).forEach((state) => {
      this.stateCallbacks.set(state as GameState, {});
    });
  }

  /**
   * Register callbacks for a state
   */
  registerState(state: GameState, callbacks: StateCallbacks): void {
    this.stateCallbacks.set(state, callbacks);
  }

  /**
   * Transition to a new state
   */
  setState(newState: GameState): void {
    if (newState === this.currentState) return;

    // Exit current state
    const currentCallbacks = this.stateCallbacks.get(this.currentState);
    currentCallbacks?.onExit?.();

    // Save previous state
    this.previousState = this.currentState;
    this.currentState = newState;

    // Enter new state
    const newCallbacks = this.stateCallbacks.get(newState);
    newCallbacks?.onEnter?.();

    // Emit event
    this.emitStateEvent(newState);
  }

  private emitStateEvent(state: GameState): void {
    switch (state) {
      case GameState.MENU:
        eventBus.emit(GameEvents.UI_SHOW_MENU);
        break;
      case GameState.LEVEL_SELECT:
        eventBus.emit(GameEvents.UI_SHOW_LEVEL_SELECT);
        break;
      case GameState.PLAYING:
        eventBus.emit(GameEvents.UI_HIDE_ALL);
        eventBus.emit(GameEvents.GAME_START);
        break;
      case GameState.PAUSED:
        eventBus.emit(GameEvents.UI_SHOW_PAUSE);
        eventBus.emit(GameEvents.GAME_PAUSE);
        break;
      case GameState.COMPLETE:
        eventBus.emit(GameEvents.UI_SHOW_RESULTS);
        eventBus.emit(GameEvents.LEVEL_COMPLETE);
        break;
      case GameState.FAILED:
        eventBus.emit(GameEvents.LEVEL_FAILED);
        break;
    }
  }

  /**
   * Update current state
   */
  update(dt: number): void {
    const callbacks = this.stateCallbacks.get(this.currentState);
    callbacks?.onUpdate?.(dt);
  }

  /**
   * Get current state
   */
  getState(): GameState {
    return this.currentState;
  }

  /**
   * Get previous state
   */
  getPreviousState(): GameState {
    return this.previousState;
  }

  /**
   * Check if in a specific state
   */
  isState(state: GameState): boolean {
    return this.currentState === state;
  }

  /**
   * Check if game is actively playing
   */
  isPlaying(): boolean {
    return this.currentState === GameState.PLAYING;
  }

  /**
   * Check if game is paused
   */
  isPaused(): boolean {
    return this.currentState === GameState.PAUSED;
  }

  /**
   * Return to previous state
   */
  returnToPrevious(): void {
    this.setState(this.previousState);
  }
}
