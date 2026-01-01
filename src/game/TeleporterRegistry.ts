import * as THREE from 'three';

interface TeleporterData {
  position: THREE.Vector3;
  linkedId: string;
}

/**
 * Registry for teleporter positions and links
 * Allows teleporters to find their linked pair
 */
class TeleporterRegistryClass {
  private teleporters: Map<string, TeleporterData> = new Map();

  /**
   * Register a teleporter
   */
  register(id: string, position: THREE.Vector3, linkedId: string): void {
    this.teleporters.set(id, {
      position: position.clone(),
      linkedId,
    });
  }

  /**
   * Get a teleporter's data
   */
  get(id: string): TeleporterData | undefined {
    return this.teleporters.get(id);
  }

  /**
   * Get the destination position for a teleporter
   * Returns the position of the linked teleporter
   */
  getDestination(id: string): THREE.Vector3 | null {
    const teleporter = this.teleporters.get(id);
    if (!teleporter) return null;

    const linkedTeleporter = this.teleporters.get(teleporter.linkedId);
    if (!linkedTeleporter) {
      console.warn(`Teleporter ${id} linked to unknown teleporter ${teleporter.linkedId}`);
      return null;
    }

    return linkedTeleporter.position.clone();
  }

  /**
   * Unregister a teleporter
   */
  unregister(id: string): void {
    this.teleporters.delete(id);
  }

  /**
   * Clear all teleporters (on level unload)
   */
  clear(): void {
    this.teleporters.clear();
  }

  /**
   * Check if a teleporter exists
   */
  has(id: string): boolean {
    return this.teleporters.has(id);
  }
}

// Singleton instance
export const teleporterRegistry = new TeleporterRegistryClass();
