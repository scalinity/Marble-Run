/**
 * Gameplay intensity calculator for adaptive music
 * Measures various gameplay factors to determine music intensity
 */

import * as THREE from "three";
import { eventBus, GameEvents } from "../../utils/EventBus";

export class IntensityCalculator {
  // Intensity factors (0-1)
  private speed: number = 0;
  private nearHazards: number = 0;
  private recentCollections: number = 0;
  private platformStability: number = 1; // 0 = unstable, 1 = stable

  // Decay rates
  private readonly COLLECTION_DECAY = 0.95; // Per frame
  private readonly STABILITY_RECOVERY = 0.5; // Per second

  // Event unsubscribe functions
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.unsubscribers.push(
      eventBus.on(GameEvents.GEM_COLLECTED, () => this.onCollection()),
      eventBus.on(GameEvents.BOUNCE_PAD_HIT, () => this.onCollection()),
      eventBus.on(GameEvents.PLATFORM_COLLAPSING, () =>
        this.onPlatformCollapse(),
      ),
      eventBus.on(GameEvents.HAZARD_HIT, () => this.onHazardHit()),
    );
  }

  /**
   * Update and calculate current intensity
   */
  update(
    playerVelocity: THREE.Vector3,
    hazardDistances: number[],
    dt: number,
  ): number {
    // Speed component (0-1)
    this.speed = Math.min(playerVelocity.length() / 8, 1);

    // Hazard proximity (0-1)
    const minHazardDist =
      hazardDistances.length > 0 ? Math.min(...hazardDistances) : Infinity;
    this.nearHazards = Math.max(0, 1 - minHazardDist / 10);

    // Decay recent collections
    this.recentCollections *= this.COLLECTION_DECAY;

    // Platform stability recovers over time
    this.platformStability = Math.min(
      1,
      this.platformStability + dt * this.STABILITY_RECOVERY,
    );

    // Calculate combined intensity
    const intensity = Math.min(
      1,
      this.speed * 0.3 +
        this.nearHazards * 0.3 +
        this.recentCollections * 0.2 +
        (1 - this.platformStability) * 0.2,
    );

    return intensity;
  }

  /**
   * Get current intensity without updating
   */
  getIntensity(): number {
    return Math.min(
      1,
      this.speed * 0.3 +
        this.nearHazards * 0.3 +
        this.recentCollections * 0.2 +
        (1 - this.platformStability) * 0.2,
    );
  }

  private onCollection(): void {
    this.recentCollections = Math.min(1, this.recentCollections + 0.3);
  }

  private onPlatformCollapse(): void {
    this.platformStability = 0;
  }

  private onHazardHit(): void {
    // Brief intensity spike on hazard hit
    this.recentCollections = Math.min(1, this.recentCollections + 0.5);
    this.platformStability = 0.5;
  }

  /**
   * Reset intensity (for level restart)
   */
  reset(): void {
    this.speed = 0;
    this.nearHazards = 0;
    this.recentCollections = 0;
    this.platformStability = 1;
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}
