/**
 * Sound effect configurations
 * Maps sound names to their file URLs and default volumes
 */

import { SFXConfig } from "../SFXManager";

export const SOUND_CONFIGS: Record<string, SFXConfig> = {
  // ============ PLAYER ACTIONS ============
  jump: { url: "/audio/jump.webm", volume: 0.6 },
  land: { url: "/audio/land.webm", volume: 0.4 },
  respawn: { url: "/audio/respawn.webm", volume: 0.5 },

  // ============ COLLECTIBLES ============
  gem: { url: "/audio/gem.webm", volume: 0.7 },
  checkpoint: { url: "/audio/checkpoint.webm", volume: 0.6 },
  goal: { url: "/audio/goal.webm", volume: 0.8 },

  // ============ INTERACTIVE ELEMENTS ============
  bounce: { url: "/audio/bounce.webm", volume: 0.7 },
  teleport: { url: "/audio/teleport.webm", volume: 0.6 },
  collapse: { url: "/audio/collapse.webm", volume: 0.6 },
  hazard: { url: "/audio/hazard.webm", volume: 0.7 },
  powerup: { url: "/audio/powerup.webm", volume: 0.7 },
  powerup_expire: { url: "/audio/powerup_expire.webm", volume: 0.4 },
  level_start: { url: "/audio/level_start.webm", volume: 0.5 },

  // ============ ROLLING SOUNDS ============
  roll_track: { url: "/audio/roll_track.webm", volume: 0.5 },
  roll_metal: { url: "/audio/roll_metal.webm", volume: 0.6 },
  roll_ice: { url: "/audio/roll_ice.webm", volume: 0.4 },
  roll_conveyor: { url: "/audio/roll_conveyor.webm", volume: 0.5 },

  // ============ IMPACT SOUNDS ============
  impact_light: { url: "/audio/impact_light.webm", volume: 0.3 },
  impact_medium: { url: "/audio/impact_medium.webm", volume: 0.5 },
  impact_heavy: { url: "/audio/impact_heavy.webm", volume: 0.7 },

  // ============ SLIDE SOUNDS ============
  slide_ice: { url: "/audio/slide_ice.webm", volume: 0.4 },
  slide_slope: { url: "/audio/slide_slope.webm", volume: 0.4 },

  // ============ AMBIENT ELEMENT SOUNDS ============
  conveyor_hum: { url: "/audio/conveyor_hum.webm", volume: 0.4 },
  spinner_whoosh: { url: "/audio/spinner_whoosh.webm", volume: 0.5 },
  rotating_hum: { url: "/audio/rotating_hum.webm", volume: 0.4 },
  checkpoint_hum: { url: "/audio/checkpoint_hum.webm", volume: 0.3 },
  goal_pulse: { url: "/audio/goal_pulse.webm", volume: 0.4 },
  shield_hum: { url: "/audio/shield_hum.webm", volume: 0.3 },
  speed_active: { url: "/audio/speed_active.webm", volume: 0.3 },

  // ============ UI SOUNDS ============
  ui_click: { url: "/audio/ui_click.webm", volume: 0.5 },
  ui_hover: { url: "/audio/ui_hover.webm", volume: 0.3 },
  ui_back: { url: "/audio/ui_back.webm", volume: 0.4 },
  ui_menu_open: { url: "/audio/ui_menu_open.webm", volume: 0.5 },
  ui_menu_close: { url: "/audio/ui_menu_close.webm", volume: 0.4 },
  ui_notification: { url: "/audio/ui_notification.webm", volume: 0.5 },

  // ============ FEEDBACK SOUNDS ============
  feedback_combo: { url: "/audio/feedback_combo.webm", volume: 0.5 },
  feedback_near_miss: { url: "/audio/feedback_near_miss.webm", volume: 0.4 },

  // ============ STINGERS ============
  stinger_victory: { url: "/audio/stinger_victory.webm", volume: 0.8 },
  stinger_fall: { url: "/audio/stinger_fall.webm", volume: 0.6 },
  stinger_death: { url: "/audio/stinger_death.webm", volume: 0.6 },
};

// Ambient base layers
export const AMBIENT_CONFIGS: Record<string, SFXConfig> = {
  amb_space: { url: "/audio/amb_space.webm", volume: 0.3 },
  amb_wind: { url: "/audio/amb_wind.webm", volume: 0.2 },
  amb_industrial: { url: "/audio/amb_industrial.webm", volume: 0.25 },
};

// Music stems
export const MUSIC_CONFIGS: Record<string, SFXConfig> = {
  music_drums_light: { url: "/audio/music/drums_light.webm", volume: 0.6 },
  music_drums_full: { url: "/audio/music/drums_full.webm", volume: 0.7 },
  music_bass: { url: "/audio/music/bass.webm", volume: 0.5 },
  music_pad: { url: "/audio/music/pad.webm", volume: 0.4 },
  music_lead: { url: "/audio/music/lead.webm", volume: 0.5 },
  music_tension: { url: "/audio/music/tension.webm", volume: 0.6 },
  music_menu: { url: "/audio/music/menu.webm", volume: 0.5 },
};
