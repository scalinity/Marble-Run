import * as THREE from 'three';
import { VFX, COLORS } from '../config/constants';

interface TrailPoint {
  position: THREE.Vector3;
  timestamp: number;
}

/**
 * Marble trail using ribbon geometry with vertex colors for alpha fade
 */
export class Trail {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;

  // Position history
  private points: TrailPoint[] = [];
  private maxPoints: number;

  // Buffers
  private positionBuffer: Float32Array;
  private colorBuffer: Float32Array;
  private indexBuffer: Uint16Array;

  // Configuration
  private widthStart: number;
  private widthEnd: number;
  private duration: number;
  private minVelocity: number;
  private sampleDistance: number;

  // Temp vectors
  private readonly tempVec3 = new THREE.Vector3();
  private readonly prevDirection = new THREE.Vector3();
  private readonly perpendicular = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.maxPoints = VFX.TRAIL_MAX_SEGMENTS;
    this.widthStart = VFX.TRAIL_WIDTH_START;
    this.widthEnd = VFX.TRAIL_WIDTH_END;
    this.duration = VFX.TRAIL_DURATION;
    this.minVelocity = VFX.TRAIL_MIN_VELOCITY;
    this.sampleDistance = VFX.TRAIL_SAMPLE_DISTANCE;

    // Pre-allocate buffers
    // Each point creates 2 vertices (left and right of trail center)
    const vertexCount = this.maxPoints * 2;
    this.positionBuffer = new Float32Array(vertexCount * 3);
    this.colorBuffer = new Float32Array(vertexCount * 4);

    // Create indices for triangle strip
    // Each segment (between two points) = 2 triangles = 6 indices
    const indexCount = (this.maxPoints - 1) * 6;
    this.indexBuffer = new Uint16Array(indexCount);
    this.createIndices();

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positionBuffer, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colorBuffer, 4).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    this.geometry.setIndex(new THREE.BufferAttribute(this.indexBuffer, 1));

    // Create material
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.scene.add(this.mesh);

    // Start with no visible geometry
    this.geometry.setDrawRange(0, 0);
  }

  private createIndices(): void {
    let idx = 0;
    for (let i = 0; i < this.maxPoints - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      // Triangle 1: v0, v1, v2
      this.indexBuffer[idx++] = v0;
      this.indexBuffer[idx++] = v1;
      this.indexBuffer[idx++] = v2;

      // Triangle 2: v1, v3, v2
      this.indexBuffer[idx++] = v1;
      this.indexBuffer[idx++] = v3;
      this.indexBuffer[idx++] = v2;
    }
  }

  /**
   * Update trail - call every frame
   */
  update(position: THREE.Vector3, velocity: THREE.Vector3, dt: number): void {
    const now = performance.now();
    const speed = velocity.length();

    // Skip updates when nearly stationary
    if (speed < this.minVelocity) {
      this.fadeOut(dt);
      return;
    }

    // Add new point if moved enough
    const lastPoint = this.points[this.points.length - 1];
    if (
      !lastPoint ||
      position.distanceTo(lastPoint.position) > this.sampleDistance
    ) {
      this.addPoint(position.clone(), now);
    }

    // Remove old points
    this.cullOldPoints(now);

    // Rebuild geometry
    this.rebuildGeometry();
  }

  private addPoint(position: THREE.Vector3, timestamp: number): void {
    this.points.push({ position, timestamp });

    // Limit points
    while (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  private cullOldPoints(now: number): void {
    const maxAge = this.duration * 1000;
    while (this.points.length > 0 && now - this.points[0].timestamp > maxAge) {
      this.points.shift();
    }
  }

  private fadeOut(dt: number): void {
    // Gradually remove points when stationary
    if (this.points.length > 0) {
      const now = performance.now();
      this.cullOldPoints(now);
      this.rebuildGeometry();
    }
  }

  private rebuildGeometry(): void {
    if (this.points.length < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;

    const color = new THREE.Color(COLORS.TRAIL);

    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const t = i / (this.points.length - 1); // 0 = oldest, 1 = newest

      // Calculate direction to next/previous point
      let direction: THREE.Vector3;
      if (i < this.points.length - 1) {
        direction = this.tempVec3
          .copy(this.points[i + 1].position)
          .sub(point.position)
          .normalize();
      } else {
        direction = this.prevDirection.clone();
      }
      this.prevDirection.copy(direction);

      // Calculate perpendicular vector for ribbon width
      const up = new THREE.Vector3(0, 1, 0);
      this.perpendicular.crossVectors(direction, up).normalize();

      // If perpendicular is zero (moving straight up/down), use alternative
      if (this.perpendicular.lengthSq() < 0.001) {
        this.perpendicular.set(1, 0, 0);
      }

      // Tapered width
      const width = this.widthEnd + (this.widthStart - this.widthEnd) * t;

      // Calculate two vertices (left and right of center)
      const idx = i * 2;
      const v0 = new THREE.Vector3()
        .copy(point.position)
        .addScaledVector(this.perpendicular, width);
      const v1 = new THREE.Vector3()
        .copy(point.position)
        .addScaledVector(this.perpendicular, -width);

      // Set positions
      positions[idx * 3] = v0.x;
      positions[idx * 3 + 1] = v0.y;
      positions[idx * 3 + 2] = v0.z;
      positions[(idx + 1) * 3] = v1.x;
      positions[(idx + 1) * 3 + 1] = v1.y;
      positions[(idx + 1) * 3 + 2] = v1.z;

      // Set colors with alpha fade (oldest = transparent, newest = opaque)
      const alpha = t * 0.8;
      colors[idx * 4] = color.r;
      colors[idx * 4 + 1] = color.g;
      colors[idx * 4 + 2] = color.b;
      colors[idx * 4 + 3] = alpha;
      colors[(idx + 1) * 4] = color.r;
      colors[(idx + 1) * 4 + 1] = color.g;
      colors[(idx + 1) * 4 + 2] = color.b;
      colors[(idx + 1) * 4 + 3] = alpha;
    }

    // Update attribute flags
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Set draw range
    const triangleCount = (this.points.length - 1) * 2;
    this.geometry.setDrawRange(0, triangleCount * 3);
  }

  /**
   * Clear the trail
   */
  clear(): void {
    this.points = [];
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Set trail color
   */
  setColor(color: THREE.Color): void {
    // Color is applied per-vertex in rebuildGeometry
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
