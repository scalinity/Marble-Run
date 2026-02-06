import { Physics } from "../engine/Physics";
import { eventBus, GameEvents } from "../utils/EventBus";

/**
 * Trigger type for collision handling
 */
export enum TriggerType {
  GEM = "gem",
  CHECKPOINT = "checkpoint",
  GOAL = "goal",
  BOUNCE_PAD = "bouncePad",
  TELEPORTER = "teleporter",
  POWERUP = "powerup",
  HAZARD = "hazard",
  COLLAPSING_PLATFORM = "collapsingPlatform",
}

/**
 * Trigger data stored on colliders
 */
export interface TriggerData {
  type: TriggerType;
  id: string;
  callback?: () => void;
  onExit?: () => void; // Called when player exits the trigger area
}

/**
 * Collision event handler
 * Processes Rapier collision events and dispatches game events
 */
export class CollisionHandler {
  private physics: Physics;
  private playerColliderHandle: number = -1;

  // Map collider handles to trigger data
  private triggers: Map<number, TriggerData> = new Map();

  // Track collected gems to prevent double collection
  private collectedGems: Set<string> = new Set();

  // Track active checkpoint
  private activeCheckpointId: string | null = null;

  constructor(physics: Physics) {
    this.physics = physics;
  }

  /**
   * Set the player's collider handle
   */
  setPlayerCollider(handle: number): void {
    this.playerColliderHandle = handle;
  }

  /**
   * Register a trigger collider
   */
  registerTrigger(colliderHandle: number, data: TriggerData): void {
    this.triggers.set(colliderHandle, data);
  }

  /**
   * Unregister a trigger collider
   */
  unregisterTrigger(colliderHandle: number): void {
    this.triggers.delete(colliderHandle);
  }

  /**
   * Process collision events - call once per frame after physics step
   * Powerups are processed before hazards to ensure shield protects on same-frame pickup
   */
  processEvents(): void {
    // Collect all pending triggers first, then process in priority order
    const pendingTriggers: { data: TriggerData; handle: number }[] = [];
    const exitTriggers: TriggerData[] = [];

    this.physics.processEvents((handle1, handle2, started) => {
      // Check if player is involved
      const isPlayerHandle1 = handle1 === this.playerColliderHandle;
      const isPlayerHandle2 = handle2 === this.playerColliderHandle;

      if (!isPlayerHandle1 && !isPlayerHandle2) return;

      // Get the other collider handle
      const otherHandle = isPlayerHandle1 ? handle2 : handle1;
      const triggerData = this.triggers.get(otherHandle);

      if (!triggerData) return;

      if (started) {
        pendingTriggers.push({ data: triggerData, handle: otherHandle });
      } else if (triggerData.onExit) {
        // Handle collision exit for triggers that care about it
        exitTriggers.push(triggerData);
      }
    });

    // Sort: powerups first, then everything else (hazards last)
    // This ensures shield pickup protects against same-frame hazard collision
    pendingTriggers.sort((a, b) => {
      const priority = (type: TriggerType) => {
        if (type === TriggerType.POWERUP) return 0;
        if (type === TriggerType.HAZARD) return 2;
        return 1;
      };
      return priority(a.data.type) - priority(b.data.type);
    });

    // Process entry triggers in priority order
    for (const trigger of pendingTriggers) {
      this.handleTrigger(trigger.data, trigger.handle);
    }

    // Process exit triggers
    for (const trigger of exitTriggers) {
      trigger.onExit?.();
    }
  }

  private handleTrigger(data: TriggerData, colliderHandle: number): void {
    switch (data.type) {
      case TriggerType.GEM:
        this.handleGemCollision(data, colliderHandle);
        break;
      case TriggerType.CHECKPOINT:
        this.handleCheckpointCollision(data);
        break;
      case TriggerType.GOAL:
        this.handleGoalCollision(data);
        break;
      case TriggerType.BOUNCE_PAD:
      case TriggerType.TELEPORTER:
      case TriggerType.POWERUP:
      case TriggerType.HAZARD:
      case TriggerType.COLLAPSING_PLATFORM:
        // These triggers handle their own logic via callback
        data.callback?.();
        break;
    }
  }

  private handleGemCollision(data: TriggerData, colliderHandle: number): void {
    // Prevent double collection
    if (this.collectedGems.has(data.id)) return;

    this.collectedGems.add(data.id);

    // Call gem's collection callback - it handles the GEM_COLLECTED event emission
    data.callback?.();
  }

  private handleCheckpointCollision(data: TriggerData): void {
    // Only activate if not already active
    if (this.activeCheckpointId === data.id) return;

    this.activeCheckpointId = data.id;

    // Call checkpoint callback if provided
    data.callback?.();

    // Event is emitted by PlayerController.setCheckpoint
  }

  private handleGoalCollision(data: TriggerData): void {
    // Call goal callback if provided
    data.callback?.();

    // Emit event
    eventBus.emit(GameEvents.GOAL_REACHED, { id: data.id });
  }

  /**
   * Reset collision state for new level (clears everything including triggers)
   */
  reset(): void {
    this.collectedGems.clear();
    this.activeCheckpointId = null;
    this.triggers.clear();
  }

  /**
   * Reset just the collectible state (for replay testing)
   * Keeps triggers registered so gems/goals still work
   */
  resetState(): void {
    this.collectedGems.clear();
    this.activeCheckpointId = null;
  }

  /**
   * Get number of gems collected
   */
  getCollectedGemCount(): number {
    return this.collectedGems.size;
  }

  /**
   * Check if a gem was collected
   */
  isGemCollected(id: string): boolean {
    return this.collectedGems.has(id);
  }

  /**
   * Get active checkpoint ID
   */
  getActiveCheckpointId(): string | null {
    return this.activeCheckpointId;
  }
}
