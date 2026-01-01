import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../engine/Physics';
import { InputState } from '../engine/Input';
import { PHYSICS, COLORS, MATERIALS } from '../config/constants';
import { eventBus, GameEvents } from '../utils/EventBus';
import { platformVelocityRegistry } from './PlatformVelocityRegistry';
import { PowerUpManager } from './PowerUpManager';
import { teleporterRegistry } from './TeleporterRegistry';

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
  private groundColliderHandle: number | null = null;

  // Jump state
  private jumpBufferTimer = 0;
  private hasJumped = false;
  private jumpQueued = false;
  private hasUsedDoubleJump = false;

  // Respawn cooldown (skip physics for a few frames after respawn)
  private respawnCooldown = 0;

  // Power-ups
  private powerUpManager: PowerUpManager | null = null;

  // Teleport cooldown
  private teleportCooldown = 0;

  // Event unsubscribe functions to prevent memory leaks
  private unsubscribers: (() => void)[] = [];

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
    this.setupEventListeners();
  }

  /**
   * Set power-up manager reference
   */
  setPowerUpManager(manager: PowerUpManager): void {
    this.powerUpManager = manager;
  }

  /**
   * Setup event listeners for game events
   */
  private setupEventListeners(): void {
    // Store unsubscribe functions to prevent memory leaks
    this.unsubscribers.push(
      // Handle bounce pad hits
      eventBus.on(GameEvents.BOUNCE_PAD_HIT, (data: { force: number }) => {
        this.applyBounce(data.force);
      }),

      // Handle teleporter activation
      eventBus.on(GameEvents.TELEPORT, (data: { toPosition: THREE.Vector3 }) => {
        this.teleportTo(data.toPosition);
      })
    );
  }

  /**
   * Apply bounce force (from bounce pads)
   */
  private applyBounce(force: number): void {
    const vel = this.rigidBody.linvel();
    // Reset Y velocity and apply bounce
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
    this.rigidBody.applyImpulse({ x: 0, y: force, z: 0 }, true);
    this.hasJumped = false; // Allow jumping after bounce
    this.hasUsedDoubleJump = false;
  }

  /**
   * Teleport to position
   */
  private teleportTo(position: THREE.Vector3): void {
    if (this.teleportCooldown > 0) return;

    this.rigidBody.setTranslation(
      { x: position.x, y: position.y + 1.5, z: position.z },
      true
    );
    // Preserve horizontal velocity, reset vertical
    const vel = this.rigidBody.linvel();
    this.rigidBody.setLinvel({ x: vel.x * 0.5, y: 0, z: vel.z * 0.5 }, true);

    this.teleportCooldown = PHYSICS.TELEPORT_COOLDOWN;
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
    // Update teleport cooldown
    if (this.teleportCooldown > 0) {
      this.teleportCooldown -= dt;
    }

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
      // Keep body asleep and stationary during cooldown
      this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.resetForces(true);
      this.rigidBody.resetTorques(true);
      this.rigidBody.sleep();
      this.syncMeshToBody();

      // Wake up on last cooldown frame so player can move
      if (this.respawnCooldown === 0) {
        this.rigidBody.wakeUp();
      }
      return;
    }

    // Ground detection
    this.updateGroundDetection();

    // Update jump timers
    this.updateJumpTimers(dt, input);

    // Apply movement forces (before jump so platform velocity is applied)
    this.applyMovement(dt, input);

    // Handle jump (after movement so we inherit platform velocity)
    this.handleJump(input);

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

      // Store collider handle for platform velocity lookup
      this.groundColliderHandle = this.isGrounded ? hit.collider.handle : null;
    } else {
      this.isGrounded = false;
      this.groundColliderHandle = null;
    }

    // Handle grounded state
    if (this.isGrounded) {
      this.timeSinceGrounded = 0;

      if (!wasGrounded) {
        this.hasJumped = false;  // Only reset on LANDING, not every substep
        this.hasUsedDoubleJump = false; // Reset double jump on landing
        this.powerUpManager?.resetDoubleJump();
        eventBus.emit(GameEvents.PLAYER_LAND);

        // Execute buffered jump immediately on landing
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

    // Update jump buffer - keep alive while key is held
    if (input.jump) {
      // Fresh press - queue jump
      this.jumpQueued = true;
      this.jumpBufferTimer = 0;
    } else if (input.jumpHeld && this.jumpQueued) {
      // Still holding after press - keep buffer alive indefinitely
      this.jumpBufferTimer = 0;
    } else if (this.jumpQueued) {
      // Key released - start buffer countdown
      this.jumpBufferTimer += dt;
      if (this.jumpBufferTimer > PHYSICS.JUMP_BUFFER_TIME) {
        this.jumpQueued = false;
      }
    }
  }

  private handleJump(input: InputState): void {
    const canCoyoteJump = this.timeSinceGrounded <= PHYSICS.COYOTE_TIME;
    const canJump = (this.isGrounded || canCoyoteJump) && !this.hasJumped;

    // Check for double jump ability
    const canDoubleJump = !this.isGrounded &&
      !canCoyoteJump &&
      this.hasJumped &&
      !this.hasUsedDoubleJump &&
      this.powerUpManager?.canDoubleJump();

    // Jump if: can jump AND (key held OR buffered jump queued)
    if (canJump && (input.jumpHeld || this.jumpQueued)) {
      this.executeJump();
      this.jumpQueued = false;
    } else if (canDoubleJump && input.jump) {
      // Double jump on fresh press only
      this.executeDoubleJump();
      this.jumpQueued = false;
    }
  }

  private executeDoubleJump(): void {
    // Use the double jump from power-up manager
    if (!this.powerUpManager?.useDoubleJump()) return;

    const vel = this.rigidBody.linvel();
    // Reset Y velocity and apply jump
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
    this.rigidBody.applyImpulse({ x: 0, y: PHYSICS.JUMP_IMPULSE * 0.9, z: 0 }, true);

    this.hasUsedDoubleJump = true;

    eventBus.emit(GameEvents.PLAYER_JUMP);
  }

  private executeJump(): void {
    // Reset Y velocity to prevent stacking with external forces (spinner, etc.)
    const vel = this.rigidBody.linvel();
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);

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

    const vel = this.rigidBody.linvel();
    const hasInput = this.moveDirection.lengthSq() > 0;

    if (hasInput) {
      this.moveDirection.normalize();
    }

    // Apply speed multiplier from power-ups
    const speedMultiplier = this.powerUpManager?.getSpeedMultiplier() ?? 1.0;
    const speed = PHYSICS.GROUND_SPEED * speedMultiplier;

    // Get platform velocity if on moving platform
    let platformVelX = 0;
    let platformVelY = 0;
    let platformVelZ = 0;
    if (this.isGrounded && this.groundColliderHandle !== null) {
      const platformVel = platformVelocityRegistry.get(this.groundColliderHandle);
      if (platformVel) {
        platformVelX = platformVel.x;
        platformVelY = platformVel.y;
        platformVelZ = platformVel.z;
      }
    }

    if (this.isGrounded) {
      // GROUND: Direct velocity control + platform velocity
      // Match platform's Y velocity so marble moves with vertically-moving platforms
      // But skip Y sync if we just jumped (hasJumped prevents cancelling jump velocity)
      const targetVelY = this.hasJumped ? vel.y : platformVelY;

      if (hasInput) {
        this.rigidBody.setLinvel(
          {
            x: this.moveDirection.x * speed + platformVelX,
            y: targetVelY,
            z: this.moveDirection.z * speed + platformVelZ,
          },
          true
        );
      } else {
        // No input on ground = gradual deceleration towards platform velocity
        // Decay factor: higher = faster stop (0.85 gives nice momentum feel)
        const decay = 0.85;
        const newVelX = vel.x * decay + platformVelX * (1 - decay);
        const newVelZ = vel.z * decay + platformVelZ * (1 - decay);

        // Only clear angular velocity when nearly stopped
        const horizontalSpeed = Math.sqrt(newVelX * newVelX + newVelZ * newVelZ);
        if (horizontalSpeed < 0.1) {
          this.rigidBody.setLinvel({ x: platformVelX, y: targetVelY, z: platformVelZ }, true);
          this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          this.rigidBody.setLinvel({ x: newVelX, y: targetVelY, z: newVelZ }, true);
        }
      }
    } else {
      // AIR: Momentum preservation - only change velocity if input is pressed
      if (hasInput) {
        // Player pressed a direction key - change to that direction
        this.rigidBody.setLinvel(
          {
            x: this.moveDirection.x * speed,
            y: vel.y,
            z: this.moveDirection.z * speed,
          },
          true
        );
      }
      // NO INPUT IN AIR = keep current horizontal velocity (momentum preserved)
      // Don't touch vel.x or vel.z - let the marble drift
    }
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

    // Allow higher max speed when speed boosted
    const speedMultiplier = this.powerUpManager?.getSpeedMultiplier() ?? 1.0;
    const maxSpeed = PHYSICS.MAX_SPEED * speedMultiplier;

    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
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
    // Reset position (spawn slightly higher to avoid collision resolution issues)
    this.rigidBody.setTranslation(
      {
        x: this.checkpointPosition.x,
        y: this.checkpointPosition.y + 0.5,
        z: this.checkpointPosition.z,
      },
      true
    );

    // Clear ALL momentum - velocity, angular velocity, and accumulated forces
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.resetForces(true);
    this.rigidBody.resetTorques(true);

    // Put body to sleep to prevent any physics processing
    this.rigidBody.sleep();

    this.hasJumped = false;
    this.jumpQueued = false;
    this.hasUsedDoubleJump = false;
    this.timeSinceGrounded = 0;
    this.isGrounded = false;
    this.teleportCooldown = 0;

    // Skip physics forces for several frames to ensure clean respawn
    this.respawnCooldown = 5;

    // Sync mesh immediately
    this.syncMeshToBody();

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
    // Unsubscribe from all events to prevent memory leaks
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.physics.removeBody(this.rigidBody);
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
