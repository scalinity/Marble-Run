import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance } from "../types";
import { COLORS, POWERUPS } from "../../../config/constants";
import { TriggerType } from "../../CollisionHandler";
import { eventBus, GameEvents } from "../../../utils/EventBus";

const RADIUS = 0.35;
const ROTATION_SPEED = 3;
const BOB_SPEED = 2;
const BOB_AMPLITUDE = 0.15;

export interface SpeedBoostParams {
  duration?: number;
}

/**
 * Create a speed boost power-up
 */
export function createSpeedBoost(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as SpeedBoostParams | undefined;
  const duration = params?.duration ?? POWERUPS.SPEED_BOOST_DURATION;

  // Create arrow-shaped mesh for speed
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);

  // Main body (stretched octahedron)
  const bodyGeometry = new THREE.OctahedronGeometry(RADIUS);
  bodyGeometry.scale(1, 1.5, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.POWERUP_SPEED,
    roughness: 0.2,
    metalness: 0.7,
    emissive: new THREE.Color(COLORS.POWERUP_SPEED),
    emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);

  // Speed lines
  const lineGeometry = new THREE.CylinderGeometry(0.02, 0.02, RADIUS * 2, 4);
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.7,
  });

  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.x = -RADIUS * 0.5 + i * RADIUS * 0.5;
    line.position.z = 0.15 + i * 0.1;
    line.rotation.x = Math.PI / 2;
    group.add(line);
  }

  context.scene.add(group);

  // Store base Y position for bobbing
  const baseY = data.position[1];

  // Create sensor collider
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: RADIUS * 1.5, y: RADIUS * 1.5, z: RADIUS * 1.5 },
    { isSensor: true },
  );

  // Track if collected
  let collected = false;
  let collectAnimation = 0;

  const resetPowerUp = () => {
    collected = false;
    collectAnimation = 0;
    group.visible = true;
    group.scale.setScalar(1);
  };

  // Reset on player respawn
  const unsubscribeRespawn = eventBus.on(
    GameEvents.PLAYER_RESPAWN,
    resetPowerUp,
  );

  const onCollect = () => {
    if (collected) return;
    collected = true;
    eventBus.emit(GameEvents.POWERUP_COLLECTED, {
      type: "speedBoost",
      duration,
      id: data.id,
    });
  };

  context.registerTrigger(
    collider.handle,
    TriggerType.POWERUP,
    data.id,
    onCollect,
  );

  const update = (dt: number, elapsed: number): void => {
    if (collected) {
      // Shrink and spin fast
      collectAnimation += dt * 5;
      const scale = Math.max(0, 1 - collectAnimation);
      group.scale.setScalar(scale);
      group.rotation.y += dt * 20;

      if (collectAnimation >= 1) {
        group.visible = false;
      }
      return;
    }

    // Rotate
    group.rotation.y += ROTATION_SPEED * dt;

    // Bob up and down
    group.position.y = baseY + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;

    // Pulse glow
    const pulse = (Math.sin(elapsed * 4) + 1) / 2;
    bodyMaterial.emissiveIntensity = 0.4 + pulse * 0.3;
  };

  return {
    id: data.id,
    type: data.type,
    mesh: group,
    rigidBody,
    collider,
    update,
    dispose: () => {
      unsubscribeRespawn();
      context.physics.removeBody(rigidBody);
      context.scene.remove(group);
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
  };
}
