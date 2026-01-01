/**
 * Replay Player
 * Plays back recorded inputs for testing
 */

import { ReplayData, InputFrame } from './ReplayRecorder';

export interface ReplayResult {
  success: boolean;
  completed: boolean;
  gemsCollected: number;
  checkpointsHit: string[];
  finalTime: number;
  error?: string;
}

/**
 * Plays back recorded inputs using physics tick timing
 */
export class ReplayPlayer {
  private frames: InputFrame[] = [];
  private currentFrameIndex = 0;
  private startTick = 0;
  private isPlaying = false;
  private totalTicks = 0;
  private currentKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  /**
   * Load replay data
   */
  load(data: ReplayData): void {
    this.frames = data.frames;
    this.currentFrameIndex = 0;
    this.totalTicks = data.duration; // Duration is now in ticks
    console.log(`[ReplayPlayer] Loaded replay: ${data.levelId} (${this.frames.length} frames, ${this.totalTicks} ticks)`);
  }

  /**
   * Start playback at the given physics tick
   */
  start(currentTick: number): void {
    this.startTick = currentTick;
    this.currentFrameIndex = 0;
    this.isPlaying = true;
    this.currentKeys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
    };
    console.log(`[ReplayPlayer] Started playback at tick ${currentTick}`);
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.isPlaying = false;
    console.log('[ReplayPlayer] Stopped playback');
  }

  /**
   * Update playback state (call every frame with current physics tick)
   * Returns the current input state to use
   */
  update(currentTick: number): InputFrame['keys'] | null {
    if (!this.isPlaying || this.frames.length === 0) {
      return null;
    }

    const relativeTick = currentTick - this.startTick;

    // Process all frames up to current tick
    while (
      this.currentFrameIndex < this.frames.length &&
      this.frames[this.currentFrameIndex].tick <= relativeTick
    ) {
      this.currentKeys = { ...this.frames[this.currentFrameIndex].keys };
      this.currentFrameIndex++;
    }

    // Check if playback is complete (add buffer of 120 ticks = 2 seconds at 60Hz)
    if (this.currentFrameIndex >= this.frames.length) {
      const lastFrame = this.frames[this.frames.length - 1];
      if (relativeTick > lastFrame.tick + 120) {
        this.isPlaying = false;
        console.log('[ReplayPlayer] Playback complete');
      }
    }

    return this.currentKeys;
  }

  isActive(): boolean {
    return this.isPlaying;
  }

  getProgress(): number {
    if (this.frames.length === 0) return 0;
    return this.currentFrameIndex / this.frames.length;
  }

  getTotalTicks(): number {
    return this.totalTicks;
  }
}

// Global instance
export const replayPlayer = new ReplayPlayer();
