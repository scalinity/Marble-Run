import * as THREE from "three";
import { Physics } from "../engine/Physics";
import { CollisionHandler, TriggerType, TriggerData } from "./CollisionHandler";
import { pieceRegistry } from "./pieces/PieceRegistry";
import {
  LevelDefinition,
  PieceData,
  PieceInstance,
  PieceContext,
} from "./pieces/types";

/**
 * Level loader - parses level JSON and instantiates pieces
 */
export class LevelLoader {
  private scene: THREE.Scene;
  private physics: Physics;
  private collisionHandler: CollisionHandler;

  // Active level state
  private pieces: PieceInstance[] = [];
  private kinematicPieces: PieceInstance[] = [];
  private triggerPieces: PieceInstance[] = [];

  // Level info
  private currentLevel: LevelDefinition | null = null;
  private gemCount = 0;

  // Callbacks
  private onCheckpoint?: (position: THREE.Vector3) => void;
  private onGoalReached?: () => void;

  constructor(
    scene: THREE.Scene,
    physics: Physics,
    collisionHandler: CollisionHandler,
  ) {
    this.scene = scene;
    this.physics = physics;
    this.collisionHandler = collisionHandler;
  }

  /**
   * Set checkpoint callback
   */
  setOnCheckpoint(callback: (position: THREE.Vector3) => void): void {
    this.onCheckpoint = callback;
  }

  /**
   * Set goal reached callback
   */
  setOnGoalReached(callback: () => void): void {
    this.onGoalReached = callback;
  }

  /**
   * Load a level from definition
   */
  load(levelDef: LevelDefinition): THREE.Vector3 {
    // Clear previous level
    this.unload();

    this.currentLevel = levelDef;
    this.gemCount = 0;

    // Create piece context
    const context = this.createContext();

    // Instantiate all pieces
    for (const pieceData of levelDef.pieces) {
      const piece = pieceRegistry.create(pieceData, context);

      if (piece) {
        this.pieces.push(piece);

        // Categorize for update loop
        if (piece.update) {
          if (
            pieceData.type === "movingPlatform" ||
            pieceData.type === "spinnerHazard"
          ) {
            this.kinematicPieces.push(piece);
          } else {
            this.triggerPieces.push(piece);
          }
        }

        // Count gems
        if (pieceData.type === "gem") {
          this.gemCount++;
        }
      }
    }

    console.log(
      `Level "${levelDef.name}" loaded: ${this.pieces.length} pieces, ${this.gemCount} gems`,
    );

    // Return spawn position
    return new THREE.Vector3(
      levelDef.spawnPoint[0],
      levelDef.spawnPoint[1],
      levelDef.spawnPoint[2],
    );
  }

  /**
   * Load level from URL
   */
  async loadFromUrl(url: string): Promise<THREE.Vector3> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load level: ${response.statusText}`);
    }

    const levelDef: LevelDefinition = await response.json();
    return this.load(levelDef);
  }

  /**
   * Unload current level
   */
  unload(): void {
    // Dispose all pieces
    for (const piece of this.pieces) {
      piece.dispose();
    }

    this.pieces = [];
    this.kinematicPieces = [];
    this.triggerPieces = [];
    this.currentLevel = null;
    this.gemCount = 0;

    // Reset collision handler
    this.collisionHandler.reset();
  }

  /**
   * Update kinematic and trigger pieces
   */
  update(dt: number, elapsed: number): void {
    // Update kinematic pieces (moving platforms, spinners)
    for (const piece of this.kinematicPieces) {
      piece.update?.(dt, elapsed);
    }

    // Update trigger pieces (gems, checkpoints, goals)
    for (const piece of this.triggerPieces) {
      piece.update?.(dt, elapsed);
    }
  }

  /**
   * Reset triggers (gems, checkpoints) for replay testing
   * Re-enables collected gems without reloading the level
   */
  resetTriggers(): void {
    // Reset gem visibility - they have a reset method via their mesh visibility
    for (const piece of this.triggerPieces) {
      if (piece.type === "gem" && piece.mesh) {
        piece.mesh.visible = true;
      }
    }
  }

  /**
   * Create context for piece factories
   */
  private createContext(): PieceContext {
    return {
      scene: this.scene,
      physics: {
        world: this.physics.world,
        createFixedBody: this.physics.createFixedBody.bind(this.physics),
        createKinematicBody: this.physics.createKinematicBody.bind(
          this.physics,
        ),
        createBoxCollider: this.physics.createBoxCollider.bind(this.physics),
        createCylinderCollider: this.physics.createCylinderCollider.bind(
          this.physics,
        ),
        removeBody: this.physics.removeBody.bind(this.physics),
      },
      registerTrigger: (
        colliderHandle: number,
        type: string,
        id: string,
        callback?: () => void,
        onExit?: () => void,
      ) => {
        this.collisionHandler.registerTrigger(colliderHandle, {
          type: type as TriggerType,
          id,
          callback,
          onExit,
        });
      },
      onCheckpoint: this.onCheckpoint,
      onGoalReached: this.onGoalReached,
    };
  }

  /**
   * Get current level info
   */
  getLevelInfo(): {
    name: string;
    gemCount: number;
    requireAllGems: boolean;
  } | null {
    if (!this.currentLevel) return null;

    return {
      name: this.currentLevel.name,
      gemCount: this.gemCount,
      requireAllGems: this.currentLevel.requireAllGems,
    };
  }

  /**
   * Get total gem count
   */
  getGemCount(): number {
    return this.gemCount;
  }

  /**
   * Check if all gems are collected
   */
  areAllGemsCollected(): boolean {
    return this.collisionHandler.getCollectedGemCount() >= this.gemCount;
  }
}
