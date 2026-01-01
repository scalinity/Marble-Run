import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../engine/Physics';
import { InputState } from '../engine/Input';
import { PHYSICS, COLORS, MATERIALS } from '../config/constants';
import { eventBus, GameEvents } from '../utils/EventBus';

/**
 * Player marble controller with physics-based movement
 * Implements camera-relative controls, ground detection, and jump mechanics
 */
export class PlayerController {
  // Physics
  private physics: Physics;
  private rigidBody!: RAPIER.RigidBody;
  private collider!: RAPIER.Collider;

  // Rendering
  private mesh!: THREE.Mesh;
  private scene: THREE.Scene;

  // Ground detection
  private isGrounded = false;
  private groundNormal = new THREE.Vector3(0, 1, 0);
  private timeSinceGrounded = 0;

  // Jump state
  private jumpBufferTimer = 0;
  private hasJumped = false;
  private jumpQueued = false;

  // Respawn cooldown (skip physics for a few frames after respawn)
  private respawnCooldown = 0;

  // Checkpoint
  private checkpointPosition = new THREE.Vector3(0, 2, 0);
  private spawnPosition = new THREE.Vector3(0, 2, 0);

  // Camera reference for relative movement
  private camera: THREE.Camera;

  // Temp vectors (avoid allocation)
  private readonly tempVec3 = new THREE.Vector3();
  private readonly cameraForward = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly moveDirection = new THREE.Vector3();

  constructor(
    physics: Physics,
    scene: THREE.Scene,
    camera: THREE.Camera,
    spawnPosition: THREE.Vector3
  ) {
    this.physics = physics;
    this.scene = scene;
    this.camera = camera;
    this.spawnPosition.copy(spawnPosition);
    this.checkpointPosition.copy(spawnPosition);

    this.createPhysicsBody();
    this.createVisualMesh();
  }

  private createPhysicsBody(): void {
    // Create dynamic rigid body
    this.rigidBody = this.physics.createDynamicBody(
      {
        x: this.spawnPosition.x,
        y: this.spawnPosition.y,
        z: this.spawnPosition.z,
      },
      {
        linearDamping: PHYSICS.LINEAR_DAMPING,
        angularDamping: PHYSICS.ANGULAR_DAMPING,
        gravityScale: PHYSICS.GRAVITY_SCALE,
        ccdEnabled: true,
      }
    );

    // Create sphere collider
    this.collider = this.physics.createSphereCollider(
      this.rigidBody,
      PHYSICS.MARBLE_RADIUS,
      {
        friction: PHYSICS.MARBLE_FRICTION,
        restitution: PHYSICS.MARBLE_RESTITUTION,
        density: PHYSICS.MARBLE_DENSITY,
      }
    );
  }

  private createVisualMesh(): void {
    const geometry = new THREE.SphereGeometry(PHYSICS.MARBLE_RADIUS, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.MARBLE,
      metalness: MATERIALS.MARBLE_METALNESS,
      roughness: MATERIALS.MARBLE_ROUGHNESS,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  /**
   * Update player - call once per physics step
   */
  update(dt: number, input: InputState): void {
    // Check for respawn input
    if (input.reset) {
      this.respawn();
      return;
    }

    // Check for fall off map
    const pos = this.rigidBody.translation();
    if (pos.y < PHYSICS.FALL_THRESHOLD) {
      this.respawn();
      return;
    }

    // Handle respawn cooldown - skip physics forces to ensure velocity reset takes effect
    if (this.respawnCooldown > 0) {
      this.respawnCooldown--;
      // Force velocity to zero again (in case physics accumulated forces)
      this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.syncMeshToBody();
      return;
    }

    // Ground detection
    this.updateGroundDetection();

    // Update jump timers
    this.updateJumpTimers(dt, input);

    // Handle jump
    this.handleJump(input);

    // Apply movement forces
    this.applyMovement(dt, input);

    // Clamp horizontal speed
    this.clampHorizontalSpeed();

    // Sync visual mesh to physics body
    this.syncMeshToBody();
  }

  private updateGroundDetection(): void {
    const position = this.rigidBody.translation();
    const maxToi = PHYSICS.MARBLE_RADIUS + PHYSICS.GROUND_CHECK_DISTANCE;

    // Cast ray downward from marble center
    const hit = this.physics.castRayAndGetNormal(
      { x: position.x, y: position.y, z: position.z },
      { x: 0, y: -1, z: 0 },
      maxToi,
      this.collider
    );

    const wasGrounded = this.isGrounded;

    if (hit) {
      // Get surface normal
      this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);

      // Check slope angle
      const slopeAngle =
        Math.acos(Math.min(1, Math.max(-1, this.groundNormal.y))) *
        (180 / Math.PI);
      this.isGrounded = slopeAngle <= PHYSICS.MAX_SLOPE_ANGLE;
    } else {
      this.isGrounded = false;
    }

    // Handle landing
    if (this.isGrounded) {
      this.timeSinceGrounded = 0;

      if (!wasGrounded) {
        this.hasJumped = false;
        eventBus.emit(GameEvents.PLAYER_LAND);

        // Execute buffered jump
        if (this.jumpQueued) {
          this.executeJump();
          this.jumpQueued = false;
        }
      }
    }
  }

  private updateJumpTimers(dt: number, input: InputState): void {
    // Update coyote time
    if (!this.isGrounded) {
      this.timeSinceGrounded += dt;
    }

    // Update jump buffer
    if (input.jump) {
      this.jumpBufferTimer = 0;
      this.jumpQueued = true;
    } else {
      this.jumpBufferTimer += dt;
      if (this.jumpBufferTimer > PHYSICS.JUMP_BUFFER_TIME) {
        this.jumpQueued = false;
      }
    }
  }

  private handleJump(input: InputState): void {
    const canCoyoteJump = this.timeSinceGrounded <= PHYSICS.COYOTE_TIME;
    const canJump = (this.isGrounded || canCoyoteJump) && !this.hasJumped;

    if (canJump && (input.jump || this.jumpQueued)) {
      this.executeJump();
      this.jumpQueued = false;
    }
  }

  private executeJump(): void {
    // Cancel downward velocity first
    const vel = this.rigidBody.linvel();
    if (vel.y < 0) {
      this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
    }

    // Apply jump impulse
    this.rigidBody.applyImpulse({ x: 0, y: PHYSICS.JUMP_IMPULSE, z: 0 }, true);

    this.hasJumped = true;
    this.timeSinceGrounded = PHYSICS.COYOTE_TIME + 1;

    eventBus.emit(GameEvents.PLAYER_JUMP);
  }

  private applyMovement(dt: number, input: InputState): void {
    // Get camera-relative directions
    this.getCameraRelativeDirections();

    // Calculate desired movement direction
    this.moveDirection.set(0, 0, 0);

    // Forward/backward (W/S maps to camera forward)
    if (input.moveZ !== 0) {
      this.moveDirection.addScaledVector(this.cameraForward, -input.moveZ);
    }

    // Left/right (A/D maps to camera right)
    if (input.moveX !== 0) {
      this.moveDirection.addScaledVector(this.cameraRight, input.moveX);
    }

    // Normalize to prevent diagonal speed boost
    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
    } else {
      return; // No input, let damping handle deceleration
    }

    // Select acceleration based on ground state
    const acceleration = this.isGrounded
      ? PHYSICS.GROUND_ACCELERATION
      : PHYSICS.AIR_ACCELERATION;

    // Calculate force magnitude (F = m * a)
    const mass = this.rigidBody.mass();
    const forceMagnitude = acceleration * mass;

    // Apply force in XZ plane only
    this.rigidBody.addForce(
      {
        x: this.moveDirection.x * forceMagnitude,
        y: 0,
        z: this.moveDirection.z * forceMagnitude,
      },
      true
    );
  }

  private getCameraRelativeDirections(): void {
    // Get camera's forward direction projected onto XZ plane
    this.camera.getWorldDirection(this.cameraForward);
    this.cameraForward.y = 0;
    this.cameraForward.normalize();

    // Get camera's right direction
    this.cameraRight.crossVectors(
      this.cameraForward,
      new THREE.Vector3(0, 1, 0)
    );
    this.cameraRight.normalize();
  }

  private clampHorizontalSpeed(): void {
    const vel = this.rigidBody.linvel();
    const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    if (horizontalSpeed > PHYSICS.MAX_SPEED) {
      const scale = PHYSICS.MAX_SPEED / horizontalSpeed;
      this.rigidBody.setLinvel(
        { x: vel.x * scale, y: vel.y, z: vel.z * scale },
        true
      );
    }
  }

  private syncMeshToBody(): void {
    const position = this.rigidBody.translation();
    const rotation = this.rigidBody.rotation();

    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  /**
   * Respawn at last checkpoint
   */
  respawn(): void {
    this.rigidBody.setTranslation(
      {
        x: this.checkpointPosition.x,
        y: this.checkpointPosition.y,
        z: this.checkpointPosition.z,
      },
      true
    );
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.wakeUp();

    this.hasJumped = false;
    this.jumpQueued = false;
    this.timeSinceGrounded = 0;
    this.isGrounded = false;

    // Skip physics forces for a few frames to ensure velocity reset takes effect
    this.respawnCooldown = 3;

    eventBus.emit(GameEvents.PLAYER_RESPAWN);
  }

  /**
   * Set checkpoint position
   */
  setCheckpoint(position: THREE.Vector3): void {
    this.checkpointPosition.copy(position);
    eventBus.emit(GameEvents.CHECKPOINT_ACTIVATED, { position });
  }

  /**
   * Get current position
   */
  getPosition(): THREE.Vector3 {
    const pos = this.rigidBody.translation();
    return this.tempVec3.set(pos.x, pos.y, pos.z);
  }

  /**
   * Get current velocity
   */
  getVelocity(): THREE.Vector3 {
    const vel = this.rigidBody.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }

  /**
   * Get collider handle for collision detection
   */
  getColliderHandle(): number {
    return this.collider.handle;
  }

  /**
   * Check if grounded
   */
  isOnGround(): boolean {
    return this.isGrounded;
  }

  /**
   * Get the visual mesh
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  dispose(): void {
    this.physics.removeBody(this.rigidBody);
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
