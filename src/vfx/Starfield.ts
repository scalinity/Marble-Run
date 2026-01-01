import * as THREE from "three";
import { VFX } from "../config/constants";

/**
 * Starfield background - creates an immersive space backdrop
 * Follows camera to maintain the illusion of infinite space
 */
export class Starfield {
  private scene: THREE.Scene;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  constructor(scene: THREE.Scene, count: number = VFX.STARFIELD_COUNT) {
    this.scene = scene;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Distribute stars in a spherical shell around origin
    for (let i = 0; i < count; i++) {
      // Random position on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius =
        VFX.STARFIELD_MIN_RADIUS +
        Math.random() * (VFX.STARFIELD_MAX_RADIUS - VFX.STARFIELD_MIN_RADIUS);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Slightly cyan-tinted white stars with variation
      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = brightness * 0.9; // R - slightly less red
      colors[i * 3 + 1] = brightness; // G
      colors[i * 3 + 2] = Math.min(1.0, brightness * 1.1); // B - cap at 1.0
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // Always render
    this.points.renderOrder = -1000; // Render behind everything

    this.scene.add(this.points);
  }

  /**
   * Update starfield position to follow camera
   * This maintains the illusion of infinite space
   */
  update(cameraPosition: THREE.Vector3): void {
    this.points.position.copy(cameraPosition);
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
