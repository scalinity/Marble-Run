import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, IceSurfaceParams } from '../types';
import { COLORS, PHYSICS } from '../../../config/constants';
import { rapierRotationFromEulerDegrees } from '../../../utils/math';

const DEFAULT_WIDTH = 4;
const DEFAULT_DEPTH = 4;
const DEFAULT_THICKNESS = 0.2;

/**
 * Create an ice surface with very low friction
 */
export function createIceSurface(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as IceSurfaceParams | undefined;
  const scale = data.scale ?? [1, 1, 1];
  const rotation = data.rotation ?? [0, 0, 0];

  const width = (params?.width ?? DEFAULT_WIDTH) * scale[0];
  const depth = (params?.depth ?? DEFAULT_DEPTH) * scale[2];
  const thickness = DEFAULT_THICKNESS * scale[1];

  // Create mesh with icy appearance
  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  const material = new THREE.MeshPhysicalMaterial({
    color: COLORS.ICE,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.3, // Slight transparency
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    ior: 1.31, // Refractive index of ice
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

  // Add subtle surface detail
  const detailGeometry = new THREE.PlaneGeometry(width * 0.9, depth * 0.9);
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    roughness: 0.1,
    metalness: 0,
  });
  const detail = new THREE.Mesh(detailGeometry, detailMaterial);
  detail.rotation.x = -Math.PI / 2;
  detail.position.y = thickness / 2 + 0.01;
  mesh.add(detail);

  context.scene.add(mesh);

  // Create physics body
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
    { x: width / 2, y: thickness / 2, z: depth / 2 },
    { friction: PHYSICS.ICE_FRICTION, restitution: 0.1 }
  );

  // Subtle shimmer animation
  let shimmerPhase = Math.random() * Math.PI * 2;

  const update = (dt: number, _elapsed: number): void => {
    shimmerPhase += dt * 0.5;
    // Subtle emissive shimmer
    const shimmer = (Math.sin(shimmerPhase) + 1) / 2;
    detailMaterial.opacity = 0.15 + shimmer * 0.1;
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
      detailGeometry.dispose();
      detailMaterial.dispose();
    },
  };
}
