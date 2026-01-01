/**
 * Replay Test Runner
 * Plays back recorded inputs and verifies level completion
 */

import { ReplayData } from './ReplayRecorder';
import { replayPlayer } from './ReplayPlayer';
import { eventBus, GameEvents } from '../utils/EventBus';

export interface TestResult {
  levelId: string;
  replayFile: string;
  passed: boolean;
  completed: boolean;
  expectedGems: number;
  actualGems: number;
  expectedTime: number;
  actualTime: number;
  error?: string;
}

export type TestCallback = (result: TestResult) => void;

/**
 * Manages replay testing
 */
export class ReplayTestRunner {
  private isRunning = false;
  private currentReplay: ReplayData | null = null;
  private replayFileName = '';
  private gemsCollected = 0;
  private completed = false;
  private completionTime = 0;
  private onComplete: TestCallback | null = null;
  private timeout: number | null = null;
  private ignoreNextRespawn = false; // Skip the initial respawn at test start

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for gem collection
    eventBus.on<{ id: string }>(GameEvents.GEM_COLLECTED, () => {
      if (this.isRunning) {
        this.gemsCollected++;
      }
    });

    // Listen for level completion
    eventBus.on(GameEvents.LEVEL_COMPLETE, () => {
      if (this.isRunning) {
        this.completed = true;
      }
    });

    // Listen for player respawn - abort replay test on death
    eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
      if (this.isRunning) {
        if (this.ignoreNextRespawn) {
          this.ignoreNextRespawn = false;
          return;
        }
        console.log('[ReplayTestRunner] Player died during replay - test failed');
        this.finishTest();
      }
    });
  }

  /**
   * Start a replay test at the given physics tick
   */
  startTest(replay: ReplayData, fileName: string, currentTick: number, onComplete: TestCallback): void {
    if (this.isRunning) {
      console.warn('[ReplayTestRunner] Test already running');
      return;
    }

    this.isRunning = true;
    this.currentReplay = replay;
    this.replayFileName = fileName;
    this.gemsCollected = 0;
    this.completed = false;
    this.completionTime = 0;
    this.onComplete = onComplete;

    // Load replay into player
    replayPlayer.load(replay);
    replayPlayer.start(currentTick);

    // Set timeout: duration in ticks * ~16.67ms per tick + 5 seconds buffer
    const timeoutMs = (replay.duration * 16.67) + 5000;
    this.timeout = window.setTimeout(() => {
      this.finishTest();
    }, timeoutMs);

    console.log(`[ReplayTestRunner] Started test for ${replay.levelId} at tick ${currentTick} (timeout: ${timeoutMs.toFixed(0)}ms)`);
  }

  /**
   * Check if replay is active and get current input
   */
  getReplayInput(currentTick: number): { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean } | null {
    if (!this.isRunning) return null;
    return replayPlayer.update(currentTick);
  }

  /**
   * Mark level as completed with time
   */
  setCompleted(time: number): void {
    if (this.isRunning) {
      this.completed = true;
      this.completionTime = time;
      this.finishTest();
    }
  }

  /**
   * Check if test is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Tell the test runner to ignore the next respawn event
   * (used when intentionally respawning to start a test)
   */
  ignoreRespawn(): void {
    this.ignoreNextRespawn = true;
  }

  /**
   * Finish the test and report results
   */
  private finishTest(): void {
    if (!this.isRunning || !this.currentReplay) return;

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    replayPlayer.stop();

    const result: TestResult = {
      levelId: this.currentReplay.levelId,
      replayFile: this.replayFileName,
      passed: this.completed && this.gemsCollected >= this.currentReplay.metadata.gemsCollected,
      completed: this.completed,
      expectedGems: this.currentReplay.metadata.gemsCollected,
      actualGems: this.gemsCollected,
      expectedTime: this.currentReplay.metadata.finalTime,
      actualTime: this.completionTime,
    };

    if (!this.completed) {
      result.error = 'Level not completed within replay duration';
    } else if (this.gemsCollected < this.currentReplay.metadata.gemsCollected) {
      result.error = `Collected fewer gems than expected (${this.gemsCollected}/${this.currentReplay.metadata.gemsCollected})`;
    }

    console.log(`[ReplayTestRunner] Test ${result.passed ? 'PASSED' : 'FAILED'}: ${result.levelId}`);
    if (result.error) {
      console.log(`[ReplayTestRunner] Error: ${result.error}`);
    }

    this.isRunning = false;
    this.currentReplay = null;

    this.onComplete?.(result);
    this.onComplete = null;
  }

  /**
   * Abort current test
   */
  abort(): void {
    if (this.isRunning) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      replayPlayer.stop();
      this.isRunning = false;
      this.currentReplay = null;
      console.log('[ReplayTestRunner] Test aborted');
    }
  }
}

// Global instance
export const replayTestRunner = new ReplayTestRunner();
