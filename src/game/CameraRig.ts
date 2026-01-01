import * as THREE from "three";
import { Physics } from "../engine/Physics";
import { CAMERA, VFX } from "../config/constants";
import { smoothDampVec3 } from "../utils/math";

/**
 * Third-person follow camera with smooth following and collision avoidance
 */
export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private physics: Physics;

  // Target to follow
  private target: THREE.Vector3 = new THREE.Vector3();

  // Current camera state
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private desiredPosition: THREE.Vector3 = new THREE.Vector3();

  // Offset from target
  private offset: THREE.Vector3;
  private lookOffset: THREE.Vector3;

  // Collision
  private collisionDistance: number = CAMERA.MAX_DISTANCE;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Temp vectors
  private readonly tempVec3 = new THREE.Vector3();
  private readonly rayOrigin = new THREE.Vector3();
  private readonly rayDir = new THREE.Vector3();
  private readonly shakeOffset = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, physics: Physics) {
    this.camera = camera;
    this.physics = physics;

    this.offset = new THREE.Vector3(
      CAMERA.OFFSET.x,
      CAMERA.OFFSET.y,
      CAMERA.OFFSET.z,
    );

    this.lookOffset = new THREE.Vector3(0, CAMERA.LOOK_OFFSET_Y, 0);

    // Initialize camera position
    this.currentPosition.copy(this.offset);
    this.camera.position.copy(this.currentPosition);
  }

  /**
   * Update camera - call once per frame
   */
  update(targetPosition: THREE.Vector3, dt: number): void {
    this.target.copy(targetPosition);

    // Calculate desired camera position
    this.desiredPosition.copy(this.target).add(this.offset);

    // Check for collision and adjust distance
    this.checkCollision();

    // Apply collision-adjusted position
    const adjustedPosition = this.getAdjustedPosition();

    // Smooth follow
    smoothDampVec3(
      this.currentPosition,
      adjustedPosition,
      CAMERA.FOLLOW_SMOOTHNESS,
      dt,
      this.currentPosition,
    );

    // Apply to camera
    this.camera.position.copy(this.currentPosition);

    // Apply screen shake (using reusable vector to avoid GC)
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const t = Math.max(0, 1 - this.shakeTimer / this.shakeDuration);
      const intensity = this.shakeIntensity * t * t; // Quadratic ease-out
      this.shakeOffset.set(
        (Math.random() - 0.5) * 2 * intensity,
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * 2 * intensity,
      );
      this.camera.position.add(this.shakeOffset);
    }

    // Look at target (with offset)
    this.tempVec3.copy(this.target).add(this.lookOffset);
    this.camera.lookAt(this.tempVec3);
  }

  private checkCollision(): void {
    // Cast ray from target toward desired camera position
    this.rayOrigin.copy(this.target);
    this.rayDir.copy(this.desiredPosition).sub(this.target).normalize();

    const maxDistance = this.offset.length();

    const hit = this.physics.castRay(
      { x: this.rayOrigin.x, y: this.rayOrigin.y, z: this.rayOrigin.z },
      { x: this.rayDir.x, y: this.rayDir.y, z: this.rayDir.z },
      maxDistance,
    );

    if (hit) {
      const hitDistance = hit.timeOfImpact;
      if (hitDistance < maxDistance) {
        // Collision detected - clamp distance with small buffer
        this.collisionDistance = Math.max(
          CAMERA.MIN_DISTANCE,
          hitDistance - 0.3,
        );
      } else {
        this.collisionDistance = maxDistance;
      }
    } else {
      // No collision - use full offset distance
      this.collisionDistance = maxDistance;
    }
  }

  private getAdjustedPosition(): THREE.Vector3 {
    const direction = this.tempVec3
      .copy(this.desiredPosition)
      .sub(this.target)
      .normalize();

    return new THREE.Vector3()
      .copy(this.target)
      .addScaledVector(direction, this.collisionDistance);
  }

  /**
   * Trigger screen shake effect
   */
  shake(
    intensity: number = VFX.SCREEN_SHAKE_INTENSITY,
    duration: number = VFX.SCREEN_SHAKE_DURATION,
  ): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  /**
   * Set target position directly (for immediate updates)
   */
  setTarget(position: THREE.Vector3): void {
    this.target.copy(position);
  }

  /**
   * Snap camera to position (no smoothing)
   */
  snapToTarget(targetPosition: THREE.Vector3): void {
    this.target.copy(targetPosition);
    this.currentPosition.copy(targetPosition).add(this.offset);
    this.camera.position.copy(this.currentPosition);

    this.tempVec3.copy(this.target).add(this.lookOffset);
    this.camera.lookAt(this.tempVec3);
  }

  /**
   * Set custom offset
   */
  setOffset(offset: THREE.Vector3): void {
    this.offset.copy(offset);
  }

  /**
   * Get current camera position
   */
  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Get the camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
