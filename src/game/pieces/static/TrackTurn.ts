import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance } from '../types';
import { COLORS, MATERIALS } from '../../../config/constants';
import { rapierRotationFromEulerDegrees } from '../../../utils/math';

const DEFAULT_RADIUS = 2;
const DEFAULT_WIDTH = 2;
const DEFAULT_THICKNESS = 0.2;
const SEGMENTS = 8; // Number of segments to approximate curve

/**
 * Create a 90-degree curved track segment
 */
export function createTrackTurn(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const radius = DEFAULT_RADIUS * scale[0];
  const width = DEFAULT_WIDTH * scale[0];
  const thickness = DEFAULT_THICKNESS * scale[1];

  // Create group to hold all segments
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);
  group.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );

  const material = new THREE.MeshStandardMaterial({
    color: COLORS.TRACK,
    roughness: MATERIALS.TRACK_ROUGHNESS,
    metalness: MATERIALS.TRACK_METALNESS,
  });

  // Create curved track using multiple box segments
  const angleStep = (Math.PI / 2) / SEGMENTS;
  const segmentLength = (2 * Math.PI * radius * 0.25) / SEGMENTS;

  const meshes: THREE.Mesh[] = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const angle = angleStep * (i + 0.5);

    const geometry = new THREE.BoxGeometry(width, thickness, segmentLength * 1.1);
    const mesh = new THREE.Mesh(geometry, material);

    // Position on arc
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;
    mesh.rotation.y = -angle + Math.PI / 2;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    meshes.push(mesh);
    group.add(mesh);
  }

  context.scene.add(group);

  // Create physics body at group center
  const quatRotation = rapierRotationFromEulerDegrees(
    rotation[0],
    rotation[1],
    rotation[2]
  );

  const rigidBody = context.physics.createFixedBody(
    { x: data.position[0], y: data.position[1], z: data.position[2] },
    quatRotation
  );

  // Create box colliders for each segment
  const colliders: ReturnType<typeof context.physics.createBoxCollider>[] = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const angle = angleStep * (i + 0.5);
    const localX = Math.cos(angle) * radius;
    const localZ = Math.sin(angle) * radius;

    // Create rotated collider
    const segmentQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, -angle + Math.PI / 2, 0)
    );

    const collider = context.physics.createBoxCollider(
      rigidBody,
      { x: width / 2, y: thickness / 2, z: segmentLength * 0.55 },
      {
        friction: 0.8,
        restitution: 0.2,
        translation: { x: localX, y: 0, z: localZ },
      }
    );
    colliders.push(collider);
  }

  return {
    id: data.id,
    type: data.type,
    mesh: group,
    rigidBody,
    collider: colliders[0], // Return first collider as reference
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(group);
      meshes.forEach((m) => m.geometry.dispose());
      material.dispose();
    },
  };
}
