import * as THREE from 'three';
import { PieceData, PieceContext, PieceInstance, CollapsingPlatformParams } from '../types';
import { COLORS, PHYSICS } from '../../../config/constants';
import { TriggerType } from '../../CollisionHandler';
import { eventBus, GameEvents } from '../../../utils/EventBus';

const DEFAULT_SIZE = 2.5;
const DEFAULT_THICKNESS = 0.25;

enum CollapseState {
  IDLE,
  WARNING,
  FALLING,
  GONE,
  RESPAWNING,
}

/**
 * Create a platform that collapses when stepped on
 */
export function createCollapsingPlatform(
  data: PieceData,
  context: PieceContext
): PieceInstance {
  const params = data.params as CollapsingPlatformParams | undefined;
  const scale = data.scale ?? [1, 1, 1];

  const width = (params?.width ?? DEFAULT_SIZE) * scale[0];
  const depth = (params?.depth ?? DEFAULT_SIZE) * scale[2];
  const thickness = DEFAULT_THICKNESS * scale[1];
  const collapseDelay = params?.delay ?? PHYSICS.COLLAPSE_DELAY;
  const respawnTime = params?.respawnTime ?? PHYSICS.COLLAPSE_RESPAWN_TIME;

  // Store original position
  const originalPos = new THREE.Vector3(
    data.position[0],
    data.position[1],
    data.position[2]
  );

  // Create mesh
  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.COLLAPSING,
    roughness: 0.5,
    metalness: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(originalPos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add cracks/warning pattern
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: COLORS.COLLAPSING_WARNING,
    transparent: true,
    opacity: 0,
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  mesh.add(edges);

  context.scene.add(mesh);

  // Create kinematic physics body
  const rigidBody = context.physics.createKinematicBody({
    x: originalPos.x,
    y: originalPos.y,
    z: originalPos.z,
  });

  const collider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2, y: thickness / 2, z: depth / 2 },
    { friction: 0.8, restitution: 0.1 }
  );

  // Create sensor for detecting player contact
  const sensorCollider = context.physics.createBoxCollider(
    rigidBody,
    { x: width / 2 + 0.1, y: thickness / 2 + 0.3, z: depth / 2 + 0.1 },
    { isSensor: true }
  );
  const world = context.physics.world;
  const sensor = world.getCollider(sensorCollider.handle);
  if (sensor) {
    sensor.setSensor(true);
  }

  // State machine
  let state = CollapseState.IDLE;
  let stateTimer = 0;
  let shakeOffset = new THREE.Vector3();
  let fallVelocity = 0;

  // Colors for transitions
  const normalColor = new THREE.Color(COLORS.COLLAPSING);
  const warningColor = new THREE.Color(COLORS.COLLAPSING_WARNING);
  const currentColor = new THREE.Color(COLORS.COLLAPSING);

  const onPlayerContact = () => {
    if (state === CollapseState.IDLE) {
      state = CollapseState.WARNING;
      stateTimer = 0;
      eventBus.emit(GameEvents.PLATFORM_COLLAPSING, { id: data.id });
    }
  };

  // Register sensor as trigger
  context.registerTrigger(
    sensorCollider.handle,
    TriggerType.COLLAPSING_PLATFORM,
    data.id,
    onPlayerContact
  );

  const update = (dt: number, _elapsed: number): void => {
    stateTimer += dt;

    switch (state) {
      case CollapseState.IDLE:
        // Do nothing
        break;

      case CollapseState.WARNING:
        // Shake and change color
        const warningProgress = stateTimer / collapseDelay;
        const shakeIntensity =
          PHYSICS.COLLAPSE_SHAKE_INTENSITY * (1 + warningProgress * 2);

        shakeOffset.set(
          (Math.random() - 0.5) * shakeIntensity,
          (Math.random() - 0.5) * shakeIntensity * 0.5,
          (Math.random() - 0.5) * shakeIntensity
        );

        mesh.position.copy(originalPos).add(shakeOffset);
        rigidBody.setNextKinematicTranslation({
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        });

        // Interpolate color
        currentColor.lerpColors(normalColor, warningColor, warningProgress);
        material.color.copy(currentColor);
        edgeMaterial.opacity = warningProgress;

        if (stateTimer >= collapseDelay) {
          state = CollapseState.FALLING;
          stateTimer = 0;
          fallVelocity = 0;
          eventBus.emit(GameEvents.PLATFORM_FELL, { id: data.id });
        }
        break;

      case CollapseState.FALLING:
        // Fall with acceleration
        fallVelocity += PHYSICS.COLLAPSE_FALL_SPEED * dt;
        mesh.position.y -= fallVelocity * dt;

        // Rotate while falling
        mesh.rotation.x += dt * 2;
        mesh.rotation.z += dt * 1.5;

        // Fade out
        material.transparent = true;
        material.opacity = Math.max(0, 1 - stateTimer * 2);

        rigidBody.setNextKinematicTranslation({
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        });

        if (stateTimer >= 1) {
          state = CollapseState.GONE;
          stateTimer = 0;
          mesh.visible = false;
          // Move collider far away so it doesn't block anything
          rigidBody.setNextKinematicTranslation({ x: 0, y: -1000, z: 0 });
        }
        break;

      case CollapseState.GONE:
        if (stateTimer >= respawnTime) {
          state = CollapseState.RESPAWNING;
          stateTimer = 0;
        }
        break;

      case CollapseState.RESPAWNING:
        // Fade back in
        mesh.visible = true;
        mesh.position.copy(originalPos);
        mesh.rotation.set(0, 0, 0);

        material.opacity = Math.min(1, stateTimer * 2);
        material.color.copy(normalColor);
        edgeMaterial.opacity = 0;

        rigidBody.setNextKinematicTranslation({
          x: originalPos.x,
          y: originalPos.y,
          z: originalPos.z,
        });

        if (stateTimer >= 0.5) {
          state = CollapseState.IDLE;
          stateTimer = 0;
          material.transparent = false;
          material.opacity = 1;
        }
        break;
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
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    },
  };
}
