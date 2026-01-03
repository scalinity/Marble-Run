/**
 * Audio pool for frequently-played sounds
 * Pre-allocates sound instances to reduce allocation overhead
 */

interface PooledSound {
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  inUse: boolean;
  soundName: string;
  startTime: number;
  buffer: AudioBuffer;
}

// Pool sizes for frequently-played sounds
const POOL_SIZES: Record<string, number> = {
  // Physics sounds (high frequency)
  roll_track: 2,
  roll_metal: 2,
  roll_ice: 2,
  impact_light: 6,
  impact_medium: 4,
  impact_heavy: 3,

  // Interaction sounds (medium frequency)
  jump: 3,
  land: 3,
  gem: 4,
  bounce: 3,

  // UI sounds
  ui_click: 2,
  ui_hover: 2,
};

export class AudioPool {
  private pool: Map<string, PooledSound[]> = new Map();
  private context: AudioContext | null = null;
  private output: GainNode | null = null;

  init(
    context: AudioContext,
    output: GainNode,
    buffers: Map<string, AudioBuffer>,
  ): void {
    this.context = context;
    this.output = output;

    // Pre-allocate pool for each sound type
    for (const [soundName, size] of Object.entries(POOL_SIZES)) {
      const buffer = buffers.get(soundName);
      if (buffer) {
        this.pool.set(
          soundName,
          this.createPooledInstances(soundName, buffer, size),
        );
      }
    }
  }

  private createPooledInstances(
    name: string,
    buffer: AudioBuffer,
    count: number,
  ): PooledSound[] {
    const instances: PooledSound[] = [];
    for (let i = 0; i < count; i++) {
      instances.push(this.createInstance(name, buffer));
    }
    return instances;
  }

  private createInstance(name: string, buffer: AudioBuffer): PooledSound {
    if (!this.context || !this.output) {
      throw new Error("AudioPool not initialized");
    }

    const gainNode = this.context.createGain();
    const pannerNode = this.context.createStereoPanner();

    gainNode.connect(pannerNode);
    pannerNode.connect(this.output);

    return {
      source: null,
      gainNode,
      pannerNode,
      inUse: false,
      soundName: name,
      startTime: 0,
      buffer,
    };
  }

  /**
   * Check if a sound is pooled
   */
  hasPool(soundName: string): boolean {
    return this.pool.has(soundName);
  }

  /**
   * Play a pooled sound
   */
  play(
    soundName: string,
    options: {
      volume?: number;
      pan?: number;
      playbackRate?: number;
    } = {},
  ): PooledSound | null {
    if (!this.context) return null;

    const instances = this.pool.get(soundName);
    if (!instances || instances.length === 0) return null;

    // Find available instance
    let instance = instances.find((i) => !i.inUse);

    if (!instance) {
      // Steal oldest if all in use
      instance = instances.reduce((a, b) =>
        a.startTime < b.startTime ? a : b,
      );
      this.stopInstance(instance);
    }

    // Create new source (sources can only be started once)
    const source = this.context.createBufferSource();
    source.buffer = instance.buffer;
    source.playbackRate.value = options.playbackRate || 1;
    source.connect(instance.gainNode);

    // Set parameters
    instance.gainNode.gain.value = options.volume ?? 1;
    instance.pannerNode.pan.value = options.pan ?? 0;

    // Track state
    instance.source = source;
    instance.inUse = true;
    instance.startTime = this.context.currentTime;

    // Capture instance explicitly for the closure (avoids non-null assertion issues)
    const capturedInstance = instance;

    // Auto-release when done
    source.onended = () => {
      capturedInstance.inUse = false;
      capturedInstance.source = null;
    };

    source.start();
    return instance;
  }

  private stopInstance(instance: PooledSound): void {
    if (instance.source) {
      try {
        instance.source.stop();
      } catch {
        // Already stopped
      }
      instance.source = null;
    }
    instance.inUse = false;
  }

  /**
   * Stop all pooled sounds
   */
  stopAll(): void {
    for (const instances of this.pool.values()) {
      for (const instance of instances) {
        this.stopInstance(instance);
      }
    }
  }

  /**
   * Add a new buffer to the pool (for dynamically loaded sounds)
   */
  addToPool(
    soundName: string,
    buffer: AudioBuffer,
    poolSize: number = 3,
  ): void {
    if (!this.context || !this.output) return;
    if (this.pool.has(soundName)) return;

    this.pool.set(
      soundName,
      this.createPooledInstances(soundName, buffer, poolSize),
    );
  }

  dispose(): void {
    this.stopAll();
    for (const instances of this.pool.values()) {
      for (const instance of instances) {
        instance.gainNode.disconnect();
        instance.pannerNode.disconnect();
      }
    }
    this.pool.clear();
    this.context = null;
    this.output = null;
  }
}
