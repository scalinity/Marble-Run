import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance, TrackParams } from "../types";
import { COLORS, MATERIALS } from "../../../config/constants";
import { rapierRotationFromEulerDegrees } from "../../../utils/math";

const DEFAULT_LENGTH = 4;
const DEFAULT_WIDTH = 2;
const DEFAULT_THICKNESS = 0.2;

/**
 * Create a straight track segment
 */
export function createTrackStraight(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as TrackParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const length = (params?.length ?? DEFAULT_LENGTH) * scale[2];
  const width = (params?.width ?? DEFAULT_WIDTH) * scale[0];
  const thickness = DEFAULT_THICKNESS * scale[1];

  // Create mesh
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.TRACK,
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
    { x: width / 2, y: thickness / 2, z: length / 2 },
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
