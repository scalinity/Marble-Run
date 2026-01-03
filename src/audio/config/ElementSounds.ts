/**
 * Interactive element sound configurations
 * Defines trigger, anticipation, sustain, and release sounds for game elements
 */

export interface ElementSoundConfig {
  trigger?: string; // One-shot on trigger
  anticipation?: string; // Sound before trigger (proximity)
  sustain?: string; // Loop while active
  release?: string; // Sound when ending
  volume: number;
  spatial: boolean;
  cooldown?: number; // Min time between plays (seconds)
}

export const ELEMENT_SOUNDS: Record<string, ElementSoundConfig> = {
  // ============ COLLECTIBLES ============
  gem: {
    trigger: "gem",
    volume: 0.7,
    spatial: true,
  },
  checkpoint: {
    trigger: "checkpoint",
    sustain: "checkpoint_hum",
    volume: 0.6,
    spatial: true,
  },
  goalGate: {
    anticipation: "goal_pulse",
    trigger: "goal",
    volume: 0.8,
    spatial: true,
  },

  // ============ LAUNCHERS ============
  bouncePad: {
    trigger: "bounce",
    volume: 0.7,
    spatial: true,
    cooldown: 0.1,
  },
  teleporter: {
    trigger: "teleport",
    volume: 0.6,
    spatial: true,
    cooldown: 1.0,
  },

  // ============ HAZARDS ============
  spinnerHazard: {
    sustain: "spinner_whoosh",
    trigger: "hazard",
    volume: 0.7,
    spatial: true,
  },
  collapsingPlatform: {
    anticipation: "collapse",
    trigger: "collapse",
    volume: 0.6,
    spatial: true,
  },

  // ============ PLATFORMS ============
  movingPlatform: {
    sustain: "conveyor_hum",
    volume: 0.4,
    spatial: true,
  },
  rotatingPlatform: {
    sustain: "rotating_hum",
    volume: 0.4,
    spatial: true,
  },
  conveyorBelt: {
    sustain: "conveyor_hum",
    volume: 0.5,
    spatial: true,
  },

  // ============ SURFACES ============
  iceSurface: {
    trigger: "slide_ice",
    volume: 0.5,
    spatial: true,
  },

  // ============ POWER-UPS ============
  speedBoost: {
    trigger: "powerup",
    sustain: "speed_active",
    release: "powerup_expire",
    volume: 0.7,
    spatial: true,
  },
  doubleJump: {
    trigger: "powerup",
    release: "powerup_expire",
    volume: 0.7,
    spatial: true,
  },
  shield: {
    trigger: "powerup",
    sustain: "shield_hum",
    release: "powerup_expire",
    volume: 0.6,
    spatial: true,
  },
};

// Surface type to rolling sound mapping
export const SURFACE_ROLLING_SOUNDS: Record<string, string> = {
  track: "roll_track",
  trackStraight: "roll_track",
  trackTurn: "roll_track",
  ramp: "roll_track",
  platform: "roll_track",
  narrowBridge: "roll_track",
  movingPlatform: "roll_track",
  rotatingPlatform: "roll_metal",
  conveyorBelt: "roll_conveyor",
  iceSurface: "roll_ice",
  default: "roll_track",
};

// Impact sound mapping based on force threshold
export const IMPACT_SOUNDS = {
  light: "impact_light",
  medium: "impact_medium",
  heavy: "impact_heavy",
};

// Force thresholds for impact sounds
export const IMPACT_THRESHOLDS = {
  light: 0.2,
  medium: 0.5,
  heavy: 0.8,
};
