import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, TeleporterParams } from '../types';
import { COLORS, PHYSICS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';
import { teleporterRegistry } from '../../TeleporterRegistry';
import { eventBus, GameEvents } from '../../../utils/EventBus';

const DEFAULT_RADIUS = 0.8;
const DEFAULT_HEIGHT = 0.1;
const PORTAL_HEIGHT = 2;

/**
 * Create a teleporter that transports the marble to a linked teleporter
 */
export function createTeleporter(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as TeleporterParams | undefined;

  if (!params?.linkedId) {
    console.warn(`Teleporter ${data.id} missing linkedId parameter`);
  }

  const radius = params?.radius ?? DEFAULT_RADIUS;
  const color = params?.color ?? COLORS.TELEPORTER;
  const linkedId = params?.linkedId ?? '';

  const position = new THREE.Vector3(
    data.position[0],
    data.position[1],
    data.position[2]
  );

  // Register in teleporter registry
  teleporterRegistry.register(data.id, position, linkedId);

  // Create base pad
  const padGeometry = new THREE.CylinderGeometry(radius, radius, DEFAULT_HEIGHT, 32);
  const padMaterial = new THREE.MeshStandardMaterial({
    color: 0x222233,
    roughness: 0.3,
    metalness: 0.7,
  });
  const pad = new THREE.Mesh(padGeometry, padMaterial);
  pad.position.copy(position);
  pad.position.y += DEFAULT_HEIGHT / 2;
  pad.castShadow = true;
  pad.receiveShadow = true;

  // Create portal ring
  const ringGeometry = new THREE.TorusGeometry(radius * 0.8, 0.08, 16, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = DEFAULT_HEIGHT + 0.1;
  pad.add(ring);

  // Create vertical portal effect
  const portalGeometry = new THREE.CylinderGeometry(
    radius * 0.6,
    radius * 0.6,
    PORTAL_HEIGHT,
    16,
    1,
    true
  );
  const portalMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const portal = new THREE.Mesh(portalGeometry, portalMaterial);
  portal.position.y = DEFAULT_HEIGHT + PORTAL_HEIGHT / 2;
  pad.add(portal);

  // Create inner spiral particles
  const particleCount = 20;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 4;
    const height = (i / particleCount) * PORTAL_HEIGHT;
    const r = radius * 0.4 * (1 - height / PORTAL_HEIGHT * 0.5);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = DEFAULT_HEIGHT + height;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMaterial = new THREE.PointsMaterial({
    color: color,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  pad.add(particles);

  context.scene.add(pad);

  // Create physics body with sensor
  const rigidBody = context.physics.createFixedBody({
    x: position.x,
    y: position.y,
    z: position.z,
  });

  const collider = context.physics.createCylinderCollider(
    rigidBody,
    PORTAL_HEIGHT / 2,
    radius,
    { friction: 0, restitution: 0 }
  );

  // Make it a sensor
  const world = context.physics.world;
  const sensor = world.getCollider(collider.handle);
  if (sensor) {
    sensor.setSensor(true);
  }

  // Cooldown tracking
  let lastTeleportTime = 0;
  const TELEPORT_COOLDOWN = PHYSICS.TELEPORT_COOLDOWN;

  const onTeleport = () => {
    const now = performance.now() / 1000;
    if (now - lastTeleportTime < TELEPORT_COOLDOWN) return;

    const destination = teleporterRegistry.getDestination(data.id);
    if (!destination) return;

    lastTeleportTime = now;

    eventBus.emit(GameEvents.TELEPORT, {
      fromId: data.id,
      toId: linkedId,
      fromPosition: position,
      toPosition: destination,
    });
  };

  // Register as trigger
  context.registerTrigger(
    collider.handle,
    TriggerType.TELEPORTER,
    data.id,
    onTeleport
  );

  // Animation state
  let rotationPhase = Math.random() * Math.PI * 2;
  let particlePhase = 0;

  const update = (dt: number, _elapsed: number): void => {
    rotationPhase += dt * 2;
    particlePhase += dt * 3;

    // Rotate ring
    ring.rotation.z = rotationPhase;

    // Pulse portal opacity
    const pulse = (Math.sin(rotationPhase * 2) + 1) / 2;
    portalMaterial.opacity = 0.2 + pulse * 0.2;
    ringMaterial.emissiveIntensity = 0.6 + pulse * 0.4;

    // Animate particles upward
    const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      const baseAngle = (i / particleCount) * Math.PI * 4;
      const baseHeight = (i / particleCount) * PORTAL_HEIGHT;
      const animHeight = (baseHeight + particlePhase) % PORTAL_HEIGHT;
      const r = radius * 0.4 * (1 - animHeight / PORTAL_HEIGHT * 0.5);
      const angle = baseAngle + particlePhase;

      posAttr.setXYZ(
        i,
        Math.cos(angle) * r,
        DEFAULT_HEIGHT + animHeight,
        Math.sin(angle) * r
      );
    }
    posAttr.needsUpdate = true;
  };

  return {
    id: data.id,
    type: data.type,
    mesh: pad,
    rigidBody,
    collider,
    update,
    dispose: () => {
      teleporterRegistry.unregister(data.id);
      context.physics.removeBody(rigidBody);
      context.scene.remove(pad);
      padGeometry.dispose();
      padMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      portalGeometry.dispose();
      portalMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    },
  };
}
