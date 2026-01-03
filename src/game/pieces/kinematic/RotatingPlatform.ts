import * as THREE from "three";
import {
  PieceData,
  PieceContext,
  PieceInstance,
  RotatingPlatformParams,
} from "../types";
import { COLORS, PHYSICS } from "../../../config/constants";

const DEFAULT_SIZE = 4;
const DEFAULT_THICKNESS = 0.25;

/**
 * Create a platform that rotates around an axis
 */
export function createRotatingPlatform(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as RotatingPlatformParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const size = params?.size ?? DEFAULT_SIZE;
  const width = (params?.width ?? size) * scale[0];
  const depth = (params?.depth ?? size) * scale[2];
  const thickness = DEFAULT_THICKNESS * scale[1];
  const speed = params?.speed ?? PHYSICS.ROTATING_SPEED;
  const axis = params?.axis ?? "y";
  const isIce = params?.ice ?? false;

  // Create mesh
  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  const material = isIce
    ? new THREE.MeshPhysicalMaterial({
        color: COLORS.ICE,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.3,
        thickness: 0.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        ior: 1.31,
      })
    : new THREE.MeshStandardMaterial({
        color: COLORS.ROTATING,
        roughness: 0.5,
        metalness: 0.3,
        emissive: new THREE.Color(0x1a2a3a),
        emissiveIntensity: 0.2,
      });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  // Apply initial rotation
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add center pivot indicator
  const pivotGeometry = new THREE.CylinderGeometry(0.2, 0.2, thickness * 2, 16);
  const pivotMaterial = new THREE.MeshStandardMaterial({
    color: 0x444466,
    metalness: 0.6,
    roughness: 0.3,
  });
  const pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
  mesh.add(pivot);

  // Add direction arrows around edge
  const arrowGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
  const arrowMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaacc,
    emissive: new THREE.Color(0x666688),
    emissiveIntensity: 0.3,
  });

  const arrowCount = 4;
  for (let i = 0; i < arrowCount; i++) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    const angle = (i / arrowCount) * Math.PI * 2;
    const radius = Math.min(width, depth) * 0.35;

    arrow.position.x = Math.cos(angle) * radius;
    arrow.position.z = Math.sin(angle) * radius;
    arrow.position.y = thickness / 2 + 0.05;

    // Point tangent to rotation
    arrow.rotation.y = -angle + Math.PI / 2;
    if (speed < 0) arrow.rotation.y += Math.PI;
    arrow.rotation.x = Math.PI / 2;

    mesh.add(arrow);
  }

  context.scene.add(mesh);

  // Create kinematic physics body
  const rigidBody = context.physics.createKinematicBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: thickness / 2, z: depth / 2 },
    { friction: isIce ? PHYSICS.ICE_FRICTION : 0.9, restitution: 0.1 },
  );

  // Track current rotation angle
  let currentAngle = 0;
  const initialQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
    ),
  );

  const update = (dt: number, _elapsed: number): void => {
    currentAngle += speed * dt;

    // Create rotation quaternion for the animated axis
    const animQuat = new THREE.Quaternion();
    switch (axis) {
      case "x":
        animQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), currentAngle);
        break;
      case "y":
        animQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentAngle);
        break;
      case "z":
        animQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), currentAngle);
        break;
    }

    // Combine with initial rotation
    const finalQuat = initialQuat.clone().multiply(animQuat);

    // Update mesh
    mesh.quaternion.copy(finalQuat);

    // Update physics body
    rigidBody.setNextKinematicRotation({
      x: finalQuat.x,
      y: finalQuat.y,
      z: finalQuat.z,
      w: finalQuat.w,
    });

    // Pulse pivot glow (only for non-ice platforms)
    if (!isIce) {
      const pulse = (Math.sin(currentAngle * 2) + 1) / 2;
      (material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.15 + pulse * 0.1;
    }
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
      pivotGeometry.dispose();
      pivotMaterial.dispose();
      arrowGeometry.dispose();
      arrowMaterial.dispose();
    },
  };
}
