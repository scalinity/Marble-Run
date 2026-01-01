/**
 * Registry to track moving platform velocities
 * Used by PlayerController to move with platforms
 */
class PlatformVelocityRegistryClass {
  private velocities: Map<number, { x: number; y: number; z: number }> = new Map();

  /**
   * Register/update a platform's velocity by collider handle
   */
  set(colliderHandle: number, velocity: { x: number; y: number; z: number }): void {
    this.velocities.set(colliderHandle, velocity);
  }

  /**
   * Get a platform's velocity by collider handle
   */
  get(colliderHandle: number): { x: number; y: number; z: number } | undefined {
    return this.velocities.get(colliderHandle);
  }

  /**
   * Remove a platform from registry
   */
  remove(colliderHandle: number): void {
    this.velocities.delete(colliderHandle);
  }

  /**
   * Clear all registered platforms
   */
  clear(): void {
    this.velocities.clear();
  }
}

export const platformVelocityRegistry = new PlatformVelocityRegistryClass();
