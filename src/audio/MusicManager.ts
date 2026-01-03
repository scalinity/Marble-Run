/**
 * Adaptive music system with stem-based mixing
 * Transitions between music states on musical boundaries
 */

export enum MusicState {
  MENU = "menu",
  EXPLORATION = "exploration",
  ACTION = "action",
  TENSION = "tension",
  VICTORY = "victory",
  FAILURE = "failure",
  SILENT = "silent",
}

interface MusicStem {
  name: string;
  url: string;
  states: MusicState[];
  baseVolume: number;
}

interface MusicTrack {
  id: string;
  stems: MusicStem[];
  bpm: number;
  beatsPerBar: number;
  transitionBars: number;
}

const MUSIC_TRACKS: Record<string, MusicTrack> = {
  main: {
    id: "main",
    bpm: 120,
    beatsPerBar: 4,
    transitionBars: 2,
    stems: [
      {
        name: "drums_light",
        url: "/audio/music/drums_light.webm",
        states: [MusicState.EXPLORATION, MusicState.MENU],
        baseVolume: 0.6,
      },
      {
        name: "drums_full",
        url: "/audio/music/drums_full.webm",
        states: [MusicState.ACTION, MusicState.TENSION],
        baseVolume: 0.7,
      },
      {
        name: "bass",
        url: "/audio/music/bass.webm",
        states: [MusicState.EXPLORATION, MusicState.ACTION, MusicState.TENSION],
        baseVolume: 0.5,
      },
      {
        name: "pad",
        url: "/audio/music/pad.webm",
        states: [MusicState.MENU, MusicState.EXPLORATION],
        baseVolume: 0.4,
      },
      {
        name: "lead",
        url: "/audio/music/lead.webm",
        states: [MusicState.ACTION],
        baseVolume: 0.5,
      },
      {
        name: "tension",
        url: "/audio/music/tension.webm",
        states: [MusicState.TENSION],
        baseVolume: 0.6,
      },
    ],
  },
  menu: {
    id: "menu",
    bpm: 100,
    beatsPerBar: 4,
    transitionBars: 4,
    stems: [
      {
        name: "menu_loop",
        url: "/audio/music/menu.webm",
        states: [MusicState.MENU],
        baseVolume: 0.5,
      },
    ],
  },
};

export class MusicManager {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  // Active track state
  private currentTrack: MusicTrack | null = null;
  private stemSources: Map<string, AudioBufferSourceNode> = new Map();
  private stemGains: Map<string, GainNode> = new Map();

  // Timing
  private startTime: number = 0;
  private currentState: MusicState = MusicState.SILENT;
  private targetState: MusicState = MusicState.SILENT;
  private transitionScheduled: boolean = false;
  private transitionTimeout: number | null = null;
  private pendingTimeouts: Set<number> = new Set();

  // Intensity (0-1) affects stem mixing
  private intensity: number = 0;
  private targetIntensity: number = 0;
  private readonly INTENSITY_LERP = 0.02;

  async init(context: AudioContext, output: GainNode): Promise<void> {
    this.context = context;
    this.output = output;
    await this.loadAllTracks();
  }

  private async loadAllTracks(): Promise<void> {
    if (!this.context) return;

    const loadPromises: Promise<void>[] = [];

    for (const track of Object.values(MUSIC_TRACKS)) {
      for (const stem of track.stems) {
        loadPromises.push(this.loadStem(stem.name, stem.url));
      }
    }

    await Promise.allSettled(loadPromises);
  }

  private async loadStem(name: string, url: string): Promise<void> {
    if (!this.context) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch {
      console.debug(`MusicManager: Failed to load stem: ${url}`);
    }
  }

  /**
   * Start playing a music track
   */
  playTrack(trackId: string): void {
    if (!this.context || !this.output) return;

    const track = MUSIC_TRACKS[trackId];
    if (!track) {
      console.warn(`MusicManager: Track not found: ${trackId}`);
      return;
    }

    // Stop current track if playing
    this.stop(0.5);

    // Wait for fade out before starting new track
    const timeoutId = window.setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      this.startTrack(track);
    }, 600);
    this.pendingTimeouts.add(timeoutId);
  }

  private startTrack(track: MusicTrack): void {
    if (!this.context || !this.output) return;

    this.currentTrack = track;
    this.startTime = this.context.currentTime;

    // Start all stems at same time (synchronized)
    for (const stem of track.stems) {
      const buffer = this.buffers.get(stem.name);
      if (!buffer) continue;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = this.context.createGain();
      gain.gain.value = this.getStemVolume(stem);

      source.connect(gain);
      gain.connect(this.output);

      source.start(this.startTime);

      this.stemSources.set(stem.name, source);
      this.stemGains.set(stem.name, gain);
    }
  }

  /**
   * Request a state transition
   */
  setState(state: MusicState): void {
    if (state === this.currentState && state === this.targetState) return;

    this.targetState = state;

    if (!this.transitionScheduled) {
      this.scheduleTransition();
    }
  }

  /**
   * Set gameplay intensity (0-1)
   */
  setIntensity(intensity: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Get current music state
   */
  getState(): MusicState {
    return this.currentState;
  }

  /**
   * Update music system (call every frame)
   */
  update(dt: number): void {
    // Lerp intensity
    this.intensity +=
      (this.targetIntensity - this.intensity) * this.INTENSITY_LERP;

    // Update stem volumes based on current state and intensity
    if (this.currentTrack && this.context) {
      for (const stem of this.currentTrack.stems) {
        const gain = this.stemGains.get(stem.name);
        if (gain) {
          const targetVolume = this.getStemVolume(stem);
          gain.gain.setTargetAtTime(
            targetVolume,
            this.context.currentTime,
            0.5,
          );
        }
      }
    }
  }

  /**
   * Schedule state transition on next bar boundary
   */
  private scheduleTransition(): void {
    if (!this.currentTrack || !this.context) {
      // No track playing, transition immediately
      this.currentState = this.targetState;
      return;
    }

    const track = this.currentTrack;
    const barDuration = (60 / track.bpm) * track.beatsPerBar;
    const elapsed = this.context.currentTime - this.startTime;
    const currentBar = Math.floor(elapsed / barDuration);
    const nextTransitionBar = currentBar + track.transitionBars;
    const transitionTime = this.startTime + nextTransitionBar * barDuration;
    const delayMs = Math.max(
      0,
      (transitionTime - this.context.currentTime) * 1000,
    );

    this.transitionScheduled = true;

    // Clear existing timeout
    if (this.transitionTimeout !== null) {
      clearTimeout(this.transitionTimeout);
    }

    this.transitionTimeout = window.setTimeout(() => {
      this.currentState = this.targetState;
      this.transitionScheduled = false;
      this.transitionTimeout = null;

      // Check if state changed again during wait
      if (this.targetState !== this.currentState) {
        this.scheduleTransition();
      }
    }, delayMs);
  }

  /**
   * Calculate stem volume based on state and intensity
   */
  private getStemVolume(stem: MusicStem): number {
    const isActive = stem.states.includes(this.currentState);
    if (!isActive) return 0;

    let volume = stem.baseVolume;

    // Action stems increase with intensity
    if (stem.states.includes(MusicState.ACTION)) {
      volume *= 0.5 + this.intensity * 0.5;
    }

    // Exploration stems decrease with intensity
    if (
      stem.states.includes(MusicState.EXPLORATION) &&
      !stem.states.includes(MusicState.ACTION)
    ) {
      volume *= 1 - this.intensity * 0.3;
    }

    return volume;
  }

  /**
   * Play a stinger sound
   */
  playStinger(stingerId: string): void {
    // Stingers are handled by SFXManager - this is just for compatibility
    console.debug(`MusicManager: Stinger requested: ${stingerId}`);
  }

  /**
   * Stop music with fadeout
   */
  stop(fadeTime: number = 1): void {
    if (!this.context) return;

    const now = this.context.currentTime;

    for (const gain of this.stemGains.values()) {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeTime);
    }

    const cleanupTimeoutId = window.setTimeout(
      () => {
        this.pendingTimeouts.delete(cleanupTimeoutId);
        for (const source of this.stemSources.values()) {
          try {
            source.stop();
          } catch {
            // Already stopped
          }
          source.disconnect();
        }
        this.stemSources.clear();

        for (const gain of this.stemGains.values()) {
          gain.disconnect();
        }
        this.stemGains.clear();

        this.currentTrack = null;
        this.currentState = MusicState.SILENT;
        this.targetState = MusicState.SILENT;
      },
      fadeTime * 1000 + 100,
    );
    this.pendingTimeouts.add(cleanupTimeoutId);
  }

  dispose(): void {
    // Clear all pending timeouts
    if (this.transitionTimeout !== null) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();

    this.stop(0);
    this.buffers.clear();
    this.context = null;
    this.output = null;
  }
}
