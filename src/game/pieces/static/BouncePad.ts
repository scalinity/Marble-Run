import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, BouncePadParams } from '../types';
import { COLORS, PHYSICS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';
import { eventBus, GameEvents } from '../../../utils/EventBus';

const DEFAULT_RADIUS = 1.5;
const DEFAULT_HEIGHT = 0.15;
const PULSE_SPEED = 3;
const PULSE_INTENSITY = 0.3;

/**
 * Create a bounce pad that launches the marble upward
 */
export function createBouncePad(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as BouncePadParams | undefined;
  const radius = params?.radius ?? DEFAULT_RADIUS;
  const bounceForce = params?.bounceForce ?? PHYSICS.BOUNCE_PAD_FORCE;

  // Create cylinder mesh for the pad
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.9, DEFAULT_HEIGHT, 32);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.BOUNCE_PAD,
    roughness: 0.4,
    metalness: 0.6,
    emissive: new THREE.Color(COLORS.BOUNCE_PAD_GLOW),
    emissiveIntensity: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    data.position[0],
    data.position[1] + DEFAULT_HEIGHT / 2,
    data.position[2]
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add ring decoration
  const ringGeometry = new THREE.TorusGeometry(radius * 0.7, 0.05, 8, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.BOUNCE_PAD_GLOW,
    emissive: new THREE.Color(COLORS.BOUNCE_PAD_GLOW),
    emissiveIntensity: 0.8,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = DEFAULT_HEIGHT / 2 + 0.01;
  mesh.add(ring);

  context.scene.add(mesh);

  // Create physics body with sensor for trigger detection
  const rigidBody = context.physics.createFixedBody({
    x: data.position[0],
    y: data.position[1],
    z: data.position[2],
  });

  // Physical collider for the platform surface
  const platformCollider = context.physics.createCylinderCollider(
    rigidBody,
    DEFAULT_HEIGHT / 2,
    radius,
    { friction: 0.8, restitution: PHYSICS.BOUNCE_PAD_RESTITUTION }
  );

  // Sensor collider for trigger detection (slightly larger)
  const sensorCollider = context.physics.createCylinderCollider(
    rigidBody,
    DEFAULT_HEIGHT,
    radius * 1.1,
    { friction: 0, restitution: 0 }
  );
  // Make it a sensor - need to access the Rapier collider directly
  const world = context.physics.world;
  const sensor = world.getCollider(sensorCollider.handle);
  if (sensor) {
    sensor.setSensor(true);
  }

  // Track last bounce time for cooldown
  let lastBounceTime = 0;
  const BOUNCE_COOLDOWN = 0.2; // seconds

  // Bounce callback
  const onBounce = () => {
    const now = performance.now() / 1000;
    if (now - lastBounceTime < BOUNCE_COOLDOWN) return;
    lastBounceTime = now;

    eventBus.emit(GameEvents.BOUNCE_PAD_HIT, {
      id: data.id,
      force: bounceForce,
      position: data.position,
    });
  };

  // Register sensor as trigger
  context.registerTrigger(
    sensorCollider.handle,
    TriggerType.BOUNCE_PAD,
    data.id,
    onBounce
  );

  // Pulsing animation
  let pulsePhase = Math.random() * Math.PI * 2; // Random start phase

  const update = (dt: number, _elapsed: number): void => {
    pulsePhase += dt * PULSE_SPEED;
    const pulse = (Math.sin(pulsePhase) + 1) / 2; // 0 to 1

    // Pulse emissive intensity
    material.emissiveIntensity = 0.2 + pulse * PULSE_INTENSITY;
    ringMaterial.emissiveIntensity = 0.5 + pulse * 0.5;

    // Subtle scale pulse on ring
    ring.scale.setScalar(1 + pulse * 0.05);
  };

  return {
    id: data.id,
    type: data.type,
    mesh,
    rigidBody,
    collider: platformCollider,
    update,
    dispose: () => {
      context.physics.removeBody(rigidBody);
      context.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}
