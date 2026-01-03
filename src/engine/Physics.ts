import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../config/constants";

/**
 * Physics world manager using Rapier3D
 * Implements fixed timestep with accumulator pattern
 */
export class Physics {
  public world!: RAPIER.World;
  public eventQueue!: RAPIER.EventQueue;
  public readonly RAPIER = RAPIER; // Expose RAPIER for direct access

  private accumulator = 0;
  private initialized = false;
  private tickCount = 0; // Physics tick counter for deterministic replay

  /**
   * Initialize Rapier physics - must be called before use
   */
  async init(): Promise<void> {
    await RAPIER.init();

    this.world = new RAPIER.World(PHYSICS.GRAVITY);
    this.eventQueue = new RAPIER.EventQueue(true);

    this.initialized = true;
    console.log("Rapier physics initialized");
  }

  /**
   * Step physics with fixed timestep
   * @param dt Frame delta time in seconds
   * @param beforeStep Callback called before each physics step
   */
  step(dt: number, beforeStep?: () => void): void {
    if (!this.initialized) return;

    this.accumulator += dt;

    // Cap accumulator to prevent spiral of death
    const maxAccumulator = PHYSICS.TIMESTEP * PHYSICS.MAX_SUBSTEPS;
    if (this.accumulator > maxAccumulator) {
      this.accumulator = maxAccumulator;
    }

    // Fixed timestep loop
    while (this.accumulator >= PHYSICS.TIMESTEP) {
      // Run pre-step logic (input, forces)
      beforeStep?.();

      // Step physics
      this.world.step(this.eventQueue);
      this.tickCount++;

      this.accumulator -= PHYSICS.TIMESTEP;
    }
  }

  /**
   * Get current physics tick count (for deterministic replay)
   */
  getTick(): number {
    return this.tickCount;
  }

  /**
   * Reset tick counter (for replay synchronization)
   */
  resetTick(): void {
    this.tickCount = 0;
  }

  /**
   * Get interpolation alpha for rendering
   * Use this to interpolate between physics states for smooth rendering
   */
  getAlpha(): number {
    return this.accumulator / PHYSICS.TIMESTEP;
  }

  /**
   * Create a dynamic rigid body
   */
  createDynamicBody(
    position: { x: number; y: number; z: number },
    options: {
      linearDamping?: number;
      angularDamping?: number;
      gravityScale?: number;
      ccdEnabled?: boolean;
    } = {},
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(options.linearDamping ?? PHYSICS.LINEAR_DAMPING)
      .setAngularDamping(options.angularDamping ?? PHYSICS.ANGULAR_DAMPING)
      .setGravityScale(options.gravityScale ?? PHYSICS.GRAVITY_SCALE)
      .setCcdEnabled(options.ccdEnabled ?? true);

    return this.world.createRigidBody(bodyDesc);
  }

  /**
   * Create a fixed (static) rigid body
   */
  createFixedBody(
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number; w: number },
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      position.x,
      position.y,
      position.z,
    );

    if (rotation) {
      bodyDesc.setRotation(rotation);
    }

    return this.world.createRigidBody(bodyDesc);
  }

  /**
   * Create a kinematic position-based rigid body
   */
  createKinematicBody(position: {
    x: number;
    y: number;
    z: number;
  }): RAPIER.RigidBody {
    const bodyDesc =
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y,
        position.z,
      );

    return this.world.createRigidBody(bodyDesc);
  }

  /**
   * Create a sphere collider
   */
  createSphereCollider(
    body: RAPIER.RigidBody,
    radius: number,
    options: {
      friction?: number;
      restitution?: number;
      density?: number;
      isSensor?: boolean;
    } = {},
  ): RAPIER.Collider {
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setFriction(options.friction ?? PHYSICS.MARBLE_FRICTION)
      .setRestitution(options.restitution ?? PHYSICS.MARBLE_RESTITUTION)
      .setDensity(options.density ?? PHYSICS.MARBLE_DENSITY);

    if (options.isSensor) {
      colliderDesc.setSensor(true);
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    return this.world.createCollider(colliderDesc, body);
  }

  /**
   * Create a box collider
   */
  createBoxCollider(
    body: RAPIER.RigidBody,
    halfExtents: { x: number; y: number; z: number },
    options: {
      friction?: number;
      restitution?: number;
      isSensor?: boolean;
      translation?: { x: number; y: number; z: number };
    } = {},
  ): RAPIER.Collider {
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    )
      .setFriction(options.friction ?? 0.5)
      .setRestitution(options.restitution ?? 0.2);

    if (options.translation) {
      colliderDesc.setTranslation(
        options.translation.x,
        options.translation.y,
        options.translation.z,
      );
    }

    if (options.isSensor) {
      colliderDesc.setSensor(true);
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    return this.world.createCollider(colliderDesc, body);
  }

  /**
   * Create a cylinder collider
   */
  createCylinderCollider(
    body: RAPIER.RigidBody,
    halfHeight: number,
    radius: number,
    options: {
      friction?: number;
      restitution?: number;
      isSensor?: boolean;
    } = {},
  ): RAPIER.Collider {
    const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
      .setFriction(options.friction ?? 0.5)
      .setRestitution(options.restitution ?? 0.2);

    if (options.isSensor) {
      colliderDesc.setSensor(true);
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    return this.world.createCollider(colliderDesc, body);
  }

  /**
   * Cast a ray and return the first hit
   */
  castRay(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxToi: number,
    excludeCollider?: RAPIER.Collider,
  ): RAPIER.RayColliderHit | null {
    const ray = new RAPIER.Ray(origin, direction);

    return this.world.castRay(
      ray,
      maxToi,
      true, // solid
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, // Exclude sensor colliders
      undefined, // filter groups
      excludeCollider,
      excludeCollider?.parent() ?? undefined,
    );
  }

  /**
   * Cast a ray and get the normal at hit point
   */
  castRayAndGetNormal(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxToi: number,
    excludeCollider?: RAPIER.Collider,
  ): RAPIER.RayColliderIntersection | null {
    const ray = new RAPIER.Ray(origin, direction);

    return this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, // Exclude sensor colliders from raycast
      undefined,
      excludeCollider,
      excludeCollider?.parent() ?? undefined,
    );
  }

  /**
   * Process collision events
   */
  processEvents(
    callback: (handle1: number, handle2: number, started: boolean) => void,
  ): void {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      callback(handle1, handle2, started);
    });
  }

  /**
   * Get collider by handle
   */
  getCollider(handle: number): RAPIER.Collider | undefined {
    return this.world.getCollider(handle);
  }

  /**
   * Remove a rigid body and its colliders
   */
  removeBody(body: RAPIER.RigidBody): void {
    this.world.removeRigidBody(body);
  }

  /**
   * Remove a collider
   */
  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, true);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.initialized) {
      this.world.free();
      this.eventQueue.free();
      this.initialized = false;
    }
  }
}
