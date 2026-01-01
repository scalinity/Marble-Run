import * as THREE from 'three';
import {
  PieceData,
  PieceContext,
  PieceInstance,
  MovingPlatformParams,
} from '../types';
import { COLORS, MATERIALS } from '../../../config/constants';
import { platformVelocityRegistry } from '../../PlatformVelocityRegistry';

const DEFAULT_SIZE = 2.5;
const DEFAULT_THICKNESS = 0.25;
const DEFAULT_SPEED = 2;
const DEFAULT_PAUSE = 0.5;

/**
 * Create a moving platform that travels between waypoints
 */
export function createMovingPlatform(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as MovingPlatformParams | undefined;
  const scale = data.scale ?? [1, 1, 1];

  const size = DEFAULT_SIZE * scale[0];
  const thickness = DEFAULT_THICKNESS * scale[1];
  const speed = params?.speed ?? DEFAULT_SPEED;
  const pauseDuration = params?.pauseDuration ?? DEFAULT_PAUSE;

  // Parse waypoints (relative to initial position)
  const waypoints: THREE.Vector3[] = [
    new THREE.Vector3(data.position[0], data.position[1], data.position[2]),
  ];

  if (params?.waypoints) {
    params.waypoints.forEach((wp) => {
      waypoints.push(new THREE.Vector3(wp[0], wp[1], wp[2]));
    });
  } else {
    // Default: move up and down 2 units
    waypoints.push(
      new THREE.Vector3(
        data.position[0],
        data.position[1] + 2,
        data.position[2]
      )
    );
  }

  // Create mesh
  const geometry = new THREE.BoxGeometry(size, thickness, size);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.PLATFORM,
    roughness: MATERIALS.TRACK_ROUGHNESS,
    metalness: MATERIALS.TRACK_METALNESS,
    emissive: new THREE.Color(0x1a3040),
    emissiveIntensity: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(waypoints[0]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  context.scene.add(mesh);

  // Create kinematic physics body
  const rigidBody = context.physics.createKinematicBody({
    x: waypoints[0].x,
    y: waypoints[0].y,
    z: waypoints[0].z,
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: size / 2, y: thickness / 2, z: size / 2 },
    { friction: 0.9, restitution: 0.1 }
  );

  // Movement state
  let currentWaypointIndex = 0;
  let nextWaypointIndex = 1;
  let progress = 0;
  let pauseTimer = 0;
  let isPaused = false;

  const currentPos = new THREE.Vector3();
  const prevPos = new THREE.Vector3().copy(waypoints[0]);
  const startPos = new THREE.Vector3();
  const endPos = new THREE.Vector3();
  const velocity = { x: 0, y: 0, z: 0 };

  // Update function
  const update = (dt: number, _elapsed: number): void => {
    // Store previous position for velocity calculation
    prevPos.copy(currentPos.lengthSq() > 0 ? currentPos : waypoints[0]);

    if (isPaused) {
      pauseTimer -= dt;
      if (pauseTimer <= 0) {
        isPaused = false;
        // Move to next waypoint
        currentWaypointIndex = nextWaypointIndex;
        nextWaypointIndex = (nextWaypointIndex + 1) % waypoints.length;
        progress = 0;
      }
      // Platform not moving while paused
      velocity.x = 0;
      velocity.y = 0;
      velocity.z = 0;
      platformVelocityRegistry.set(collider.handle, velocity);
      return;
    }

    startPos.copy(waypoints[currentWaypointIndex]);
    endPos.copy(waypoints[nextWaypointIndex]);

    const distance = startPos.distanceTo(endPos);
    const travelTime = distance / speed;

    progress += dt / travelTime;

    if (progress >= 1) {
      progress = 1;
      isPaused = true;
      pauseTimer = pauseDuration;
    }

    // Smooth step interpolation
    const t = smoothstep(progress);
    currentPos.lerpVectors(startPos, endPos, t);

    // Calculate velocity from position change
    if (dt > 0) {
      velocity.x = (currentPos.x - prevPos.x) / dt;
      velocity.y = (currentPos.y - prevPos.y) / dt;
      velocity.z = (currentPos.z - prevPos.z) / dt;
    }

    // Register velocity for PlayerController
    platformVelocityRegistry.set(collider.handle, velocity);

    // Update physics body using setNextKinematicTranslation
    rigidBody.setNextKinematicTranslation({
      x: currentPos.x,
      y: currentPos.y,
      z: currentPos.z,
    });

    // Sync mesh
    mesh.position.copy(currentPos);
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
    },
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
