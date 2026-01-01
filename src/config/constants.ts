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
  MARBLE_FRICTION: 0.3, // Low friction - we control velocity directly
  MARBLE_RESTITUTION: 0.0, // No bounce = no momentum from collisions

  // Movement (velocity-based, no momentum)
  MAX_SPEED: 5,
  GROUND_SPEED: 5,
  AIR_CONTROL: 1.0, // Full air control (same as ground)
  LINEAR_DAMPING: 0, // No damping - we control velocity directly
  ANGULAR_DAMPING: 2, // Some spin damping for visual
  GRAVITY_SCALE: 1.5,

  // Jump
  JUMP_IMPULSE: 10,
  COYOTE_TIME: 0.15, // seconds - time after leaving ground you can still jump
  JUMP_BUFFER_TIME: 0.2, // seconds - time before landing that jump input is remembered
  GROUND_CHECK_DISTANCE: 0.15,
  MAX_SLOPE_ANGLE: 45, // degrees

  // World
  GRAVITY: { x: 0, y: -9.81, z: 0 },
  TIMESTEP: 1 / 60, // 60Hz fixed timestep
  MAX_SUBSTEPS: 5,

  // Respawn
  FALL_THRESHOLD: -20, // Y position below which marble respawns

  // Bounce Pads
  BOUNCE_PAD_FORCE: 15,
  BOUNCE_PAD_RESTITUTION: 1.8,

  // Ice Surfaces
  ICE_FRICTION: 0.02,

  // Conveyor Belts
  CONVEYOR_SPEED: 3,

  // Collapsing Platforms
  COLLAPSE_DELAY: 1.5, // seconds before collapse
  COLLAPSE_RESPAWN_TIME: 3.0, // seconds before platform respawns
  COLLAPSE_SHAKE_INTENSITY: 0.05,
  COLLAPSE_FALL_SPEED: 8,

  // Teleporters
  TELEPORT_COOLDOWN: 1.0, // seconds

  // Rotating Platforms
  ROTATING_SPEED: 1.0, // rad/sec
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

  // Starfield
  STARFIELD_COUNT: 2000,
  STARFIELD_MIN_RADIUS: 200,
  STARFIELD_MAX_RADIUS: 500,

  // Screen shake
  SCREEN_SHAKE_INTENSITY: 0.3,
  SCREEN_SHAKE_DURATION: 0.2,

  // Neon edges
  EDGE_COLOR: 0x00ffaa,
  EDGE_COLOR_ICE: 0x66ffff, // Icy cyan for ice surfaces
  EDGE_COLOR_BOUNCE: 0xff8844, // Orange for bounce pads (matches glow)
  EDGE_OPACITY: 0.6,
} as const;

// ============================================
// CAMERA CONSTANTS
// ============================================

export const CAMERA = {
  OFFSET: { x: 0, y: 12, z: 20 }, // Zoomed out for better visibility
  LOOK_OFFSET_Y: 0,
  FOLLOW_SMOOTHNESS: 8,
  MIN_DISTANCE: 5,
  MAX_DISTANCE: 30,
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

  // New pieces
  BOUNCE_PAD: 0xff8844,
  BOUNCE_PAD_GLOW: 0xffaa66,
  ICE: 0xaaeeff,
  CONVEYOR: 0x666688,
  CONVEYOR_ARROWS: 0xffff44,
  COLLAPSING: 0xaa6644,
  COLLAPSING_WARNING: 0xff4444,
  TELEPORTER: 0x8844ff,
  ROTATING: 0x6688aa,

  // Power-ups
  POWERUP_SPEED: 0xff8800,
  POWERUP_DOUBLE_JUMP: 0x00ffff,
  POWERUP_SHIELD: 0x4488ff,
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
// POWER-UP CONSTANTS
// ============================================

export const POWERUPS = {
  SPEED_BOOST_DURATION: 5, // seconds
  SPEED_BOOST_MULTIPLIER: 1.8,

  DOUBLE_JUMP_DURATION: 10, // seconds (time to use it)

  SHIELD_DURATION: 8, // seconds
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
