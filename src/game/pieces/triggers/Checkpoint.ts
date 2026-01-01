import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance } from '../types';
import { COLORS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';

const CHECKPOINT_RADIUS = 1.5;
const CHECKPOINT_HEIGHT = 0.1;
const RING_INNER_RADIUS = 1.2;

/**
 * Create a checkpoint (respawn point)
 */
export function createCheckpoint(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const scale = data.scale ?? [1, 1, 1];

  const radius = CHECKPOINT_RADIUS * scale[0];
  const height = CHECKPOINT_HEIGHT * scale[1];

  // Create group
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);

  // Base disc
  const baseGeo = new THREE.CylinderGeometry(radius, radius, height, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: COLORS.CHECKPOINT,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.receiveShadow = true;
  group.add(base);

  // Glowing ring
  const ringGeo = new THREE.RingGeometry(RING_INNER_RADIUS * scale[0], radius, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: COLORS.CHECKPOINT,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = height / 2 + 0.01;
  group.add(ring);

  // Active indicator (hidden initially)
  const activeGeo = new THREE.TorusGeometry(radius * 0.8, 0.05, 8, 32);
  const activeMat = new THREE.MeshBasicMaterial({
    color: COLORS.CHECKPOINT_ACTIVE,
    transparent: true,
    opacity: 0,
  });
  const activeRing = new THREE.Mesh(activeGeo, activeMat);
  activeRing.rotation.x = Math.PI / 2;
  activeRing.position.y = 0.5;
  group.add(activeRing);

  context.scene.add(group);

  // Create fixed body with sensor collider
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1] + 0.5,
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: radius, y: 1, z: radius },
    { isSensor: true }
  );

  // Track activation state
  let activated = false;
  let activationTime = 0;

  // Checkpoint position for respawn
  const checkpointPos = new THREE.Vector3(
    data.position[0],
    data.position[1] + 1, // Spawn slightly above
    data.position[2]
  );

  // Activation callback
  const onActivate = () => {
    if (activated) return;
    activated = true;
    context.onCheckpoint?.(checkpointPos);
  };

  // Register as trigger
  context.registerTrigger(
    collider.handle,
    TriggerType.CHECKPOINT,
    data.id,
    onActivate
  );

  // Update function
  const update = (dt: number, elapsed: number): void => {
    if (activated) {
      // Active state - bright pulsing
      activationTime += dt;
      baseMat.color.setHex(COLORS.CHECKPOINT_ACTIVE);
      baseMat.emissive = new THREE.Color(COLORS.CHECKPOINT_ACTIVE);
      baseMat.emissiveIntensity = 0.3 + Math.sin(elapsed * 4) * 0.1;

      ringMat.color.setHex(COLORS.CHECKPOINT_ACTIVE);
      ringMat.opacity = 0.6 + Math.sin(elapsed * 3) * 0.2;

      // Animate active ring
      activeMat.opacity = 0.8;
      activeRing.position.y = 0.5 + Math.sin(elapsed * 2) * 0.2;
      activeRing.rotation.z = elapsed;
    } else {
      // Inactive state - subtle pulsing
      ringMat.opacity = 0.3 + Math.sin(elapsed * 2) * 0.1;
    }
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
      baseGeo.dispose();
      baseMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      activeGeo.dispose();
      activeMat.dispose();
    },
  };
}
