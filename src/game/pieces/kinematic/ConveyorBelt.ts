import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, ConveyorBeltParams } from '../types';
import { COLORS, PHYSICS } from '../../../config/constants';
import { platformVelocityRegistry } from '../../PlatformVelocityRegistry';
import { rapierRotationFromEulerDegrees } from '../../../utils/math';

const DEFAULT_LENGTH = 4;
const DEFAULT_WIDTH = 2;
const DEFAULT_THICKNESS = 0.15;

/**
 * Create a conveyor belt that pushes the marble in a direction
 */
export function createConveyorBelt(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as ConveyorBeltParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const length = (params?.length ?? DEFAULT_LENGTH) * scale[2];
  const width = (params?.width ?? DEFAULT_WIDTH) * scale[0];
  const thickness = DEFAULT_THICKNESS * scale[1];
  const speed = params?.speed ?? PHYSICS.CONVEYOR_SPEED;
  const direction = params?.direction ?? 'forward';

  // Calculate velocity vector based on direction and rotation
  const directionVectors: Record<string, THREE.Vector3> = {
    forward: new THREE.Vector3(0, 0, -1),
    backward: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
  };

  const velocityDir = directionVectors[direction].clone();
  // Apply rotation to velocity direction
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );
  velocityDir.applyEuler(euler);
  velocityDir.multiplyScalar(speed);

  // Create belt surface mesh
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.CONVEYOR,
    roughness: 0.6,
    metalness: 0.4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Create arrow indicators
  const arrowGroup = new THREE.Group();
  const arrowCount = Math.floor(length / 1.5);
  const arrowGeometry = new THREE.ConeGeometry(0.15, 0.4, 4);
  const arrowMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.CONVEYOR_ARROWS,
    emissive: new THREE.Color(COLORS.CONVEYOR_ARROWS),
    emissiveIntensity: 0.3,
  });

  for (let i = 0; i < arrowCount; i++) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    if (direction === 'backward') arrow.rotation.x = -Math.PI / 2;
    if (direction === 'left') {
      arrow.rotation.x = 0;
      arrow.rotation.z = Math.PI / 2;
    }
    if (direction === 'right') {
      arrow.rotation.x = 0;
      arrow.rotation.z = -Math.PI / 2;
    }

    // Position along belt
    const offset = (i / (arrowCount - 1 || 1) - 0.5) * (length * 0.8);
    arrow.position.set(0, thickness / 2 + 0.1, offset);
    arrowGroup.add(arrow);
  }

  mesh.add(arrowGroup);
  context.scene.add(mesh);

  // Create physics body (fixed - belt doesn't move, it just registers velocity)
  const quatRotation = rapierRotationFromEulerDegrees(
    rotation[0],
    rotation[1],
    rotation[2]
  );

  const rigidBody = context.physics.createFixedBody(
    { x: data.position[0], y: data.position[1], z: data.position[2] },
    quatRotation
  );

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: thickness / 2, z: length / 2 },
    { friction: 0.9, restitution: 0.1 }
  );

  // Register constant velocity
  const velocity = {
    x: velocityDir.x,
    y: velocityDir.y,
    z: velocityDir.z,
  };
  platformVelocityRegistry.set(collider.handle, velocity);

  // Arrow animation phase
  let arrowPhase = 0;
  const arrowAnimSpeed = speed * 0.5;

  const update = (dt: number, _elapsed: number): void => {
    // Animate arrows moving in direction
    arrowPhase += dt * arrowAnimSpeed;
    arrowGroup.children.forEach((arrow, i) => {
      const baseOffset = (i / (arrowCount - 1 || 1) - 0.5) * (length * 0.8);
      const animOffset = ((arrowPhase % 1.5) - 0.75);

      if (direction === 'forward' || direction === 'backward') {
        const dir = direction === 'forward' ? -1 : 1;
        arrow.position.z = baseOffset + animOffset * dir;
      } else {
        const dir = direction === 'left' ? -1 : 1;
        arrow.position.x = animOffset * dir;
      }
    });

    // Pulse arrow glow
    const pulse = (Math.sin(arrowPhase * 4) + 1) / 2;
    arrowMaterial.emissiveIntensity = 0.2 + pulse * 0.3;
  };

  return {
    id: data.id,
    type: data.type,
    mesh,
    rigidBody,
    collider,
    update,
    dispose: () => {
      platformVelocityRegistry.remove(collider.handle);
      context.physics.removeBody(rigidBody);
      context.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      arrowGeometry.dispose();
      arrowMaterial.dispose();
    },
  };
}
