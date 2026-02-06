/**
 * Procedural audio generator using Web Audio API
 * Generates synthesized sound effects without external files
 */

export class ProceduralAudio {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Generate all game sound buffers
   */
  generateAll(): Map<string, AudioBuffer> {
    const buffers = new Map<string, AudioBuffer>();

    // Player actions
    buffers.set("jump", this.generateJump());
    buffers.set("land", this.generateLand());
    buffers.set("respawn", this.generateRespawn());

    // Collectibles
    buffers.set("gem", this.generateGem());
    buffers.set("checkpoint", this.generateCheckpoint());
    buffers.set("goal", this.generateGoal());

    // Interactive elements
    buffers.set("bounce", this.generateBounce());
    buffers.set("teleport", this.generateTeleport());
    buffers.set("collapse", this.generateCollapse());
    buffers.set("hazard", this.generateHazard());
    buffers.set("powerup", this.generatePowerup());
    buffers.set("powerup_expire", this.generatePowerupExpire());
    buffers.set("level_start", this.generateLevelStart());

    // Rolling sounds (loopable)
    buffers.set("roll_track", this.generateRoll(200, 0.5));
    buffers.set("roll_metal", this.generateRoll(300, 0.6));
    buffers.set("roll_ice", this.generateRoll(150, 0.3));
    buffers.set("roll_conveyor", this.generateRoll(250, 0.5));

    // Impact sounds
    buffers.set("impact_light", this.generateImpact(0.3));
    buffers.set("impact_medium", this.generateImpact(0.6));
    buffers.set("impact_heavy", this.generateImpact(1.0));

    // Slide sounds
    buffers.set("slide_ice", this.generateSlide(400));
    buffers.set("slide_slope", this.generateSlide(300));

    // Ambient element sounds (loopable)
    buffers.set("conveyor_hum", this.generateHum(80, 1.0));
    buffers.set("spinner_whoosh", this.generateWhoosh());
    buffers.set("rotating_hum", this.generateHum(60, 1.0));
    buffers.set("checkpoint_hum", this.generateHum(220, 0.5));
    buffers.set("goal_pulse", this.generatePulse());
    buffers.set("shield_hum", this.generateHum(180, 0.5));
    buffers.set("speed_active", this.generateSpeedActive());

    // UI sounds
    buffers.set("ui_click", this.generateUIClick());
    buffers.set("ui_hover", this.generateUIHover());
    buffers.set("ui_back", this.generateUIBack());
    buffers.set("ui_menu_open", this.generateUIMenuOpen());
    buffers.set("ui_menu_close", this.generateUIMenuClose());
    buffers.set("ui_notification", this.generateUINotification());

    // Feedback sounds
    buffers.set("feedback_combo", this.generateCombo());
    buffers.set("feedback_near_miss", this.generateNearMiss());

    // Stingers
    buffers.set("stinger_victory", this.generateVictoryStinger());
    buffers.set("stinger_fall", this.generateFallStinger());
    buffers.set("stinger_death", this.generateDeathStinger());

    // Ambient layers (longer looping sounds)
    buffers.set("amb_space", this.generateAmbientSpace());
    buffers.set("amb_wind", this.generateAmbientWind());
    buffers.set("amb_industrial", this.generateAmbientIndustrial());

    return buffers;
  }

  // ============ Helper Methods ============

  private createBuffer(duration: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = Math.floor(sampleRate * duration);
    return this.context.createBuffer(1, length, sampleRate);
  }

  private createStereoBuffer(duration: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = Math.floor(sampleRate * duration);
    return this.context.createBuffer(2, length, sampleRate);
  }

  private noise(): number {
    return Math.random() * 2 - 1;
  }

  private sine(phase: number): number {
    return Math.sin(phase * Math.PI * 2);
  }

  private saw(phase: number): number {
    return (phase % 1) * 2 - 1;
  }

  private square(phase: number): number {
    return phase % 1 < 0.5 ? 1 : -1;
  }

  private triangle(phase: number): number {
    const t = phase % 1;
    return t < 0.5 ? t * 4 - 1 : 3 - t * 4;
  }

  private envelope(
    t: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    duration: number,
  ): number {
    if (t < attack) {
      return t / attack;
    } else if (t < attack + decay) {
      return 1 - ((t - attack) / decay) * (1 - sustain);
    } else if (t < duration - release) {
      return sustain;
    } else {
      return sustain * (1 - (t - (duration - release)) / release);
    }
  }

  private expDecay(t: number, decay: number): number {
    return Math.exp(-t * decay);
  }

  // ============ Sound Generators ============

  private generateJump(): AudioBuffer {
    const duration = 0.15;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Rising pitch sweep
      const freq = 200 + t * 800;
      const phase = t * freq;
      const env = this.expDecay(t, 15);
      data[i] = this.sine(phase) * env * 0.5;
    }
    return buffer;
  }

  private generateLand(): AudioBuffer {
    const duration = 0.1;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Thump with noise
      const freq = 80 * this.expDecay(t, 20);
      const env = this.expDecay(t, 25);
      data[i] = (this.sine(t * freq) * 0.7 + this.noise() * 0.3) * env * 0.6;
    }
    return buffer;
  }

  private generateRespawn(): AudioBuffer {
    const duration = 0.5;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Warble effect
      const modFreq = 8;
      const baseFreq = 300 + Math.sin(t * modFreq * Math.PI * 2) * 100;
      const phase = t * baseFreq;
      const env = this.envelope(t, 0.05, 0.1, 0.6, 0.2, duration);
      data[i] = this.sine(phase) * env * 0.4;
    }
    return buffer;
  }

  private generateGem(): AudioBuffer {
    const duration = 0.3;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Sparkly coin sound - two harmonics
      const freq1 = 880;
      const freq2 = 1320;
      const env = this.expDecay(t, 8);
      data[i] =
        (this.sine(t * freq1) * 0.5 + this.sine(t * freq2) * 0.3) * env * 0.5;
    }
    return buffer;
  }

  private generateCheckpoint(): AudioBuffer {
    const duration = 0.4;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Two-note chime (ascending)
      const note1End = 0.2;
      let freq: number;
      if (t < note1End) {
        freq = 523; // C5
      } else {
        freq = 659; // E5
      }
      const localT = t < note1End ? t : t - note1End;
      const env = this.expDecay(localT, 6);
      data[i] = this.sine(t * freq) * env * 0.5;
    }
    return buffer;
  }

  private generateGoal(): AudioBuffer {
    const duration = 0.8;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Major chord arpeggio
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      const noteLength = duration / notes.length;
      const noteIndex = Math.min(Math.floor(t / noteLength), notes.length - 1);
      const freq = notes[noteIndex];
      const localT = t - noteIndex * noteLength;
      const env = this.expDecay(localT, 4);
      data[i] = this.sine(t * freq) * env * 0.4;
    }
    return buffer;
  }

  private generateBounce(): AudioBuffer {
    const duration = 0.2;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Boing sound - descending pitch
      const freq = 400 * Math.pow(0.3, t * 5);
      const env = this.expDecay(t, 12);
      data[i] = this.sine(t * freq) * env * 0.6;
    }
    return buffer;
  }

  private generateTeleport(): AudioBuffer {
    const duration = 0.4;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Sci-fi whoosh with noise
      const freq = 800 - t * 600;
      const env = this.envelope(t, 0.02, 0.1, 0.5, 0.2, duration);
      data[i] = (this.sine(t * freq) * 0.4 + this.noise() * 0.2) * env * 0.5;
    }
    return buffer;
  }

  private generateCollapse(): AudioBuffer {
    const duration = 0.5;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Crumbling sound - noise + low rumble
      const freq = 60 + Math.random() * 20;
      const env = this.envelope(t, 0.01, 0.1, 0.7, 0.3, duration);
      data[i] = (this.noise() * 0.5 + this.sine(t * freq) * 0.5) * env * 0.5;
    }
    return buffer;
  }

  private generateHazard(): AudioBuffer {
    const duration = 0.3;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Harsh buzz/zap
      const freq = 150;
      const env = this.expDecay(t, 8);
      data[i] = this.saw(t * freq) * env * 0.4;
    }
    return buffer;
  }

  private generatePowerup(): AudioBuffer {
    const duration = 0.5;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Rising shimmer
      const freq = 400 + t * 400;
      const mod = Math.sin(t * 30 * Math.PI * 2) * 0.3;
      const env = this.envelope(t, 0.05, 0.15, 0.7, 0.2, duration);
      data[i] = this.sine(t * freq) * (1 + mod) * env * 0.4;
    }
    return buffer;
  }

  private generatePowerupExpire(): AudioBuffer {
    const duration = 0.3;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Falling tone
      const freq = 600 - t * 300;
      const env = this.expDecay(t, 6);
      data[i] = this.sine(t * freq) * env * 0.3;
    }
    return buffer;
  }

  private generateLevelStart(): AudioBuffer {
    const duration = 0.6;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Ascending fanfare
      const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
      const noteLen = duration / notes.length;
      const noteIdx = Math.min(Math.floor(t / noteLen), notes.length - 1);
      const freq = notes[noteIdx];
      const localT = t - noteIdx * noteLen;
      const env = this.expDecay(localT, 5);
      data[i] = this.sine(t * freq) * env * 0.4;
    }
    return buffer;
  }

  private generateRoll(baseFreq: number, intensity: number): AudioBuffer {
    const duration = 1.0; // Loopable
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Rumble with modulated noise
      const mod = Math.sin(t * 20 * Math.PI * 2) * 0.5 + 0.5;
      const rumble = this.sine(t * baseFreq) * 0.3;
      const noise = this.noise() * mod * 0.4;
      data[i] = (rumble + noise) * intensity * 0.3;
    }
    return buffer;
  }

  private generateImpact(force: number): AudioBuffer {
    const duration = 0.15;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 100 - t * 50;
      const env = this.expDecay(t, 20 + force * 10);
      data[i] =
        (this.sine(t * freq) * 0.6 + this.noise() * 0.4 * force) *
        env *
        force *
        0.5;
    }
    return buffer;
  }

  private generateSlide(freq: number): AudioBuffer {
    const duration = 0.5; // Loopable
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Filtered noise
      const noiseSample = this.noise();
      const filtered = noiseSample * Math.sin(t * freq * Math.PI * 2) * 0.5;
      data[i] = (filtered + this.noise() * 0.2) * 0.3;
    }
    return buffer;
  }

  private generateHum(freq: number, duration: number): AudioBuffer {
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Smooth hum with slight wobble
      const wobble = Math.sin(t * 3 * Math.PI * 2) * 5;
      data[i] = this.sine(t * (freq + wobble)) * 0.2;
    }
    return buffer;
  }

  private generateWhoosh(): AudioBuffer {
    const duration = 2.0; // Longer loop for slow spin
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Slow spinning hum - gentle and continuous
      const spinRate = 0.5; // slow rotation
      const phase = t * spinRate;

      // Subtle frequency wobble
      const wobble = Math.sin(phase * Math.PI * 2) * 10;
      const baseFreq = 80;

      // Gentle volume variation
      const volumeMod = (Math.sin(phase * Math.PI * 2) + 1) * 0.15 + 0.7;

      // Low, steady hum with subtle movement
      const hum = this.sine(t * (baseFreq + wobble)) * 0.12;
      const humOctave = this.sine(t * (baseFreq * 2 + wobble * 0.5)) * 0.05;

      data[i] = (hum + humOctave) * volumeMod;
    }
    return buffer;
  }

  private generatePulse(): AudioBuffer {
    const duration = 1.0;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Pulsing tone
      const env = (Math.sin(t * 2 * Math.PI * 2) + 1) * 0.5;
      data[i] = this.sine(t * 440) * env * 0.2;
    }
    return buffer;
  }

  private generateSpeedActive(): AudioBuffer {
    const duration = 1.0;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Speed boost - rushing sound with smooth modulated tones
      const rushMod = (Math.sin(t * 4 * Math.PI * 2) + 1) * 0.3 + 0.4;

      // Layered frequencies for "rushing" effect
      const rush1 = this.sine(t * 100 + Math.sin(t * 8) * 20) * 0.1;
      const rush2 = this.sine(t * 180 + Math.sin(t * 12) * 30) * 0.08;
      const rush3 = this.sine(t * 250 + Math.sin(t * 6) * 15) * 0.05;

      data[i] = (rush1 + rush2 + rush3) * rushMod;
    }
    return buffer;
  }

  private generateUIClick(): AudioBuffer {
    const duration = 0.05;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const env = this.expDecay(t, 80);
      data[i] = this.sine(t * 1000) * env * 0.4;
    }
    return buffer;
  }

  private generateUIHover(): AudioBuffer {
    const duration = 0.03;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const env = this.expDecay(t, 100);
      data[i] = this.sine(t * 1200) * env * 0.2;
    }
    return buffer;
  }

  private generateUIBack(): AudioBuffer {
    const duration = 0.08;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 800 - t * 400;
      const env = this.expDecay(t, 40);
      data[i] = this.sine(t * freq) * env * 0.3;
    }
    return buffer;
  }

  private generateUIMenuOpen(): AudioBuffer {
    const duration = 0.15;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 400 + t * 400;
      const env = this.envelope(t, 0.01, 0.05, 0.5, 0.05, duration);
      data[i] = this.sine(t * freq) * env * 0.3;
    }
    return buffer;
  }

  private generateUIMenuClose(): AudioBuffer {
    const duration = 0.12;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 600 - t * 300;
      const env = this.expDecay(t, 25);
      data[i] = this.sine(t * freq) * env * 0.3;
    }
    return buffer;
  }

  private generateUINotification(): AudioBuffer {
    const duration = 0.2;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Two quick beeps
      const beep1 = t < 0.08 ? 1 : 0;
      const beep2 = t > 0.12 && t < 0.2 ? 1 : 0;
      const env = (beep1 + beep2) * this.expDecay(t % 0.12, 30);
      data[i] = this.sine(t * 880) * env * 0.3;
    }
    return buffer;
  }

  private generateCombo(): AudioBuffer {
    const duration = 0.25;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Rising arpeggio
      const notes = [523, 659, 784];
      const noteLen = duration / notes.length;
      const noteIdx = Math.min(Math.floor(t / noteLen), notes.length - 1);
      const freq = notes[noteIdx];
      const localT = t - noteIdx * noteLen;
      const env = this.expDecay(localT, 10);
      data[i] = this.sine(t * freq) * env * 0.4;
    }
    return buffer;
  }

  private generateNearMiss(): AudioBuffer {
    const duration = 0.15;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Quick swoosh
      const freq = 1000 - t * 600;
      const env = this.expDecay(t, 20);
      data[i] = (this.sine(t * freq) * 0.5 + this.noise() * 0.3) * env * 0.3;
    }
    return buffer;
  }

  private generateVictoryStinger(): AudioBuffer {
    const duration = 1.2;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Major chord fanfare
      const notes = [523, 659, 784, 1047, 1047]; // C5, E5, G5, C6, C6 (hold)
      const timings = [0, 0.15, 0.3, 0.45, 0.8];
      let sample = 0;
      for (let n = 0; n < notes.length; n++) {
        if (t >= timings[n]) {
          const localT = t - timings[n];
          const env = this.expDecay(localT, 2);
          sample += this.sine(t * notes[n]) * env * 0.2;
        }
      }
      data[i] = sample;
    }
    return buffer;
  }

  private generateFallStinger(): AudioBuffer {
    const duration = 0.6;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Descending whoosh
      const freq = 600 * Math.pow(0.2, t);
      const env = this.envelope(t, 0.01, 0.2, 0.5, 0.3, duration);
      data[i] = (this.sine(t * freq) * 0.5 + this.noise() * 0.2) * env * 0.4;
    }
    return buffer;
  }

  private generateDeathStinger(): AudioBuffer {
    const duration = 0.5;
    const buffer = this.createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Harsh dissonant
      const freq1 = 200;
      const freq2 = 212; // Slightly detuned
      const env = this.expDecay(t, 4);
      data[i] =
        (this.saw(t * freq1) * 0.3 +
          this.saw(t * freq2) * 0.3 +
          this.noise() * 0.2) *
        env *
        0.4;
    }
    return buffer;
  }

  private generateAmbientSpace(): AudioBuffer {
    const duration = 8.0; // Longer loop for smoother ambient
    const buffer = this.createStereoBuffer(duration);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < left.length; i++) {
      const t = i / sampleRate;

      // Deep space ambience - smooth pad-like tones with slow modulation
      // Low drone with subtle movement
      const drone = this.sine(t * 55) * 0.08;
      const droneOctave = this.sine(t * 110.2) * 0.03;

      // Slowly evolving pad layers
      const padMod1 = (Math.sin(t * 0.15 * Math.PI * 2) + 1) * 0.5;
      const padMod2 = (Math.sin(t * 0.23 * Math.PI * 2) + 1) * 0.5;
      const pad1 = this.sine(t * 165) * padMod1 * 0.025;
      const pad2 = this.sine(t * 220) * padMod2 * 0.02;

      // Subtle shimmer (high frequency with very slow modulation)
      const shimmerMod = (Math.sin(t * 0.1 * Math.PI * 2) + 1) * 0.5;
      const shimmer = this.sine(t * 440) * shimmerMod * 0.008;

      // Stereo width through phase offset
      const stereoOffset = Math.sin(t * 0.05 * Math.PI * 2) * 0.02;

      left[i] = drone + droneOctave + pad1 + pad2 + shimmer;
      right[i] =
        drone +
        droneOctave * 0.95 +
        pad1 * 0.9 +
        pad2 * 1.1 +
        shimmer +
        stereoOffset;
    }
    return buffer;
  }

  private generateAmbientWind(): AudioBuffer {
    const duration = 6.0;
    const buffer = this.createStereoBuffer(duration);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const sampleRate = buffer.sampleRate;

    // Wind simulation using multiple sine waves with slow modulation
    // Much smoother than filtered noise
    for (let i = 0; i < left.length; i++) {
      const t = i / sampleRate;

      // Slow breathing modulation
      const breathMod = (Math.sin(t * 0.2 * Math.PI * 2) + 1) * 0.4 + 0.2;

      // Layered smooth oscillations at different rates
      const wave1 = this.sine(t * 85 + Math.sin(t * 0.3) * 5) * 0.04;
      const wave2 = this.sine(t * 127 + Math.sin(t * 0.4) * 8) * 0.03;
      const wave3 = this.sine(t * 203 + Math.sin(t * 0.25) * 10) * 0.02;

      // Low whoosh
      const whooshMod = Math.sin(t * 0.15 * Math.PI * 2);
      const whoosh = this.sine(t * 60) * (whooshMod * 0.3 + 0.5) * 0.05;

      const sample = (wave1 + wave2 + wave3 + whoosh) * breathMod;

      // Stereo variation
      left[i] = sample;
      right[i] =
        sample * 0.9 +
        this.sine(t * 95 + Math.sin(t * 0.35) * 6) * 0.02 * breathMod;
    }
    return buffer;
  }

  private generateAmbientIndustrial(): AudioBuffer {
    const duration = 4.0;
    const buffer = this.createStereoBuffer(duration);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const sampleRate = buffer.sampleRate;

    for (let i = 0; i < left.length; i++) {
      const t = i / sampleRate;

      // Smooth mechanical hum
      const hum = this.sine(t * 60) * 0.08;
      const humHarmonic = this.sine(t * 120.3) * 0.04;
      const humSub = this.sine(t * 30) * 0.03;

      // Gentle pulsing instead of harsh clicks
      const pulseRate = 1.5; // pulses per second
      const pulsePhase = (t * pulseRate) % 1;
      const pulse = Math.pow(Math.sin(pulsePhase * Math.PI), 4) * 0.03;
      const pulseTone = this.sine(t * 180) * pulse;

      // Subtle motorized whir
      const whirMod = (Math.sin(t * 0.5 * Math.PI * 2) + 1) * 0.5;
      const whir = this.sine(t * 240) * whirMod * 0.015;

      left[i] = hum + humHarmonic + humSub + pulseTone + whir;
      right[i] =
        hum + humHarmonic * 0.95 + humSub + pulseTone * 0.9 + whir * 1.1;
    }
    return buffer;
  }
}
