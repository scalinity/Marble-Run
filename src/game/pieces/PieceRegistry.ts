import {
  PieceType,
  PieceData,
  PieceFactory,
  PieceContext,
  PieceInstance,
} from './types';

// Import piece factories
import { createTrackStraight } from './static/TrackStraight';
import { createTrackTurn } from './static/TrackTurn';
import { createRamp } from './static/Ramp';
import { createPlatform } from './static/Platform';
import { createWall } from './static/Wall';
import { createNarrowBridge } from './static/NarrowBridge';
import { createMovingPlatform } from './kinematic/MovingPlatform';
import { createSpinnerHazard } from './kinematic/SpinnerHazard';
import { createGem } from './triggers/Gem';
import { createGoalGate } from './triggers/GoalGate';
import { createCheckpoint } from './triggers/Checkpoint';

/**
 * Registry of piece factories
 */
class PieceRegistryClass {
  private factories: Map<PieceType, PieceFactory> = new Map();

  constructor() {
    // Register all built-in piece types
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Static pieces
    this.register('trackStraight', { create: createTrackStraight });
    this.register('trackTurn', { create: createTrackTurn });
    this.register('ramp', { create: createRamp });
    this.register('platform', { create: createPlatform });
    this.register('wall', { create: createWall });
    this.register('narrowBridge', { create: createNarrowBridge });

    // Kinematic pieces
    this.register('movingPlatform', { create: createMovingPlatform });
    this.register('spinnerHazard', { create: createSpinnerHazard });

    // Trigger pieces
    this.register('gem', { create: createGem });
    this.register('goalGate', { create: createGoalGate });
    this.register('checkpoint', { create: createCheckpoint });
  }

  /**
   * Register a piece factory
   */
  register(type: PieceType, factory: PieceFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Create a piece instance
   */
  create(data: PieceData, context: PieceContext): PieceInstance | null {
    const factory = this.factories.get(data.type);

    if (!factory) {
      console.warn(`Unknown piece type: ${data.type}`);
      return null;
    }

    try {
      return factory.create(data, context);
    } catch (error) {
      console.error(`Error creating piece ${data.id}:`, error);
      return null;
    }
  }

  /**
   * Check if a piece type is registered
   */
  has(type: PieceType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered piece types
   */
  getTypes(): PieceType[] {
    return Array.from(this.factories.keys());
  }
}

// Singleton instance
export const pieceRegistry = new PieceRegistryClass();
