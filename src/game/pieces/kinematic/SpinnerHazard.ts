import * as THREE from 'three';
import {
  PieceData,
  PieceContext,
  PieceInstance,
  SpinnerHazardParams,
} from '../types';
import { COLORS } from '../../../config/constants';

const DEFAULT_LENGTH = 3;
const DEFAULT_WIDTH = 0.4;
const DEFAULT_HEIGHT = 0.5;
const DEFAULT_SPEED = 2; // radians per second

/**
 * Create a spinning hazard that can knock the marble off
 */
export function createSpinnerHazard(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as SpinnerHazardParams | undefined;
  const scale = data.scale ?? [1, 1, 1];

  const length = DEFAULT_LENGTH * scale[0];
  const width = DEFAULT_WIDTH * scale[2];
  const height = DEFAULT_HEIGHT * scale[1];
  const speed = params?.speed ?? DEFAULT_SPEED;
  const axis = params?.axis ?? 'y';

  // Create mesh - a bar that spins
  const geometry = new THREE.BoxGeometry(length, height, width);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.HAZARD,
    roughness: 0.3,
    metalness: 0.6,
    emissive: new THREE.Color(COLORS.HAZARD),
    emissiveIntensity: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  mesh.castShadow = true;

  context.scene.add(mesh);

  // Create kinematic physics body
  const rigidBody = context.physics.createKinematicBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: length / 2, y: height / 2, z: width / 2 },
    { friction: 0.3, restitution: 0.6 }
  );

  // Rotation state
  let angle = 0;
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();

  // Update function
  const update = (dt: number, _elapsed: number): void => {
    angle += speed * dt;

    // Create rotation quaternion based on axis
    switch (axis) {
      case 'x':
        euler.set(angle, 0, 0);
        break;
      case 'y':
        euler.set(0, angle, 0);
        break;
      case 'z':
        euler.set(0, 0, angle);
        break;
    }

    quaternion.setFromEuler(euler);

    // Update physics body rotation
    rigidBody.setNextKinematicRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    });

    // Sync mesh
    mesh.quaternion.copy(quaternion);
  };

  return {
    id: data.id,
    type: data.type,
    mesh,
    rigidBody,
    collider,
    update,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
