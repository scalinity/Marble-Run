import { eventBus, GameEvents } from '../utils/EventBus';
import { POWERUPS } from '../config/constants';

export type PowerUpType = 'speedBoost' | 'doubleJump' | 'shield';

interface ActivePowerUp {
  type: PowerUpType;
  endTime: number;
  duration: number;
}

/**
 * Manages active power-ups and their durations
 */
export class PowerUpManager {
  private activePowerUps: Map<PowerUpType, ActivePowerUp> = new Map();
  private currentTime = 0;

  // Shield state
  private shieldHits = 0;

  // Double jump state
  private hasUsedDoubleJump = false;

  /**
   * Update all active power-ups
   */
  update(dt: number): void {
    this.currentTime += dt;

    // Check for expired power-ups
    const expired: PowerUpType[] = [];

    this.activePowerUps.forEach((powerUp, type) => {
      if (this.currentTime >= powerUp.endTime) {
        expired.push(type);
      }
    });

    // Remove expired power-ups and emit events
    expired.forEach((type) => {
      this.activePowerUps.delete(type);
      eventBus.emit(GameEvents.POWERUP_EXPIRED, { type });

      // Reset double jump state when it expires
      if (type === 'doubleJump') {
        this.hasUsedDoubleJump = false;
      }
    });
  }

  /**
   * Activate a power-up
   */
  activate(type: PowerUpType, duration?: number): void {
    const actualDuration = duration ?? this.getDefaultDuration(type);

    const powerUp: ActivePowerUp = {
      type,
      duration: actualDuration,
      endTime: this.currentTime + actualDuration,
    };

    // If already active, extend the duration
    const existing = this.activePowerUps.get(type);
    if (existing) {
      powerUp.endTime = Math.max(existing.endTime, powerUp.endTime);
    }

    this.activePowerUps.set(type, powerUp);

    // Reset states for specific power-ups
    if (type === 'shield') {
      this.shieldHits = 1; // Shield can absorb one hit
    }
    if (type === 'doubleJump') {
      this.hasUsedDoubleJump = false;
    }

    eventBus.emit(GameEvents.POWERUP_COLLECTED, { type, duration: actualDuration });
  }

  /**
   * Check if a power-up is active
   */
  has(type: PowerUpType): boolean {
    return this.activePowerUps.has(type);
  }

  /**
   * Get remaining time for a power-up
   */
  getRemainingTime(type: PowerUpType): number {
    const powerUp = this.activePowerUps.get(type);
    if (!powerUp) return 0;
    return Math.max(0, powerUp.endTime - this.currentTime);
  }

  /**
   * Get progress (0-1) of power-up duration
   */
  getProgress(type: PowerUpType): number {
    const powerUp = this.activePowerUps.get(type);
    if (!powerUp) return 0;
    const remaining = powerUp.endTime - this.currentTime;
    return Math.max(0, Math.min(1, remaining / powerUp.duration));
  }

  /**
   * Get speed multiplier (for SpeedBoost)
   */
  getSpeedMultiplier(): number {
    return this.has('speedBoost') ? POWERUPS.SPEED_BOOST_MULTIPLIER : 1.0;
  }

  /**
   * Check if double jump is available
   */
  canDoubleJump(): boolean {
    return this.has('doubleJump') && !this.hasUsedDoubleJump;
  }

  /**
   * Use the double jump
   */
  useDoubleJump(): boolean {
    if (this.canDoubleJump()) {
      this.hasUsedDoubleJump = true;
      return true;
    }
    return false;
  }

  /**
   * Reset double jump (called when landing)
   */
  resetDoubleJump(): void {
    if (this.has('doubleJump')) {
      this.hasUsedDoubleJump = false;
    }
  }

  /**
   * Check if shield is active and can absorb a hit
   */
  hasShield(): boolean {
    return this.has('shield') && this.shieldHits > 0;
  }

  /**
   * Use shield to absorb a hit
   * Returns true if shield absorbed the hit
   */
  useShield(): boolean {
    if (this.hasShield()) {
      this.shieldHits--;
      if (this.shieldHits <= 0) {
        // Shield is depleted - remove it
        this.activePowerUps.delete('shield');
        eventBus.emit(GameEvents.POWERUP_EXPIRED, { type: 'shield' });
      }
      return true;
    }
    return false;
  }

  /**
   * Get all active power-ups
   */
  getActivePowerUps(): PowerUpType[] {
    return Array.from(this.activePowerUps.keys());
  }

  /**
   * Clear all power-ups (on death/respawn)
   */
  clear(): void {
    this.activePowerUps.forEach((_, type) => {
      eventBus.emit(GameEvents.POWERUP_EXPIRED, { type });
    });
    this.activePowerUps.clear();
    this.hasUsedDoubleJump = false;
    this.shieldHits = 0;
  }

  /**
   * Reset manager state (on level load)
   */
  reset(): void {
    this.clear();
    this.currentTime = 0;
  }

  /**
   * Get default duration for a power-up type
   */
  private getDefaultDuration(type: PowerUpType): number {
    switch (type) {
      case 'speedBoost':
        return POWERUPS.SPEED_BOOST_DURATION;
      case 'doubleJump':
        return POWERUPS.DOUBLE_JUMP_DURATION;
      case 'shield':
        return POWERUPS.SHIELD_DURATION;
      default:
        return 5;
    }
  }
}
