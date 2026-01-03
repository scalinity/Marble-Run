/**
 * Audio settings management with localStorage persistence
 */

export interface AudioSettings {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  musicVolume: number; // 0-1
  ambientVolume: number; // 0-1
  muted: boolean;
  spatialAudioEnabled: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  ambientVolume: 0.6,
  muted: false,
  spatialAudioEnabled: true,
};

const STORAGE_KEY = "marble-run-audio-settings";

export function loadAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load audio settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save audio settings:", e);
  }
}

export function getDefaultSettings(): AudioSettings {
  return { ...DEFAULT_SETTINGS };
}
