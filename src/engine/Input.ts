/**
 * Input state interface
 */
export interface InputState {
  moveX: number; // -1 (left/A) to 1 (right/D)
  moveZ: number; // -1 (forward/W) to 1 (backward/S)
  jump: boolean; // Just pressed this frame
  jumpHeld: boolean; // Currently held
  reset: boolean; // R key just pressed
  pause: boolean; // Escape just pressed
}

/**
 * Keyboard input manager with "just pressed" detection
 * Supports buffered input for responsive controls
 */
export class Input {
  private keys: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();

  private enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;

    const key = e.key.toLowerCase();

    // Prevent default for game keys
    if (this.isGameKey(key)) {
      e.preventDefault();
    }

    // Track "just pressed" (only on first press, not repeat)
    if (!e.repeat && !this.keys.has(key)) {
      this.keysJustPressed.add(key);
    }

    this.keys.add(key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    this.keysJustReleased.add(key);
  };

  private onBlur = (): void => {
    // Clear all keys when window loses focus
    this.keys.clear();
  };

  private isGameKey(key: string): boolean {
    return [
      'w', 'a', 's', 'd',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      ' ', 'r', 'escape'
    ].includes(key);
  }

  /**
   * Get current input state
   * Call this once per frame before processing
   */
  getState(): InputState {
    let moveX = 0;
    let moveZ = 0;

    // WASD / Arrow keys
    if (this.keys.has('w') || this.keys.has('arrowup')) moveZ = -1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveZ = 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) moveX = -1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveX = 1;

    return {
      moveX,
      moveZ,
      jump: this.keysJustPressed.has(' '),
      jumpHeld: this.keys.has(' '),
      reset: this.keysJustPressed.has('r'),
      pause: this.keysJustPressed.has('escape'),
    };
  }

  /**
   * Check if a specific key is currently held
   */
  isKeyHeld(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Check if a key was just pressed this frame
   */
  isKeyJustPressed(key: string): boolean {
    return this.keysJustPressed.has(key.toLowerCase());
  }

  /**
   * Check if a key was just released this frame
   */
  isKeyJustReleased(key: string): boolean {
    return this.keysJustReleased.has(key.toLowerCase());
  }

  /**
   * Clear frame-specific states
   * Call this at the end of each frame
   */
  endFrame(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
  }

  /**
   * Enable/disable input processing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.keysJustPressed.clear();
      this.keysJustReleased.clear();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
