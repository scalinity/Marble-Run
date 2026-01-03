import * as THREE from "three";
import { PieceData, PieceContext, PieceInstance, GemParams } from "../types";
import { COLORS, MATERIALS } from "../../../config/constants";
import { TriggerType } from "../../CollisionHandler";
import { eventBus, GameEvents } from "../../../utils/EventBus";

const GEM_RADIUS = 0.25;
const ROTATION_SPEED = 2; // radians per second
const BOB_SPEED = 2;
const BOB_AMPLITUDE = 0.1;

// Elastic easing function for collection animation
function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Create a collectible gem
 */
export function createGem(
  data: PieceData,
  context: PieceContext,
): PieceInstance {
  const params = data.params as GemParams | undefined;
  const color = params?.color ?? COLORS.GEM;

  // Create group to hold gem and glow ring
  const group = new THREE.Group();
  group.position.set(data.position[0], data.position[1], data.position[2]);

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
  mesh.castShadow = true;
  group.add(mesh);

  // Add orbiting glow ring
  const glowRingGeo = new THREE.TorusGeometry(GEM_RADIUS * 1.5, 0.02, 8, 32);
  const glowRingMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
  group.add(glowRing);

  context.scene.add(group);

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
    { isSensor: true },
  );

  // Track if collected
  let collected = false;
  let collectAnimation = 0;

  // Collection callback
  const onCollect = () => {
    if (collected) return;
    collected = true;

    // Emit event with position and color for VFX
    eventBus.emit(GameEvents.GEM_COLLECTED, {
      id: data.id,
      position: group.position.clone(),
      color: new THREE.Color(color),
    });
  };

  // Register as trigger
  context.registerTrigger(collider.handle, TriggerType.GEM, data.id, onCollect);

  // Update function - rotation and bobbing
  const update = (dt: number, elapsed: number): void => {
    if (collected) {
      // Elastic collection animation
      collectAnimation += dt * 3;

      if (collectAnimation < 1) {
        // Elastic scale effect
        const elasticScale = easeOutElastic(collectAnimation);
        const scale = 1 + (elasticScale - 1) * 0.5; // Pop up then shrink
        group.scale.setScalar(Math.max(0, 2 - collectAnimation * 2) * scale);

        // Spiral upward
        group.position.y += dt * 3;
        group.rotation.y += dt * 15;
      } else {
        group.visible = false;
      }
      return;
    }

    // Rotate gem
    mesh.rotation.y += ROTATION_SPEED * dt;
    mesh.rotation.x = Math.sin(elapsed * 1.5) * 0.2;

    // Animate glow ring - orbits around gem
    glowRing.rotation.x = elapsed * 2;
    glowRing.rotation.y = elapsed * 1.5;

    // Bob up and down
    group.position.y = baseY + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;
  };

  return {
    id: data.id,
    type: data.type,
    mesh: group,
    rigidBody,
    collider,
    update,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(group);
      geometry.dispose();
      material.dispose();
      glowRingGeo.dispose();
      glowRingMat.dispose();
    },
  };
}
