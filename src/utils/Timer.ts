/**
 * Game timer for tracking level time
 */
export class Timer {
  private startTime = 0;
  private pausedTime = 0;
  private pauseStart = 0;
  private running = false;
  private paused = false;
  private finalTime = 0;  // Captured when stopped

  /**
   * Start or restart the timer
   */
  start(): void {
    this.startTime = performance.now();
    this.pausedTime = 0;
    this.running = true;
    this.paused = false;
    this.finalTime = 0;
  }

  /**
   * Stop the timer
   */
  stop(): void {
    if (this.running) {
      this.finalTime = this.getElapsed();  // Capture final time before stopping
    }
    this.running = false;
    this.paused = false;
  }

  /**
   * Pause the timer
   */
  pause(): void {
    if (this.running && !this.paused) {
      this.pauseStart = performance.now();
      this.paused = true;
    }
  }

  /**
   * Resume the timer
   */
  resume(): void {
    if (this.running && this.paused) {
      this.pausedTime += performance.now() - this.pauseStart;
      this.paused = false;
    }
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsed(): number {
    if (!this.running) return this.finalTime;

    const now = performance.now();
    let elapsed = now - this.startTime - this.pausedTime;

    if (this.paused) {
      elapsed -= now - this.pauseStart;
    }

    return elapsed / 1000;
  }

  /**
   * Get elapsed time as formatted string (MM:SS.mm)
   */
  getFormatted(): string {
    return Timer.format(this.getElapsed());
  }

  /**
   * Check if timer is running
   */
  isRunning(): boolean {
    return this.running && !this.paused;
  }

  /**
   * Check if timer is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Format seconds to MM:SS.mm string
   */
  static format(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  /**
   * Parse formatted time string to seconds
   */
  static parse(formatted: string): number {
    const parts = formatted.split(':');
    if (parts.length !== 2) return 0;

    const mins = parseInt(parts[0], 10);
    const secParts = parts[1].split('.');
    const secs = parseInt(secParts[0], 10);
    const ms = secParts[1] ? parseInt(secParts[1], 10) / 100 : 0;

    return mins * 60 + secs + ms;
  }
}

/**
 * Frame time tracking
 */
export class Time {
  private lastTime = 0;
  private deltaTime = 0;
  private elapsedTime = 0;

  /**
   * Update time tracking - call once per frame
   */
  update(currentTime: number): void {
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
    }

    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.elapsedTime += this.deltaTime;
    this.lastTime = currentTime;

    // Cap delta to prevent huge jumps
    if (this.deltaTime > 0.1) {
      this.deltaTime = 0.1;
    }
  }

  /**
   * Get delta time in seconds
   */
  getDelta(): number {
    return this.deltaTime;
  }

  /**
   * Get total elapsed time in seconds
   */
  getElapsed(): number {
    return this.elapsedTime;
  }

  /**
   * Reset time tracking
   */
  reset(): void {
    this.lastTime = 0;
    this.deltaTime = 0;
    this.elapsedTime = 0;
  }
}
