import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Piece types available in the game
 */
export type PieceType =
  // Static pieces
  | "trackStraight"
  | "trackTurn"
  | "ramp"
  | "platform"
  | "wall"
  | "narrowBridge"
  | "bouncePad"
  | "iceSurface"
  // Kinematic pieces
  | "movingPlatform"
  | "spinnerHazard"
  | "conveyorBelt"
  | "collapsingPlatform"
  | "rotatingPlatform"
  // Trigger pieces
  | "gem"
  | "goalGate"
  | "checkpoint"
  | "teleporter"
  | "speedBoost"
  | "doubleJump"
  | "shield";

/**
 * Piece data from level JSON
 */
export interface PieceData {
  id: string;
  type: PieceType;
  position: [number, number, number];
  rotation?: [number, number, number]; // Euler degrees
  scale?: [number, number, number];
  params?: Record<string, unknown>;
}

/**
 * Level definition
 */
export interface LevelDefinition {
  id: string;
  name: string;
  requireAllGems: boolean;
  spawnPoint: [number, number, number];
  pieces: PieceData[];
}

/**
 * Piece instance created from data
 */
export interface PieceInstance {
  id: string;
  type: PieceType;
  mesh: THREE.Object3D;
  rigidBody?: RAPIER.RigidBody;
  collider?: RAPIER.Collider;
  update?: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Piece factory interface
 */
export interface PieceFactory<T extends PieceData = PieceData> {
  create(data: T, context: PieceContext): PieceInstance;
}

/**
 * Context passed to piece factories
 */
export interface PieceContext {
  scene: THREE.Scene;
  physics: {
    world: RAPIER.World;
    createFixedBody: (
      position: { x: number; y: number; z: number },
      rotation?: { x: number; y: number; z: number; w: number },
    ) => RAPIER.RigidBody;
    createKinematicBody: (position: {
      x: number;
      y: number;
      z: number;
    }) => RAPIER.RigidBody;
    createBoxCollider: (
      body: RAPIER.RigidBody,
      halfExtents: { x: number; y: number; z: number },
      options?: {
        friction?: number;
        restitution?: number;
        isSensor?: boolean;
        translation?: { x: number; y: number; z: number };
      },
    ) => RAPIER.Collider;
    createCylinderCollider: (
      body: RAPIER.RigidBody,
      halfHeight: number,
      radius: number,
      options?: { friction?: number; restitution?: number; isSensor?: boolean },
    ) => RAPIER.Collider;
    removeBody: (body: RAPIER.RigidBody) => void;
  };
  registerTrigger: (
    colliderHandle: number,
    type: string,
    id: string,
    callback?: () => void,
    onExit?: () => void,
  ) => void;
  onCheckpoint?: (position: THREE.Vector3) => void;
  onGoalReached?: () => void;
}

// === Specific piece params ===

export interface MovingPlatformParams {
  waypoints: [number, number, number][];
  speed?: number;
  pauseDuration?: number;
}

export interface SpinnerHazardParams {
  axis?: "x" | "y" | "z";
  speed?: number;
  width?: number;
  height?: number;
  depth?: number;
}

export interface GemParams {
  color?: number;
}

export interface RampParams {
  length?: number;
  width?: number;
  angle?: number; // degrees
}

export interface TrackParams {
  length?: number;
  width?: number;
}

export interface TrackTurnParams {
  radius?: number;
  width?: number;
}

export interface WallParams {
  width?: number;
  height?: number;
  depth?: number;
}

export interface NarrowBridgeParams {
  length?: number;
  width?: number;
}

export interface BouncePadParams {
  radius?: number;
  bounceForce?: number;
}

export interface IceSurfaceParams {
  width?: number;
  depth?: number;
}

export interface ConveyorBeltParams {
  length?: number;
  width?: number;
  speed?: number;
  direction?: "forward" | "backward" | "left" | "right";
}

export interface CollapsingPlatformParams {
  width?: number;
  depth?: number;
  delay?: number;
  respawnTime?: number;
}

export interface RotatingPlatformParams {
  size?: number;
  width?: number;
  depth?: number;
  speed?: number;
  axis?: "x" | "y" | "z";
  ice?: boolean; // Make this platform an ice surface with low friction
}

export interface TeleporterParams {
  linkedId: string;
  color?: number;
  radius?: number;
}

export interface PowerUpParams {
  duration?: number;
}
