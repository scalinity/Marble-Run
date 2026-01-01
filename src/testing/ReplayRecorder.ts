/**
 * Replay Recording System
 * Records player inputs for deterministic playback testing
 */

export interface InputFrame {
  tick: number;  // Physics tick count (deterministic timing)
  keys: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
  };
}

export interface ReplayData {
  version: 1;
  levelId: string;
  recordedAt: string;
  duration: number;
  frames: InputFrame[];
  metadata: {
    gemsCollected: number;
    checkpointsHit: string[];
    completed: boolean;
    finalTime: number;
  };
}

/**
 * Records player inputs during gameplay
 */
export class ReplayRecorder {
  private frames: InputFrame[] = [];
  private startTick = 0;
  private isRecording = false;
  private levelId = '';
  private lastKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };
  private lastRecordedTick = -1;

  // Metadata tracking
  private gemsCollected = 0;
  private checkpointsHit: string[] = [];
  private completed = false;
  private finalTime = 0;

  start(levelId: string, currentTick: number): void {
    this.levelId = levelId;
    this.frames = [];
    this.startTick = currentTick;
    this.lastRecordedTick = -1;
    this.isRecording = true;
    this.gemsCollected = 0;
    this.checkpointsHit = [];
    this.completed = false;
    this.finalTime = 0;
    this.lastKeys = { forward: false, backward: false, left: false, right: false, jump: false };
    console.log(`[ReplayRecorder] Started recording level: ${levelId} at tick ${currentTick}`);
  }

  stop(): ReplayData {
    this.isRecording = false;
    const lastTick = this.frames.length > 0 ? this.frames[this.frames.length - 1].tick : 0;
    console.log(`[ReplayRecorder] Stopped recording. ${this.frames.length} frames, ${lastTick} ticks`);

    return {
      version: 1,
      levelId: this.levelId,
      recordedAt: new Date().toISOString(),
      duration: lastTick, // Duration in ticks, not ms
      frames: this.frames,
      metadata: {
        gemsCollected: this.gemsCollected,
        checkpointsHit: this.checkpointsHit,
        completed: this.completed,
        finalTime: this.finalTime,
      },
    };
  }

  /**
   * Record current input state (call every frame with current physics tick)
   */
  recordFrame(keys: InputFrame['keys'], currentTick: number): void {
    if (!this.isRecording) return;

    const relativeTick = currentTick - this.startTick;

    // Only record if keys changed (delta compression)
    const keysChanged =
      keys.forward !== this.lastKeys.forward ||
      keys.backward !== this.lastKeys.backward ||
      keys.left !== this.lastKeys.left ||
      keys.right !== this.lastKeys.right ||
      keys.jump !== this.lastKeys.jump;

    if (keysChanged && relativeTick > this.lastRecordedTick) {
      this.frames.push({
        tick: relativeTick,
        keys: { ...keys },
      });
      this.lastKeys = { ...keys };
      this.lastRecordedTick = relativeTick;
    }
  }

  // Metadata setters
  addGem(): void {
    this.gemsCollected++;
  }

  addCheckpoint(id: string): void {
    if (!this.checkpointsHit.includes(id)) {
      this.checkpointsHit.push(id);
    }
  }

  setCompleted(time: number): void {
    this.completed = true;
    this.finalTime = time;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Export replay data as downloadable JSON
   */
  static download(data: ReplayData): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${data.levelId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global instance for easy access
export const replayRecorder = new ReplayRecorder();
