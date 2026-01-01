import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { Physics } from '../engine/Physics';
import { Input } from '../engine/Input';
import { Time } from '../utils/Timer';
import { StateMachine, GameState } from './StateMachine';
import { PlayerController } from './PlayerController';
import { CameraRig } from './CameraRig';
import { LevelLoader } from './LevelLoader';
import { CollisionHandler } from './CollisionHandler';
import { VFXManager } from '../vfx/VFXManager';
import { HUD } from '../ui/HUD';
import { MainMenu } from '../ui/MainMenu';
import { LevelSelect } from '../ui/LevelSelect';
import { PauseMenu } from '../ui/PauseMenu';
import { ResultsScreen } from '../ui/ResultsScreen';
import { eventBus, GameEvents } from '../utils/EventBus';
import { LevelDefinition } from './pieces/types';

// Import levels
import level1 from '../levels/level1.json';
import level2 from '../levels/level2.json';
import level3 from '../levels/level3.json';
import level4 from '../levels/level4.json';
import level5 from '../levels/level5.json';
import level6 from '../levels/level6.json';

const LEVELS: LevelDefinition[] = [
  level1 as LevelDefinition,
  level2 as LevelDefinition,
  level3 as LevelDefinition,
  level4 as LevelDefinition,
  level5 as LevelDefinition,
  level6 as LevelDefinition,
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
      this.collisionHandler
    );
    this.vfx = new VFXManager(this.renderer.scene);

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

    // Show main menu
    this.stateMachine.setState(GameState.MENU);

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
      }))
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
        this.unloadLevel();
        this.stateMachine.setState(GameState.LEVEL_SELECT);
      }
    });
    this.resultsScreen.setOnReplay(() => {
      this.restartLevel();
    });
    this.resultsScreen.setOnExit(() => {
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
    // Gem collected - trigger VFX
    eventBus.on<{ id: string }>(GameEvents.GEM_COLLECTED, ({ id }) => {
      // VFX is triggered by the gem piece itself
    });

    // Player respawn - clear trail
    eventBus.on(GameEvents.PLAYER_RESPAWN, () => {
      this.vfx.clearTrail();
    });
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
      },
      onExit: () => {
        this.hud.pauseTimer();
      },
    });

    this.stateMachine.registerState(GameState.PAUSED, {
      onEnter: () => {
        this.pauseMenu.show();
        this.input.setEnabled(false);
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

    // Unload previous level
    this.unloadLevel();

    // Load new level
    const spawnPosition = this.levelLoader.load(levelDef);

    // Create player
    this.player = new PlayerController(
      this.physics,
      this.renderer.scene,
      this.renderer.camera,
      spawnPosition
    );

    // Register player collider
    this.collisionHandler.setPlayerCollider(this.player.getColliderHandle());

    // Create camera rig
    this.cameraRig = new CameraRig(
      this.renderer.camera as THREE.PerspectiveCamera,
      this.physics
    );
    this.cameraRig.snapToTarget(spawnPosition);

    // Setup HUD
    this.hud.setTotalGems(this.levelLoader.getGemCount());
    this.hud.reset();

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
      // Show message that gems are required
      return;
    }

    // Stop timer and get time
    const time = this.hud.stopTimer();
    const bestTime = this.bestTimes.get(level.id);
    const isNewBest = !bestTime || time < bestTime;

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
    const inputState = this.input.getState();

    // Step physics with player update
    this.physics.step(dt, () => {
      this.player?.update(dt, inputState);
    });

    // Process collision events
    this.collisionHandler.processEvents();

    // Update level (kinematic pieces)
    this.levelLoader.update(dt, this.time.getElapsed());

    // Update camera
    if (this.player && this.cameraRig) {
      this.cameraRig.update(this.player.getPosition(), dt);
    }

    // Update VFX
    this.vfx.update(dt);
    if (this.player) {
      this.vfx.updateTrail(
        this.player.getPosition(),
        this.player.getVelocity(),
        dt
      );
    }

    // Update HUD
    this.hud.update();
  }

  private loadBestTimes(): void {
    try {
      const stored = localStorage.getItem('marbleRun_bestTimes');
      if (stored) {
        const times = JSON.parse(stored) as Record<string, number>;
        Object.entries(times).forEach(([id, time]) => {
          this.bestTimes.set(id, time);
        });
      }
    } catch (e) {
      console.warn('Failed to load best times:', e);
    }
  }

  private saveBestTimes(): void {
    try {
      const times: Record<string, number> = {};
      this.bestTimes.forEach((time, id) => {
        times[id] = time;
      });
      localStorage.setItem('marbleRun_bestTimes', JSON.stringify(times));
    } catch (e) {
      console.warn('Failed to save best times:', e);
    }
  }

  dispose(): void {
    this.isRunning = false;

    this.player?.dispose();
    this.levelLoader.unload();
    this.vfx.dispose();
    this.renderer.dispose();
    this.physics.dispose();
    this.input.dispose();

    this.hud.dispose();
    this.mainMenu.dispose();
    this.levelSelect.dispose();
    this.pauseMenu.dispose();
    this.resultsScreen.dispose();
  }
}
