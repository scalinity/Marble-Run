import * as THREE from "three";
import { COLORS } from "../config/constants";

/**
 * Trail system - exact copy from reference game
 * Simple line trail with additive blending
 */
export class Trail {
  private scene: THREE.Scene;
  private points: THREE.Vector3[] = [];
  private line: THREE.Line;
  private maxPoints: number;
  private material: THREE.LineBasicMaterial;

  // Trail update timing
  private trailTimer = 0;
  private readonly trailInterval = 0.02; // Add point every 20ms
  private readonly minVelocity = 2; // Only trail when moving

  constructor(scene: THREE.Scene, maxPoints: number = 60) {
    this.scene = scene;
    this.maxPoints = maxPoints;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Line material - brighter than reference for better visibility
    this.material = new THREE.LineBasicMaterial({
      color: COLORS.TRAIL,
      transparent: true,
      opacity: 0.9, // Increased from 0.6 for visibility
      blending: THREE.AdditiveBlending,
      linewidth: 2, // Note: only works on some WebGL implementations
    });

    this.line = new THREE.Line(geometry, this.material);
    this.line.frustumCulled = false; // Prevent culling issues with dynamic geometry
    this.scene.add(this.line);
  }

  /**
   * Update trail - matches reference game.ts trail logic
   */
  update(position: THREE.Vector3, velocity: THREE.Vector3, dt: number): void {
    const speed = velocity.length();

    // Only add trail points when moving (reference: velocity > 2)
    if (speed < this.minVelocity) {
      return;
    }

    this.trailTimer += dt;

    // Add point every 20ms like reference
    if (this.trailTimer > this.trailInterval) {
      this.trailTimer = 0;
      // Offset slightly below marble center like reference
      this.addPoint(position.clone().sub(new THREE.Vector3(0, 0.2, 0)));
    }
  }

  private addPoint(position: THREE.Vector3): void {
    this.points.push(position.clone());

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    this.updateGeometry();
  }

  private updateGeometry(): void {
    const positions = this.line.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < this.maxPoints; i++) {
      if (i < this.points.length) {
        positions[i * 3] = this.points[i].x;
        positions[i * 3 + 1] = this.points[i].y;
        positions[i * 3 + 2] = this.points[i].z;
      } else {
        // Move unused points far away (reference technique)
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -1000;
        positions[i * 3 + 2] = 0;
      }
    }

    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.points.length);
    // Recompute bounding sphere to prevent frustum culling issues
    this.line.geometry.computeBoundingSphere();
  }

  /**
   * Clear the trail
   */
  clear(): void {
    this.points = [];
    this.trailTimer = 0;
    this.updateGeometry();
  }

  /**
   * Set trail color
   */
  setColor(color: number): void {
    this.material.color.setHex(color);
  }

  dispose(): void {
    this.scene.remove(this.line);
    this.line.geometry.dispose();
    this.material.dispose();
  }
}
