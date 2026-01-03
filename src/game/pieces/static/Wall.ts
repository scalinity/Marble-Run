import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance, WallParams } from "../types";
import { COLORS, MATERIALS } from "../../../config/constants";
import { rapierRotationFromEulerDegrees } from "../../../utils/math";

const DEFAULT_WIDTH = 4;
const DEFAULT_HEIGHT = 1.5;
const DEFAULT_DEPTH = 0.3;

/**
 * Create a wall/barrier
 */
export function createWall(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as WallParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const width = (params?.width ?? DEFAULT_WIDTH) * scale[0];
  const height = (params?.height ?? DEFAULT_HEIGHT) * scale[1];
  const depth = (params?.depth ?? DEFAULT_DEPTH) * scale[2];

  // Create mesh
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.WALL,
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
    { x: width / 2, y: height / 2, z: depth / 2 },
    { friction: 0.5, restitution: 0.3 },
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
