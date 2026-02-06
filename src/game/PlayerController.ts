import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Physics } from "../engine/Physics";
import { InputState } from "../engine/Input";
import { PHYSICS, COLORS, MATERIALS } from "../config/constants";
import { eventBus, GameEvents } from "../utils/EventBus";
import { platformVelocityRegistry } from "./PlatformVelocityRegistry";
import { PowerUpManager } from "./PowerUpManager";
import { teleporterRegistry } from "./TeleporterRegistry";

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
  private mesh!: THREE.Group;
  private mainSphere!: THREE.Mesh;
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
  private doubleJumpPendingFromPickup = false; // Allows held jump to trigger double jump after powerup pickup

  // Respawn cooldown (skip physics for a few frames after respawn)
  private respawnCooldown = 0;

  // Power-ups
  private powerUpManager: PowerUpManager | null = null;

  // Teleport cooldown
  private teleportCooldown = 0;

  // Bounce immunity (prevents ground check from resetting hasJumped right after bounce)
  private bounceImmunityTimer = 0;

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
    spawnPosition: THREE.Vector3,
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
      eventBus.on(
        GameEvents.TELEPORT,
        (data: { fromId: string; toPosition: THREE.Vector3 }) => {
          this.teleportTo(data.toPosition, data.fromId);
        },
      ),

      // Handle spinner hazard hits
      eventBus.on(
        GameEvents.SPINNER_HIT,
        (data: { id: string; centerPosition: THREE.Vector3 }) => {
          this.handleSpinnerHit(data.centerPosition);
        },
      ),

      // Handle double jump powerup collection - allow immediate use with held jump
      eventBus.on(GameEvents.POWERUP_COLLECTED, (data: { type: string }) => {
        if (data.type === "doubleJump") {
          this.doubleJumpPendingFromPickup = true;
        }
      }),
    );
  }

  /**
   * Handle spinner hazard collision - shield protects with controlled bounce
   */
  private handleSpinnerHit(spinnerCenter: THREE.Vector3): void {
    if (!this.powerUpManager?.hasShield()) {
      // No shield - let physics handle it (player gets knocked around)
      return;
    }

    // Has shield - use it and bounce safely away
    this.powerUpManager.useShield();

    // Calculate direction away from spinner
    const pos = this.rigidBody.translation();
    const awayDir = new THREE.Vector3(
      pos.x - spinnerCenter.x,
      0,
      pos.z - spinnerCenter.z,
    );

    // If player is right at center, pick a random direction
    if (awayDir.lengthSq() < 0.01) {
      awayDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    awayDir.normalize();

    // Apply controlled knockback - away from spinner + slight upward
    const knockbackForce = 12;
    const upwardForce = 8;
    this.rigidBody.setLinvel(
      {
        x: awayDir.x * knockbackForce,
        y: upwardForce,
        z: awayDir.z * knockbackForce,
      },
      true,
    );

    // Treat as airborne
    this.hasJumped = true;
    this.isGrounded = false;
    this.timeSinceGrounded = PHYSICS.COYOTE_TIME + 1;
  }

  /**
   * Apply bounce force (from bounce pads)
   */
  private applyBounce(force: number): void {
    const vel = this.rigidBody.linvel();
    // Reset Y velocity and apply bounce
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
    this.rigidBody.applyImpulse({ x: 0, y: force, z: 0 }, true);
    // Set hasJumped = true so applyMovement doesn't reset Y velocity to 0
    this.hasJumped = true;
    this.hasUsedDoubleJump = false;
    // Reset grounded state so we're treated as airborne
    this.isGrounded = false;
    this.timeSinceGrounded = PHYSICS.COYOTE_TIME + 1;
    // Prevent ground check from resetting hasJumped for a brief period
    this.bounceImmunityTimer = 0.15;
  }

  /**
   * Teleport to position
   */
  private teleportTo(position: THREE.Vector3, fromId: string): void {
    if (this.teleportCooldown > 0) return;

    this.rigidBody.setTranslation(
      { x: position.x, y: position.y + 1.5, z: position.z },
      true,
    );
    // Preserve horizontal velocity, reset vertical
    const vel = this.rigidBody.linvel();
    this.rigidBody.setLinvel({ x: vel.x * 0.5, y: 0, z: vel.z * 0.5 }, true);

    this.teleportCooldown = PHYSICS.TELEPORT_COOLDOWN;

    // Notify the source teleporter that the teleport succeeded
    eventBus.emit(GameEvents.TELEPORT_SUCCESS, { fromId });
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
      },
    );

    // Create sphere collider
    this.collider = this.physics.createSphereCollider(
      this.rigidBody,
      PHYSICS.MARBLE_RADIUS,
      {
        friction: PHYSICS.MARBLE_FRICTION,
        restitution: PHYSICS.MARBLE_RESTITUTION,
        density: PHYSICS.MARBLE_DENSITY,
      },
    );
  }

  private createVisualMesh(): void {
    const RADIUS = PHYSICS.MARBLE_RADIUS;

    // Create group to hold all visual elements
    this.mesh = new THREE.Group();

    // Main sphere - exact copy from reference createPlayer()
    // Reference: createSphere(0.4, COLORS.player, COLORS.player, 0.5)
    const sphereGeo = new THREE.SphereGeometry(RADIUS, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: COLORS.MARBLE,
      emissive: new THREE.Color(COLORS.MARBLE),
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.mainSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.mainSphere.castShadow = true;
    this.mainSphere.receiveShadow = true;
    this.mesh.add(this.mainSphere);

    // Inner core glow - exact from reference
    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.625, 16, 16), // 0.25/0.4 ratio
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.mesh.add(innerCore);

    // Equator ring - exact from reference
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS * 0.95, RADIUS * 0.075, 8, 32), // 0.38/0.4 and 0.03/0.4 ratios
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.5,
      }),
    );
    this.mesh.add(ring);

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
      // Emit hazard hit before respawn for VFX
      eventBus.emit(GameEvents.HAZARD_HIT, {
        position: new THREE.Vector3(pos.x, pos.y, pos.z),
      });
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
      this.syncMeshToBody(dt);

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
    this.syncMeshToBody(dt);
  }

  private updateGroundDetection(): void {
    const position = this.rigidBody.translation();
    const maxToi = PHYSICS.MARBLE_RADIUS + PHYSICS.GROUND_CHECK_DISTANCE;

    // Cast ray downward from marble center
    const hit = this.physics.castRayAndGetNormal(
      { x: position.x, y: position.y, z: position.z },
      { x: 0, y: -1, z: 0 },
      maxToi,
      this.collider,
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

      // Only process landing if not immune from bounce (bounce immunity prevents
      // the ground check from immediately resetting hasJumped after a bounce pad)
      if (!wasGrounded && this.bounceImmunityTimer <= 0) {
        this.hasJumped = false; // Only reset on LANDING, not every substep
        this.hasUsedDoubleJump = false; // Reset double jump on landing
        this.doubleJumpPendingFromPickup = false; // Clear pickup flag on landing
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

    // Update bounce immunity timer
    if (this.bounceImmunityTimer > 0) {
      this.bounceImmunityTimer -= dt;
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
    const canDoubleJump =
      !this.isGrounded &&
      !canCoyoteJump &&
      this.hasJumped &&
      !this.hasUsedDoubleJump &&
      this.powerUpManager?.canDoubleJump();

    // Allow double jump with held button if powerup was just collected
    // This prevents the "delay" where player must release and re-press after pickup
    // The flag persists until double jump is used or player lands
    const wantsDoubleJump =
      input.jump || (this.doubleJumpPendingFromPickup && input.jumpHeld);

    // Jump if: can jump AND (key held OR buffered jump queued)
    if (canJump && (input.jumpHeld || this.jumpQueued)) {
      this.executeJump();
      this.jumpQueued = false;
    } else if (canDoubleJump && wantsDoubleJump) {
      this.executeDoubleJump();
      this.jumpQueued = false;
      // Clear the pending flag only when double jump is used
      this.doubleJumpPendingFromPickup = false;
    }
  }

  private executeDoubleJump(): void {
    // Use the double jump from power-up manager
    if (!this.powerUpManager?.useDoubleJump()) return;

    const vel = this.rigidBody.linvel();
    // Reset Y velocity and apply jump
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
    this.rigidBody.applyImpulse(
      { x: 0, y: PHYSICS.JUMP_IMPULSE * 0.9, z: 0 },
      true,
    );

    this.hasUsedDoubleJump = true;

    eventBus.emit(GameEvents.PLAYER_JUMP, {
      position: this.getPosition().clone(),
    });
  }

  private executeJump(): void {
    // Reset Y velocity to prevent stacking with external forces (spinner, etc.)
    const vel = this.rigidBody.linvel();
    this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);

    // Apply jump impulse
    this.rigidBody.applyImpulse({ x: 0, y: PHYSICS.JUMP_IMPULSE, z: 0 }, true);

    this.hasJumped = true;
    this.timeSinceGrounded = PHYSICS.COYOTE_TIME + 1;

    eventBus.emit(GameEvents.PLAYER_JUMP, {
      position: this.getPosition().clone(),
    });
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
      const platformVel = platformVelocityRegistry.get(
        this.groundColliderHandle,
      );
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

      // Check if on ice surface (low friction = slippery)
      const isOnIce = this.isOnIceSurface();
      const iceControl = 0.15; // How much control player has on ice (0 = none, 1 = full)
      const iceDecay = 0.995; // Very slow deceleration on ice

      if (hasInput) {
        if (isOnIce) {
          // ICE: Momentum-based - blend current velocity with desired direction
          const targetVelX = this.moveDirection.x * speed + platformVelX;
          const targetVelZ = this.moveDirection.z * speed + platformVelZ;
          const newVelX = vel.x * (1 - iceControl) + targetVelX * iceControl;
          const newVelZ = vel.z * (1 - iceControl) + targetVelZ * iceControl;
          this.rigidBody.setLinvel(
            { x: newVelX, y: targetVelY, z: newVelZ },
            true,
          );
          this.setRollingAngularVelocity(newVelX, newVelZ);
        } else {
          // NORMAL GROUND: Direct velocity control
          const newVelX = this.moveDirection.x * speed + platformVelX;
          const newVelZ = this.moveDirection.z * speed + platformVelZ;
          this.rigidBody.setLinvel(
            { x: newVelX, y: targetVelY, z: newVelZ },
            true,
          );
          this.setRollingAngularVelocity(newVelX, newVelZ);
        }
      } else {
        // No input on ground = gradual deceleration towards platform velocity
        const decay = isOnIce ? iceDecay : 0.85;
        const newVelX = vel.x * decay + platformVelX * (1 - decay);
        const newVelZ = vel.z * decay + platformVelZ * (1 - decay);

        // Only clear angular velocity when nearly stopped
        const horizontalSpeed = Math.sqrt(
          newVelX * newVelX + newVelZ * newVelZ,
        );
        if (horizontalSpeed < 0.1) {
          this.rigidBody.setLinvel(
            { x: platformVelX, y: targetVelY, z: platformVelZ },
            true,
          );
          this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          this.rigidBody.setLinvel(
            { x: newVelX, y: targetVelY, z: newVelZ },
            true,
          );
          this.setRollingAngularVelocity(newVelX, newVelZ);
        }
      }
    } else {
      // AIR: Momentum preservation - only change velocity if input is pressed
      if (hasInput) {
        // Player pressed a direction key - change to that direction
        const newVelX = this.moveDirection.x * speed;
        const newVelZ = this.moveDirection.z * speed;
        this.rigidBody.setLinvel({ x: newVelX, y: vel.y, z: newVelZ }, true);
        // Set angular velocity for realistic rolling even in air
        this.setRollingAngularVelocity(newVelX, newVelZ);
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
      new THREE.Vector3(0, 1, 0),
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
        true,
      );
      // Update angular velocity to match clamped linear velocity
      this.setRollingAngularVelocity(vel.x * scale, vel.z * scale);
    }
  }

  /**
   * Check if the player is standing on an ice surface by checking ground collider friction
   */
  private isOnIceSurface(): boolean {
    if (!this.isGrounded || this.groundColliderHandle === null) {
      return false;
    }
    const collider = this.physics.getCollider(this.groundColliderHandle);
    if (!collider) {
      return false;
    }
    // Ice has very low friction (PHYSICS.ICE_FRICTION = 0.02)
    // Treat anything with friction below 0.1 as ice
    return collider.friction() < 0.1;
  }

  /**
   * Set angular velocity to match linear velocity for realistic rolling.
   * For a rolling ball: ω = v / r
   * - Moving in +X → rotate around -Z axis
   * - Moving in +Z → rotate around +X axis
   */
  private setRollingAngularVelocity(velX: number, velZ: number): void {
    const r = PHYSICS.MARBLE_RADIUS;
    // Rolling formula: angular velocity perpendicular to linear velocity
    // vx causes rotation around Z, vz causes rotation around X
    this.rigidBody.setAngvel({ x: velZ / r, y: 0, z: -velX / r }, true);
  }

  private syncMeshToBody(_dt: number): void {
    const position = this.rigidBody.translation();
    const rotation = this.rigidBody.rotation();

    this.mesh.position.set(position.x, position.y, position.z);

    // Apply physics rotation to entire mesh group (sphere + ring rotate together)
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  /**
   * Respawn at last checkpoint
   */
  respawn(): void {
    // Capture death position before reset for VFX
    const deathPosition = this.getPosition().clone();

    // Reset position (spawn slightly higher to avoid collision resolution issues)
    this.rigidBody.setTranslation(
      {
        x: this.checkpointPosition.x,
        y: this.checkpointPosition.y + 0.5,
        z: this.checkpointPosition.z,
      },
      true,
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
    this.doubleJumpPendingFromPickup = false;
    this.timeSinceGrounded = 0;
    this.isGrounded = false;
    this.teleportCooldown = 0;

    // Skip physics forces for several frames to ensure clean respawn
    this.respawnCooldown = 5;

    // Sync mesh immediately (use 0 dt since we're just syncing position, not animating)
    this.syncMeshToBody(0);

    eventBus.emit(GameEvents.PLAYER_RESPAWN, { position: deathPosition });
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
   * Get the visual mesh group
   */
  getMesh(): THREE.Group {
    return this.mesh;
  }

  dispose(): void {
    // Unsubscribe from all events to prevent memory leaks
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    this.physics.removeBody(this.rigidBody);
    this.scene.remove(this.mesh);

    // Dispose all meshes in the group
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
