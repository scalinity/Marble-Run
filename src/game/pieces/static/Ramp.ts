import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, RampParams } from '../types';
import { COLORS, MATERIALS } from '../../../config/constants';
import { rapierRotationFromEulerDegrees, degToRad } from '../../../utils/math';

const DEFAULT_LENGTH = 4;
const DEFAULT_WIDTH = 2;
const DEFAULT_ANGLE = 20; // degrees

/**
 * Create a ramp for gaining/losing height
 */
export function createRamp(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as RampParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const length = (params?.length ?? DEFAULT_LENGTH) * scale[2];
  const width = (params?.width ?? DEFAULT_WIDTH) * scale[0];
  const angle = params?.angle ?? DEFAULT_ANGLE;

  // Calculate ramp dimensions
  const rampAngleRad = degToRad(angle);
  const height = Math.sin(rampAngleRad) * length;
  const horizontalLength = Math.cos(rampAngleRad) * length;
  const thickness = 0.2;

  // Create ramp geometry
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.RAMP,
    roughness: MATERIALS.TRACK_ROUGHNESS,
    metalness: MATERIALS.TRACK_METALNESS,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Position and rotate - ramp tilts around X axis
  mesh.position.set(data.position[0], data.position[1], data.position[2]);

  // Apply base rotation from data
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]) + rampAngleRad,
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  context.scene.add(mesh);

  // Create physics body with combined rotation
  const euler = new THREE.Euler(
    degToRad(rotation[0]) + rampAngleRad,
    degToRad(rotation[1]),
    degToRad(rotation[2])
  );
  const quat = new THREE.Quaternion().setFromEuler(euler);

  const rigidBody = context.physics.createFixedBody(
    { x: data.position[0], y: data.position[1], z: data.position[2] },
    { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
  );

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: thickness / 2, z: length / 2 },
    { friction: 0.8, restitution: 0.2 }
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
