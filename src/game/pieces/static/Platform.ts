import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance } from "../types";
import { COLORS, MATERIALS } from "../../../config/constants";
import { rapierRotationFromEulerDegrees } from "../../../utils/math";

const DEFAULT_SIZE = 3;
const DEFAULT_THICKNESS = 0.3;

/**
 * Create a platform (square surface)
 */
export function createPlatform(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const width = DEFAULT_SIZE * scale[0];
  const depth = DEFAULT_SIZE * scale[2];
  const thickness = DEFAULT_THICKNESS * scale[1];

  // Create mesh
  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.PLATFORM,
    roughness: MATERIALS.TRACK_ROUGHNESS,
    metalness: MATERIALS.TRACK_METALNESS,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  context.scene.add(mesh);

  // Create physics body
  const quatRotation = rapierRotationFromEulerDegrees(
    rotation[0],
    rotation[1],
    rotation[2],
  );

  const rigidBody = context.physics.createFixedBody(
    { x: data.position[0], y: data.position[1], z: data.position[2] },
    quatRotation,
  );

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: thickness / 2, z: depth / 2 },
    { friction: 0.8, restitution: 0.2 },
  );

  return {
    id: data.id,
    type: data.type,
    mesh,
    rigidBody,
    collider,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
