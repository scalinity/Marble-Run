import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance } from '../types';
import { COLORS, POWERUPS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';
import { eventBus, GameEvents } from '../../../utils/EventBus';

const RADIUS = 0.35;
const ROTATION_SPEED = 1.5;
const BOB_SPEED = 1.8;
const BOB_AMPLITUDE = 0.12;

export interface ShieldParams {
  duration?: number;
}

/**
 * Create a shield power-up
 */
export function createShield(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as ShieldParams | undefined;
  const duration = params?.duration ?? POWERUPS.SHIELD_DURATION;

  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);

  // Core sphere
  const coreGeometry = new THREE.SphereGeometry(RADIUS * 0.4, 16, 16);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.POWERUP_SHIELD,
    roughness: 0.1,
    metalness: 0.9,
    emissive: new THREE.Color(COLORS.POWERUP_SHIELD),
    emissiveIntensity: 0.5,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);

  // Shield bubble (outer sphere)
  const bubbleGeometry = new THREE.SphereGeometry(RADIUS, 24, 24);
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({
    color: COLORS.POWERUP_SHIELD,
    roughness: 0,
    metalness: 0.1,
    transmission: 0.8,
    thickness: 0.5,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
  group.add(bubble);

  // Hexagonal pattern ring
  const ringGeometry = new THREE.TorusGeometry(RADIUS * 0.7, 0.03, 6, 6);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.POWERUP_SHIELD,
    emissive: new THREE.Color(COLORS.POWERUP_SHIELD),
    emissiveIntensity: 0.6,
  });

  const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
  ring1.rotation.x = Math.PI / 2;
  group.add(ring1);

  const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
  ring2.rotation.y = Math.PI / 2;
  group.add(ring2);

  const ring3 = new THREE.Mesh(ringGeometry, ringMaterial);
  group.add(ring3);

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
    { x: RADIUS * 1.5, y: RADIUS * 1.5, z: RADIUS * 1.5 },
    { isSensor: true }
  );

  let collected = false;
  let collectAnimation = 0;

  const onCollect = () => {
    if (collected) return;
    collected = true;
    eventBus.emit(GameEvents.POWERUP_COLLECTED, {
      type: 'shield',
      duration,
      id: data.id,
    });
  };

  context.registerTrigger(
    collider.handle,
    TriggerType.POWERUP,
    data.id,
    onCollect
  );

  const update = (dt: number, elapsed: number): void => {
    if (collected) {
      collectAnimation += dt * 4;

      // Expand and fade
      const scale = 1 + collectAnimation * 2;
      bubble.scale.setScalar(scale);
      bubbleMaterial.opacity = Math.max(0, 0.4 - collectAnimation * 0.4);

      const coreScale = Math.max(0, 1 - collectAnimation);
      core.scale.setScalar(coreScale);

      if (collectAnimation >= 1) {
        group.visible = false;
      }
      return;
    }

    // Slow rotation
    group.rotation.y += ROTATION_SPEED * dt;

    // Bob
    group.position.y = baseY + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;

    // Rings rotate independently
    ring1.rotation.z = elapsed * 0.5;
    ring2.rotation.x = elapsed * 0.7;
    ring3.rotation.y = elapsed * 0.6;

    // Pulse bubble
    const pulse = (Math.sin(elapsed * 2) + 1) / 2;
    bubbleMaterial.opacity = 0.3 + pulse * 0.2;
    coreMaterial.emissiveIntensity = 0.4 + pulse * 0.3;
    ringMaterial.emissiveIntensity = 0.5 + pulse * 0.3;

    // Subtle bubble scale pulse
    bubble.scale.setScalar(1 + pulse * 0.05);
  };

  return {
    id: data.id,
    type: data.type,
    mesh: group,
    rigidBody,
    collider,
    update,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(group);
      coreGeometry.dispose();
      coreMaterial.dispose();
      bubbleGeometry.dispose();
      bubbleMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}
