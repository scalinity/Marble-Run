import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, GemParams } from '../types';
import { COLORS, MATERIALS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';

const GEM_RADIUS = 0.25;
const ROTATION_SPEED = 2; // radians per second
const BOB_SPEED = 2;
const BOB_AMPLITUDE = 0.1;

/**
 * Create a collectible gem
 */
export function createGem(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as GemParams | undefined;
  const color = params?.color ?? COLORS.GEM;

  // Create octahedron geometry for gem shape
  const geometry = new THREE.OctahedronGeometry(GEM_RADIUS);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: MATERIALS.GEM_ROUGHNESS,
    metalness: MATERIALS.GEM_METALNESS,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(data.position[0], data.position[1], data.position[2]);
  mesh.castShadow = true;

  context.scene.add(mesh);

  // Store base Y position for bobbing
  const baseY = data.position[1];

  // Create fixed body with sensor collider
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: GEM_RADIUS * 1.5, y: GEM_RADIUS * 1.5, z: GEM_RADIUS * 1.5 },
    { isSensor: true }
  );

  // Track if collected
  let collected = false;
  let collectAnimation = 0;

  // Collection callback
  const onCollect = () => {
    if (collected) return;
    collected = true;
  };

  // Register as trigger
  context.registerTrigger(
    collider.handle,
    TriggerType.GEM,
    data.id,
    onCollect
  );

  // Update function - rotation and bobbing
  const update = (dt: number, elapsed: number): void => {
    if (collected) {
      // Shrink and fade out
      collectAnimation += dt * 5;
      const scale = Math.max(0, 1 - collectAnimation);
      mesh.scale.setScalar(scale);

      if (collectAnimation >= 1) {
        mesh.visible = false;
      }
      return;
    }

    // Rotate
    mesh.rotation.y += ROTATION_SPEED * dt;
    mesh.rotation.x = Math.sin(elapsed * 1.5) * 0.2;

    // Bob up and down
    mesh.position.y = baseY + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;
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
