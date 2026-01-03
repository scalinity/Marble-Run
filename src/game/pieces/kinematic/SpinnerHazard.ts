import * as THREE from "three";
import {
  PieceData,
  PieceContext,
  PieceInstance,
  SpinnerHazardParams,
} from "../types";
import { COLORS } from "../../../config/constants";
import { TriggerType } from "../../CollisionHandler";
import { eventBus, GameEvents } from "../../../utils/EventBus";

const DEFAULT_LENGTH = 3;
const DEFAULT_WIDTH = 0.4;
const DEFAULT_HEIGHT = 0.5;
const DEFAULT_SPEED = 2; // radians per second

/**
 * Create a spinning hazard that can knock the marble off
 * With shield: player bounces off safely
 * Without shield: physics-based knockback
 */
export function createSpinnerHazard(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as SpinnerHazardParams | undefined;
  const scale = data.scale ?? [1, 1, 1];

  // Support both params and scale for dimensions
  const length = (params?.width ?? DEFAULT_LENGTH) * scale[0];
  const width = (params?.depth ?? DEFAULT_WIDTH) * scale[2];
  const height = (params?.height ?? DEFAULT_HEIGHT) * scale[1];
  const speed = params?.speed ?? DEFAULT_SPEED;
  const axis = params?.axis ?? "y";

  // Create mesh - a bar that spins
  const geometry = new THREE.BoxGeometry(length, height, width);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.HAZARD,
    roughness: 0.3,
    metalness: 0.6,
    emissive: new THREE.Color(COLORS.HAZARD),
    emissiveIntensity: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  mesh.castShadow = true;

  context.scene.add(mesh);

  // Create kinematic physics body
  const rigidBody = context.physics.createKinematicBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  // Physical collider for actual collision response
  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: length / 2, y: height / 2, z: width / 2 },
    { friction: 0.3, restitution: 0.0 },
  );

  // Sensor collider for shield detection (slightly larger)
  const sensorCollider = context.physics.createBoxCollider(
    rigidBody,
    { x: length / 2 + 0.3, y: height / 2 + 0.3, z: width / 2 + 0.3 },
    { isSensor: true },
  );

  // Track cooldown to prevent spam
  let lastHitTime = 0;
  const HIT_COOLDOWN = 0.3;

  // Center position for knockback calculation
  const centerPos = new THREE.Vector3(
    data.position[0],
    data.position[1],
    data.position[2],
  );

  const onHazardHit = () => {
    const now = performance.now() / 1000;
    if (now - lastHitTime < HIT_COOLDOWN) return;
    lastHitTime = now;

    // Emit spinner hit event - PlayerController will handle shield logic
    eventBus.emit(GameEvents.SPINNER_HIT, {
      id: data.id,
      centerPosition: centerPos.clone(),
    });
  };

  // Register as hazard trigger
  context.registerTrigger(
    sensorCollider.handle,
    TriggerType.HAZARD,
    data.id,
    onHazardHit,
  );

  // Rotation state
  let angle = 0;
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();

  // Update function
  const update = (dt: number, _elapsed: number): void => {
    angle += speed * dt;

    // Create rotation quaternion based on axis
    switch (axis) {
      case "x":
        euler.set(angle, 0, 0);
        break;
      case "y":
        euler.set(0, angle, 0);
        break;
      case "z":
        euler.set(0, 0, angle);
        break;
    }

    quaternion.setFromEuler(euler);

    // Update physics body rotation
    rigidBody.setNextKinematicRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    });

    // Sync mesh
    mesh.quaternion.copy(quaternion);
  };

  return {
    id: data.id,
    type: data.type,
    mesh,
    rigidBody,
    collider,
    update,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
