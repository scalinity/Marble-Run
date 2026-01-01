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
import { createBouncePad } from './static/BouncePad';
import { createIceSurface } from './static/IceSurface';
import { createMovingPlatform } from './kinematic/MovingPlatform';
import { createSpinnerHazard } from './kinematic/SpinnerHazard';
import { createConveyorBelt } from './kinematic/ConveyorBelt';
import { createCollapsingPlatform } from './kinematic/CollapsingPlatform';
import { createRotatingPlatform } from './kinematic/RotatingPlatform';
import { createGem } from './triggers/Gem';
import { createGoalGate } from './triggers/GoalGate';
import { createCheckpoint } from './triggers/Checkpoint';
import { createTeleporter } from './triggers/Teleporter';
import { createSpeedBoost } from './triggers/SpeedBoost';
import { createDoubleJump } from './triggers/DoubleJump';
import { createShield } from './triggers/Shield';

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
    this.register('bouncePad', { create: createBouncePad });
    this.register('iceSurface', { create: createIceSurface });

    // Kinematic pieces
    this.register('movingPlatform', { create: createMovingPlatform });
    this.register('spinnerHazard', { create: createSpinnerHazard });
    this.register('conveyorBelt', { create: createConveyorBelt });
    this.register('collapsingPlatform', { create: createCollapsingPlatform });
    this.register('rotatingPlatform', { create: createRotatingPlatform });

    // Trigger pieces
    this.register('gem', { create: createGem });
    this.register('goalGate', { create: createGoalGate });
    this.register('checkpoint', { create: createCheckpoint });
    this.register('teleporter', { create: createTeleporter });
    this.register('speedBoost', { create: createSpeedBoost });
    this.register('doubleJump', { create: createDoubleJump });
    this.register('shield', { create: createShield });
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
