/**
 * Game configuration constants
 * All tuning values in one place for easy adjustment
 */

// ============================================
// PHYSICS CONSTANTS
// ============================================

export const PHYSICS = {
  // Marble properties
  MARBLE_RADIUS: 0.5,
  MARBLE_DENSITY: 2.5,
  MARBLE_FRICTION: 0.8,
  MARBLE_RESTITUTION: 0.3,

  // Movement
  MAX_SPEED: 8,
  GROUND_ACCELERATION: 25,
  AIR_ACCELERATION: 8,
  LINEAR_DAMPING: 3,
  ANGULAR_DAMPING: 2,
  GRAVITY_SCALE: 1.5,

  // Jump
  JUMP_IMPULSE: 8,
  COYOTE_TIME: 0.12, // seconds
  JUMP_BUFFER_TIME: 0.1,
  GROUND_CHECK_DISTANCE: 0.15,
  MAX_SLOPE_ANGLE: 45, // degrees

  // World
  GRAVITY: { x: 0, y: -9.81, z: 0 },
  TIMESTEP: 1 / 60, // 60Hz fixed timestep
  MAX_SUBSTEPS: 5,

  // Respawn
  FALL_THRESHOLD: -20, // Y position below which marble respawns
} as const;

// ============================================
// VFX CONSTANTS
// ============================================

export const VFX = {
  // Trail
  TRAIL_MAX_SEGMENTS: 50,
  TRAIL_DURATION: 0.8,
  TRAIL_MIN_VELOCITY: 0.5,
  TRAIL_WIDTH_START: 0.08,
  TRAIL_WIDTH_END: 0.01,
  TRAIL_SAMPLE_DISTANCE: 0.02,

  // Particles
  PARTICLE_POOL_SIZE: 150,
  GEM_PARTICLE_COUNT: 10,
  GOAL_PARTICLE_COUNT: 25,

  // Effects
  GEM_RING_DURATION: 300, // ms
  GOAL_FREEZE_DURATION: 800, // ms
} as const;

// ============================================
// CAMERA CONSTANTS
// ============================================

export const CAMERA = {
  OFFSET: { x: 0, y: 8, z: 12 },
  LOOK_OFFSET_Y: 1,
  FOLLOW_SMOOTHNESS: 8,
  MIN_DISTANCE: 3,
  MAX_DISTANCE: 20,
  FOV: 60,
  NEAR: 0.1,
  FAR: 1000,
} as const;

// ============================================
// VISUAL STYLE (Clean/Modern)
// ============================================

export const COLORS = {
  TRACK: 0x4a90a4,
  RAMP: 0x5aa4b8,
  PLATFORM: 0x3d7a8c,
  WALL: 0x2d5a6a,
  NARROW_BRIDGE: 0x4a8090,
  GEM: 0x44ff88,
  GOAL: 0xffdd44,
  HAZARD: 0xff4444,
  MARBLE: 0x4488ff,
  CHECKPOINT: 0x88aaff,
  CHECKPOINT_ACTIVE: 0x44ff88,
  BACKGROUND: 0x1a1a2e,
  AMBIENT_LIGHT: 0x404060,
  DIRECTIONAL_LIGHT: 0xffffff,
  TRAIL: 0x88ccff,
} as const;

export const MATERIALS = {
  TRACK_ROUGHNESS: 0.6,
  TRACK_METALNESS: 0.1,
  GEM_ROUGHNESS: 0.2,
  GEM_METALNESS: 0.8,
  MARBLE_ROUGHNESS: 0.4,
  MARBLE_METALNESS: 0.3,
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  TRANSITION_DURATION: 300, // ms
  RESULT_DELAY: 500, // ms after level complete before showing results
} as const;

// ============================================
// DEBUG
// ============================================

export const DEBUG = {
  SHOW_FPS: true,
  SHOW_PHYSICS_DEBUG: false,
  SHOW_COLLISION_SHAPES: false,
} as const;
