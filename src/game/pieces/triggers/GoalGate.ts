import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance } from '../types';
import { COLORS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';

const GATE_WIDTH = 2.5;
const GATE_HEIGHT = 3;
const GATE_DEPTH = 0.3;
const PILLAR_WIDTH = 0.3;

/**
 * Create a goal gate (level end trigger)
 */
export function createGoalGate(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const width = GATE_WIDTH * scale[0];
  const height = GATE_HEIGHT * scale[1];
  const depth = GATE_DEPTH * scale[2];
  const pillarWidth = PILLAR_WIDTH * scale[0];

  // Create group
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);
  group.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );

  // Material
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.GOAL,
    roughness: 0.3,
    metalness: 0.7,
    emissive: new THREE.Color(COLORS.GOAL),
    emissiveIntensity: 0.3,
  });

  // Left pillar
  const leftPillarGeo = new THREE.BoxGeometry(pillarWidth, height, depth);
  const leftPillar = new THREE.Mesh(leftPillarGeo, material);
  leftPillar.position.set(-width / 2 + pillarWidth / 2, height / 2, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  // Right pillar
  const rightPillarGeo = new THREE.BoxGeometry(pillarWidth, height, depth);
  const rightPillar = new THREE.Mesh(rightPillarGeo, material);
  rightPillar.position.set(width / 2 - pillarWidth / 2, height / 2, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  // Top bar
  const topBarGeo = new THREE.BoxGeometry(width, pillarWidth, depth);
  const topBar = new THREE.Mesh(topBarGeo, material);
  topBar.position.set(0, height - pillarWidth / 2, 0);
  topBar.castShadow = true;
  group.add(topBar);

  // Glowing center (trigger area visualization)
  const centerGeo = new THREE.PlaneGeometry(width - pillarWidth * 2, height - pillarWidth);
  const centerMat = new THREE.MeshBasicMaterial({
    color: COLORS.GOAL,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const centerPlane = new THREE.Mesh(centerGeo, centerMat);
  centerPlane.position.set(0, height / 2, 0);
  group.add(centerPlane);

  context.scene.add(group);

  // Create fixed body with sensor collider
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1] + height / 2,
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: height / 2, z: depth * 2 },
    { isSensor: true }
  );

  // Track if goal reached
  let reached = false;
  let pulseTime = 0;

  // Goal reached callback
  const onReached = () => {
    if (reached) return;
    reached = true;
    context.onGoalReached?.();
  };

  // Register as trigger
  context.registerTrigger(
    collider.handle,
    TriggerType.GOAL,
    data.id,
    onReached
  );

  // Update function - pulsing glow
  const update = (dt: number, elapsed: number): void => {
    if (reached) {
      // Victory animation
      pulseTime += dt * 10;
      const scale = 1 + Math.sin(pulseTime) * 0.1;
      group.scale.setScalar(scale);
      material.emissiveIntensity = 0.5 + Math.sin(pulseTime * 2) * 0.3;
    } else {
      // Idle pulsing
      material.emissiveIntensity = 0.3 + Math.sin(elapsed * 3) * 0.1;
      centerMat.opacity = 0.15 + Math.sin(elapsed * 2) * 0.1;
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
      leftPillarGeo.dispose();
      rightPillarGeo.dispose();
      topBarGeo.dispose();
      centerGeo.dispose();
      material.dispose();
      centerMat.dispose();
    },
  };
}
