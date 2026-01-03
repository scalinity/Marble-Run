import * as THREE from "three";
import { Renderer } from "../engine/Renderer";
import { Physics } from "../engine/Physics";
import { Input } from "../engine/Input";
import { Time } from "../utils/Timer";
import { StateMachine, GameState } from "./StateMachine";
import { PlayerController } from "./PlayerController";
import { CameraRig } from "./CameraRig";
import { LevelLoader } from "./LevelLoader";
import { CollisionHandler } from "./CollisionHandler";
import { VFXManager } from "../vfx/VFXManager";
import { HUD } from "../ui/HUD";
import { MainMenu } from "../ui/MainMenu";
import { LevelSelect } from "../ui/LevelSelect";
import { PauseMenu } from "../ui/PauseMenu";
import { ResultsScreen } from "../ui/ResultsScreen";
import { eventBus, GameEvents } from "../utils/EventBus";
import { LevelDefinition } from "./pieces/types";
import {
  replayRecorder,
  ReplayRecorder,
  ReplayData,
} from "../testing/ReplayRecorder";
import { replayTestRunner } from "../testing/ReplayTestRunner";
import { audioDirector } from "../audio/AudioDirector";
import { PowerUpManager } from "./PowerUpManager";
import { teleporterRegistry } from "./TeleporterRegistry";

// Import levels
import level1 from "../levels/level1.json";
import level2 from "../levels/level2.json";
import level3 from "../levels/level3.json";
import level4 from "../levels/level4.json";
import level5 from "../levels/level5.json";
import level6 from "../levels/level6.json";
import level7 from "../levels/level7.json";
import level8 from "../levels/level8.json";
import level9 from "../levels/level9.json";
import level10 from "../levels/level10.json";
import level11 from "../levels/level11.json";
import level12 from "../levels/level12.json";
import level13 from "../levels/level13.json";
import level14 from "../levels/level14.json";
import level15 from "../levels/level15.json";
import level16 from "../levels/level16.json";

const LEVELS: LevelDefinition[] = [
  level1 as LevelDefinition,
  level2 as LevelDefinition,
  level3 as LevelDefinition,
  level4 as LevelDefinition,
  level5 as LevelDefinition,
  level6 as LevelDefinition,
  level7 as LevelDefinition,
  level8 as LevelDefinition,
  level9 as LevelDefinition,
  level10 as LevelDefinition,
  level11 as LevelDefinition,
  level12 as LevelDefinition,
  level13 as LevelDefinition,
  level14 as LevelDefinition,
  level15 as LevelDefinition,
  level16 as LevelDefinition,
];

/**
 * Main game class - coordinates all systems
 */
export class Game {
  // Core systems
  private renderer: Renderer;
  private physics: Physics;
  private input: Input;
  private time: Time;
  private stateMachine: StateMachine;

  // Game objects
  private player: PlayerController | null = null;
  private cameraRig: CameraRig | null = null;
  private levelLoader: LevelLoader;
  private collisionHandler: CollisionHandler;
  private vfx: VFXManager;
  private powerUpManager: PowerUpManager;

  // UI
  private hud: HUD;
  private mainMenu: MainMenu;
  private levelSelect: LevelSelect;
  private pauseMenu: PauseMenu;
  private resultsScreen: ResultsScreen;

  // State
  private currentLevelIndex = 0;
  private isRunning = false;
  private bestTimes: Map<string, number> = new Map();
  private lastReplay: ReplayData | null = null;

  // Event unsubscribe functions to prevent memory leaks
  private unsubscribers: (() => void)[] = [];

  constructor(container: HTMLElement) {
    // Initialize core systems
    this.renderer = new Renderer(container);
    this.physics = new Physics();
    this.input = new Input();
    this.time = new Time();
    this.stateMachine = new StateMachine();

    // Initialize game systems
    this.collisionHandler = new CollisionHandler(this.physics);
    this.levelLoader = new LevelLoader(
      this.renderer.scene,
      this.physics,
      this.collisionHandler,
    );
    this.vfx = new VFXManager(this.renderer.scene);
    this.powerUpManager = new PowerUpManager();

    // Initialize UI
    this.hud = new HUD();
    this.mainMenu = new MainMenu();
    this.levelSelect = new LevelSelect();
    this.pauseMenu = new PauseMenu();
    this.resultsScreen = new ResultsScreen();

    // Load best times from localStorage
    this.loadBestTimes();

    // Setup callbacks
    this.setupCallbacks();
    this.setupEventListeners();
    this.setupStateMachine();
  }

  /**
   * Initialize and start the game
   */
  async start(): Promise<void> {
    // Initialize physics (async)
    await this.physics.init();

    // Initialize audio (requires user interaction to unlock)
    await audioDirector.init();
    await audioDirector.resume();

    // Show main menu (call show() directly since state machine is already in MENU state)
    this.mainMenu.show();

    // Start game loop
    this.isRunning = true;
    this.gameLoop(performance.now());
  }

  private setupCallbacks(): void {
    // Main menu
    this.mainMenu.setOnStart(() => {
      this.stateMachine.setState(GameState.LEVEL_SELECT);
    });

    // Level select
    this.levelSelect.setLevels(
      LEVELS.map((level, index) => ({
        id: level.id,
        name: level.name,
        bestTime: this.bestTimes.get(level.id),
      })),
    );
    this.levelSelect.setOnSelect((levelId) => {
      const index = LEVELS.findIndex((l) => l.id === levelId);
      if (index !== -1) {
        this.currentLevelIndex = index;
        this.loadLevel(LEVELS[index]);
      }
    });
    this.levelSelect.setOnBack(() => {
      this.stateMachine.setState(GameState.MENU);
    });

    // Pause menu
    this.pauseMenu.setOnResume(() => {
      this.stateMachine.setState(GameState.PLAYING);
    });
    this.pauseMenu.setOnRestart(() => {
      this.restartLevel();
    });
    this.pauseMenu.setOnExit(() => {
      this.unloadLevel();
      this.stateMachine.setState(GameState.MENU);
    });

    // Results screen
    this.resultsScreen.setOnNextLevel(() => {
      if (this.currentLevelIndex < LEVELS.length - 1) {
        this.currentLevelIndex++;
        this.loadLevel(LEVELS[this.currentLevelIndex]);
      } else {
        // Last level - go back to level select
        this.resultsScreen.hide();
        this.unloadLevel();
        this.stateMachine.setState(GameState.LEVEL_SELECT);
      }
    });
    this.resultsScreen.setOnReplay(() => {
      this.restartLevel();
    });
    this.resultsScreen.setOnExit(() => {
      this.resultsScreen.hide();
      this.unloadLevel();
      this.stateMachine.setState(GameState.LEVEL_SELECT);
    });

    // Level loader callbacks
    this.levelLoader.setOnCheckpoint((position) => {
      this.player?.setCheckpoint(position);
    });
    this.levelLoader.setOnGoalReached(() => {
      this.handleGoalReached();
    });
  }

  private setupEventListeners(): void {
    // Store unsubscribe functions to prevent memory leaks
    this.unsubscribers.push(
      // Gem collected - trigger VFX and record
      eventBus.on<{ id: string }>(GameEvents.GEM_COLLECTED, () => {
        // VFX is triggered by the gem piece itself
        if (replayRecorder.isActive()) {
          replayRecorder.addGem();
        }
      }),

      // Checkpoint activated - record
      eventBus.on<{ position: THREE.Vector3 }>(
        GameEvents.CHECKPOINT_ACTIVATED,
        () => {
          if (replayRecorder.isActive()) {
            replayRecorder.addCheckpoint(LEVELS[this.currentLevelIndex].id);
          }
        },
      ),

      // Player respawn - clear trail
      eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
        this.vfx.clearTrail();
      }),

      // Player land - trigger screen shake
      eventBus.on(GameEvents.PLAYER_LAND, () => {
        if (this.cameraRig && this.player) {
          // Small shake on landing, intensity based on fall speed would be ideal
          this.cameraRig.shake(0.15, 0.1);
        }
      }),

      // Power-up collected - activate in manager
      eventBus.on<{ type: string; duration: number; id: string }>(
        GameEvents.POWERUP_COLLECTED,
        (data) => {
          // Only activate if it's from a pickup (has an id), not from PowerUpManager.activate() itself
          if (data.id) {
            this.powerUpManager.activate(
              data.type as "shield" | "doubleJump" | "speedBoost",
              data.duration,
            );
          }
        },
      ),
    );
  }

  private setupStateMachine(): void {
    this.stateMachine.registerState(GameState.MENU, {
      onEnter: () => {
        this.mainMenu.show();
        this.levelSelect.hide();
        this.hud.hide();
        this.pauseMenu.hide();
        this.resultsScreen.hide();
        this.input.setEnabled(false);
        audioDirector.playMenuMusic();
      },
      onExit: () => {
        this.mainMenu.hide();
      },
    });

    this.stateMachine.registerState(GameState.LEVEL_SELECT, {
      onEnter: () => {
        this.levelSelect.show();
        this.input.setEnabled(false);
      },
      onExit: () => {
        this.levelSelect.hide();
      },
    });

    this.stateMachine.registerState(GameState.LOADING, {
      onEnter: () => {
        // Show loading indicator if needed
      },
    });

    this.stateMachine.registerState(GameState.PLAYING, {
      onEnter: () => {
        this.hud.show();
        this.hud.resumeTimer();
        this.pauseMenu.hide();
        this.resultsScreen.hide();
        this.input.setEnabled(true);
        // Auto-focus canvas for keyboard input
        this.renderer.renderer.domElement.focus();
        eventBus.emit(GameEvents.GAME_RESUME, {});
      },
      onExit: () => {
        this.hud.pauseTimer();
      },
    });

    this.stateMachine.registerState(GameState.PAUSED, {
      onEnter: () => {
        this.pauseMenu.show();
        this.input.setEnabled(false);
        eventBus.emit(GameEvents.GAME_PAUSE, {});
      },
      onExit: () => {
        this.pauseMenu.hide();
      },
    });

    this.stateMachine.registerState(GameState.COMPLETE, {
      onEnter: () => {
        this.input.setEnabled(false);
      },
    });
  }

  private loadLevel(levelDef: LevelDefinition): void {
    this.stateMachine.setState(GameState.LOADING);

    // Hide any open screens
    this.resultsScreen.hide();

    // Unload previous level
    this.unloadLevel();

    // Load new level
    const spawnPosition = this.levelLoader.load(levelDef);

    // Create player
    this.player = new PlayerController(
      this.physics,
      this.renderer.scene,
      this.renderer.camera,
      spawnPosition,
    );

    // Register player collider
    this.collisionHandler.setPlayerCollider(this.player.getColliderHandle());

    // Connect player to power-up manager
    this.player.setPowerUpManager(this.powerUpManager);

    // Reset power-up manager for new level
    this.powerUpManager.reset();

    // Create camera rig
    this.cameraRig = new CameraRig(
      this.renderer.camera as THREE.PerspectiveCamera,
      this.physics,
    );
    this.cameraRig.snapToTarget(spawnPosition);

    // Setup HUD
    this.hud.setTotalGems(this.levelLoader.getGemCount());
    this.hud.reset();

    // Setup audio for level
    const pieces = levelDef.pieces.map((p) => ({
      id: p.id || `${p.type}_${p.position.join("_")}`,
      type: p.type,
      position: p.position as [number, number, number],
    }));
    audioDirector.setLevelAmbience(levelDef.id, pieces);
    audioDirector.playGameMusic();

    // Start playing
    this.stateMachine.setState(GameState.PLAYING);
    this.hud.startTimer();
  }

  private unloadLevel(): void {
    this.player?.dispose();
    this.player = null;
    this.cameraRig = null;
    this.levelLoader.unload();
    this.vfx.reset();
    this.hud.hide();
    this.powerUpManager.reset();
    teleporterRegistry.clear();
    audioDirector.stopAll();
  }

  private restartLevel(): void {
    const level = LEVELS[this.currentLevelIndex];
    if (level) {
      this.loadLevel(level);
    }
  }

  private handleGoalReached(): void {
    if (!this.stateMachine.isPlaying()) return;

    const level = LEVELS[this.currentLevelIndex];
    const levelInfo = this.levelLoader.getLevelInfo();

    // Check if all gems are required
    if (levelInfo?.requireAllGems && !this.levelLoader.areAllGemsCollected()) {
      const remaining =
        this.levelLoader.getGemCount() -
        this.collisionHandler.getCollectedGemCount();
      this.hud.showMessage(`Collect all gems! (${remaining} remaining)`);
      return;
    }

    // Emit level complete event (triggers goal gate victory animation)
    eventBus.emit(GameEvents.LEVEL_COMPLETE, { levelId: level.id });

    // Stop timer and get time
    const time = this.hud.stopTimer();
    const bestTime = this.bestTimes.get(level.id);
    const isNewBest = !bestTime || time < bestTime;

    // Mark recording as completed and auto-save
    if (replayRecorder.isActive()) {
      replayRecorder.setCompleted(time);
      const replayData = replayRecorder.stop();
      this.lastReplay = replayData;
      ReplayRecorder.download(replayData);
      console.log(
        "[Game] Level completed - Recording auto-saved (F7 to replay)",
      );
    }

    // Notify replay test runner if active
    if (replayTestRunner.isActive()) {
      replayTestRunner.setCompleted(time);
    }

    // Save best time
    if (isNewBest) {
      this.bestTimes.set(level.id, time);
      this.saveBestTimes();
      this.levelSelect.updateBestTime(level.id, time);
    }

    // Trigger VFX
    if (this.player) {
      this.vfx.levelComplete(this.player.getPosition(), () => {
        // Show results screen
        this.resultsScreen.showResults({
          levelName: level.name,
          time,
          gemsCollected: this.collisionHandler.getCollectedGemCount(),
          totalGems: this.levelLoader.getGemCount(),
          bestTime: isNewBest ? time : bestTime,
          isNewBest,
        });
      });
    }

    this.stateMachine.setState(GameState.COMPLETE);
  }

  private gameLoop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Update time
    this.time.update(currentTime);
    const dt = this.time.getDelta();

    // Handle pause input
    const inputState = this.input.getState();
    if (inputState.pause) {
      if (this.stateMachine.isPlaying()) {
        this.stateMachine.setState(GameState.PAUSED);
      } else if (this.stateMachine.isPaused()) {
        this.stateMachine.setState(GameState.PLAYING);
      }
    }

    // F7 replay works from any state (including completion screen)
    if (
      this.input.isKeyJustPressed("f7") &&
      !replayTestRunner.isActive() &&
      !replayRecorder.isActive()
    ) {
      if (this.lastReplay) {
        this.runStoredReplay();
      } else {
        this.loadAndRunReplay();
      }
    }

    // Update based on state
    if (this.stateMachine.isPlaying()) {
      this.updatePlaying(dt);
    }

    // Always render
    this.renderer.render();

    // End frame
    this.input.endFrame();

    // Request next frame
    requestAnimationFrame(this.gameLoop);
  };

  private updatePlaying(dt: number): void {
    let inputState = this.input.getState();

    // Handle replay recording controls (F5 to start, F6 to stop/save, F7 to load/test)
    if (
      this.input.isKeyJustPressed("f5") &&
      !replayRecorder.isActive() &&
      !replayTestRunner.isActive()
    ) {
      // Reset to clean state before recording (keep triggers registered!)
      this.physics.resetTick();
      this.player?.respawn();
      this.hud.stopTimer();
      this.hud.startTimer();
      this.collisionHandler.resetState(); // Don't clear triggers, just collected state
      this.levelLoader.resetTriggers();
      replayRecorder.start(
        LEVELS[this.currentLevelIndex].id,
        this.physics.getTick(),
      );
      console.log(
        "[Game] Recording started from spawn - Press F6 to stop and save",
      );
    }
    if (this.input.isKeyJustPressed("f6") && replayRecorder.isActive()) {
      const replayData = replayRecorder.stop();
      this.lastReplay = replayData;
      ReplayRecorder.download(replayData);
      console.log("[Game] Recording saved (F7 to replay)");
    }
    // Note: F7 is handled in gameLoop so it works from any state

    // Record frame if active
    if (replayRecorder.isActive()) {
      replayRecorder.recordFrame(
        this.input.getRecordingState(),
        this.physics.getTick(),
      );
    }

    // Override input with replay if test is running
    if (replayTestRunner.isActive()) {
      const replayInput = replayTestRunner.getReplayInput(
        this.physics.getTick(),
      );
      if (replayInput) {
        inputState = {
          moveX: (replayInput.left ? -1 : 0) + (replayInput.right ? 1 : 0),
          moveZ:
            (replayInput.forward ? -1 : 0) + (replayInput.backward ? 1 : 0),
          jump: false, // Handled by jumpHeld for replay
          jumpHeld: replayInput.jump,
          reset: false,
          pause: false,
        };
      }
    }

    // Step physics with player update
    this.physics.step(dt, () => {
      this.player?.update(dt, inputState);
    });

    // Process collision events
    this.collisionHandler.processEvents();

    // Update level (kinematic pieces)
    this.levelLoader.update(dt, this.time.getElapsed());

    // Update power-ups
    this.powerUpManager.update(dt);

    // Update camera
    if (this.player && this.cameraRig) {
      this.cameraRig.update(this.player.getPosition(), dt);
    }

    // Update VFX (pass camera position for starfield)
    this.vfx.update(dt, this.renderer.camera.position);
    if (this.player) {
      this.vfx.updateTrail(
        this.player.getPosition(),
        this.player.getVelocity(),
        dt,
      );
    }

    // Update HUD
    this.hud.update();

    // Update audio system
    if (this.player && this.cameraRig) {
      const cameraForward = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(cameraForward);

      audioDirector.update(
        dt,
        this.player.getPosition(),
        this.player.getVelocity(),
        this.renderer.camera.position,
        cameraForward,
        this.player.isOnGround(),
        null, // Surface type - could be expanded later
        [], // Hazard distances - could be expanded later
      );
    }
  }

  /**
   * Run the last recorded replay from memory
   */
  private runStoredReplay(): void {
    if (!this.lastReplay) {
      console.log("[Game] No replay stored - press F5 to record first");
      return;
    }

    const replayData = this.lastReplay;
    console.log(`[Game] Running stored replay for ${replayData.levelId}`);

    // Check if replay matches current level
    const currentLevelId = LEVELS[this.currentLevelIndex].id;
    if (replayData.levelId !== currentLevelId) {
      // Find and load the correct level
      const levelIndex = LEVELS.findIndex((l) => l.id === replayData.levelId);
      if (levelIndex === -1) {
        console.error(`[Game] Level "${replayData.levelId}" not found`);
        return;
      }

      this.currentLevelIndex = levelIndex;
      this.loadLevel(LEVELS[levelIndex]);
      setTimeout(() => {
        this.startReplayTest(replayData, "last-recording.json");
      }, 500);
      return;
    }

    // Reset and start (ignore the respawn event so test doesn't abort immediately)
    replayTestRunner.ignoreRespawn();
    this.player?.respawn();
    this.startReplayTest(replayData, "last-recording.json");
  }

  /**
   * Load a replay file and run it as a test
   */
  private loadAndRunReplay(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const replayData = JSON.parse(text) as ReplayData;

        // Validate replay
        if (!replayData.version || !replayData.levelId || !replayData.frames) {
          console.error("[Game] Invalid replay file format");
          return;
        }

        // Check if replay matches current level
        const currentLevelId = LEVELS[this.currentLevelIndex].id;
        if (replayData.levelId !== currentLevelId) {
          console.warn(
            `[Game] Replay is for level "${replayData.levelId}" but current level is "${currentLevelId}"`,
          );
          console.warn("[Game] Loading correct level...");

          // Find and load the correct level
          const levelIndex = LEVELS.findIndex(
            (l) => l.id === replayData.levelId,
          );
          if (levelIndex === -1) {
            console.error(`[Game] Level "${replayData.levelId}" not found`);
            return;
          }

          // Load the level first, then start test after a short delay
          this.currentLevelIndex = levelIndex;
          this.loadLevel(LEVELS[levelIndex]);
          setTimeout(() => {
            this.startReplayTest(replayData, file.name);
          }, 500);
          return;
        }

        // Reset level state and start test
        replayTestRunner.ignoreRespawn();
        this.player?.respawn();
        this.startReplayTest(replayData, file.name);
      } catch (err) {
        console.error("[Game] Failed to load replay:", err);
      }
    };
    input.click();
  }

  private startReplayTest(replayData: ReplayData, fileName: string): void {
    // Reset level to initial state (keep triggers registered!)
    this.physics.resetTick();
    this.hud.stopTimer();
    this.hud.startTimer();
    this.collisionHandler.resetState(); // Don't clear triggers, just collected state
    this.levelLoader.resetTriggers();

    console.log(`[Game] Starting replay test: ${fileName}`);

    replayTestRunner.startTest(
      replayData,
      fileName,
      this.physics.getTick(),
      (result) => {
        console.log("[Game] ====== REPLAY TEST RESULT ======");
        console.log(`Level: ${result.levelId}`);
        console.log(`File: ${result.replayFile}`);
        console.log(`Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
        console.log(`Completed: ${result.completed}`);
        console.log(`Gems: ${result.actualGems}/${result.expectedGems}`);
        if (result.completed) {
          console.log(
            `Time: ${result.actualTime.toFixed(2)}s (expected: ${result.expectedTime.toFixed(2)}s)`,
          );
        }
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        console.log("==================================");
      },
    );
  }

  private loadBestTimes(): void {
    try {
      const stored = localStorage.getItem("marbleRun_bestTimes");
      if (stored) {
        const times = JSON.parse(stored) as Record<string, number>;
        Object.entries(times).forEach(([id, time]) => {
          this.bestTimes.set(id, time);
        });
      }
    } catch (e) {
      console.warn("Failed to load best times:", e);
    }
  }

  private saveBestTimes(): void {
    try {
      const times: Record<string, number> = {};
      this.bestTimes.forEach((time, id) => {
        times[id] = time;
      });
      localStorage.setItem("marbleRun_bestTimes", JSON.stringify(times));
    } catch (e) {
      console.warn("Failed to save best times:", e);
    }
  }

  dispose(): void {
    this.isRunning = false;

    // Unsubscribe from all events to prevent memory leaks
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    this.player?.dispose();
    this.levelLoader.unload();
    this.vfx.dispose();
    this.renderer.dispose();
    this.physics.dispose();
    this.input.dispose();
    audioDirector.dispose();

    this.hud.dispose();
    this.mainMenu.dispose();
    this.levelSelect.dispose();
    this.pauseMenu.dispose();
    this.resultsScreen.dispose();
  }
}
