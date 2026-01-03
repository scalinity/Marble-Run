import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance } from "../types";
import { COLORS, POWERUPS } from "../../../config/constants";
import { TriggerType } from "../../CollisionHandler";
import { eventBus, GameEvents } from "../../../utils/EventBus";

const RADIUS = 0.3;
const ROTATION_SPEED = 2;
const BOB_SPEED = 2.5;
const BOB_AMPLITUDE = 0.2;

export interface DoubleJumpParams {
  duration?: number;
}

/**
 * Create a double jump power-up
 */
export function createDoubleJump(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as DoubleJumpParams | undefined;
  const duration = params?.duration ?? POWERUPS.DOUBLE_JUMP_DURATION;

  // Create wing-like mesh
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);

  // Center orb
  const orbGeometry = new THREE.SphereGeometry(RADIUS * 0.5, 16, 16);
  const orbMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.POWERUP_DOUBLE_JUMP,
    roughness: 0.1,
    metalness: 0.8,
    emissive: new THREE.Color(COLORS.POWERUP_DOUBLE_JUMP),
    emissiveIntensity: 0.6,
  });
  const orb = new THREE.Mesh(orbGeometry, orbMaterial);
  group.add(orb);

  // Wings (two curved arrows pointing up)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.3, 0.2, 0.2, 0.5);
  wingShape.lineTo(0.35, 0.4);
  wingShape.lineTo(0.25, 0.7);
  wingShape.lineTo(0.15, 0.5);
  wingShape.lineTo(0.1, 0.6);
  wingShape.quadraticCurveTo(0.2, 0.1, 0, 0);

  const wingGeometry = new THREE.ShapeGeometry(wingShape);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.POWERUP_DOUBLE_JUMP,
    emissive: new THREE.Color(COLORS.POWERUP_DOUBLE_JUMP),
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  // Left wing
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.x = -RADIUS * 0.3;
  leftWing.rotation.y = -Math.PI / 6;
  group.add(leftWing);

  // Right wing (mirrored)
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.x = RADIUS * 0.3;
  rightWing.rotation.y = Math.PI / 6;
  rightWing.scale.x = -1;
  group.add(rightWing);

  // Up arrows
  const arrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 4);
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });

  const arrow1 = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow1.position.set(0, RADIUS * 0.8, 0);
  group.add(arrow1);

  const arrow2 = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow2.position.set(0, RADIUS * 1.2, 0);
  arrow2.scale.setScalar(0.7);
  group.add(arrow2);

  context.scene.add(group);

  const baseY = data.position[1];

  // Create sensor collider
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: RADIUS * 2, y: RADIUS * 2, z: RADIUS * 2 },
    { isSensor: true },
  );

  let collected = false;
  let collectAnimation = 0;

  const resetPowerUp = () => {
    collected = false;
    collectAnimation = 0;
    group.visible = true;
    group.scale.setScalar(1);
    group.position.y = baseY;
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
      type: "doubleJump",
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
      collectAnimation += dt * 5;
      const scale = Math.max(0, 1 - collectAnimation);
      group.scale.setScalar(scale);
      group.position.y += dt * 5; // Float up

      if (collectAnimation >= 1) {
        group.visible = false;
      }
      return;
    }

    // Rotate
    group.rotation.y += ROTATION_SPEED * dt;

    // Bob with extra bounce
    const bob = Math.sin(elapsed * BOB_SPEED);
    group.position.y = baseY + bob * BOB_AMPLITUDE;

    // Animate arrows bobbing independently
    arrow1.position.y = RADIUS * 0.8 + Math.sin(elapsed * 4) * 0.05;
    arrow2.position.y = RADIUS * 1.2 + Math.sin(elapsed * 4 + 0.5) * 0.05;

    // Wing flap
    const flapAngle = Math.sin(elapsed * 6) * 0.1;
    leftWing.rotation.z = flapAngle;
    rightWing.rotation.z = -flapAngle;

    // Pulse glow
    const pulse = (Math.sin(elapsed * 3) + 1) / 2;
    orbMaterial.emissiveIntensity = 0.5 + pulse * 0.3;
    wingMaterial.emissiveIntensity = 0.3 + pulse * 0.2;
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
      orbGeometry.dispose();
      orbMaterial.dispose();
      wingGeometry.dispose();
      wingMaterial.dispose();
      arrowGeometry.dispose();
      arrowMaterial.dispose();
    },
  };
}
