/**
 * Audio mixing bus with channel hierarchy
 * Master -> (SFX, Music, Ambient) -> Compressor -> Destination
 */

export class MixerBus {
  private masterGain: GainNode;
  private sfxGain: GainNode;
  private musicGain: GainNode;
  private ambientGain: GainNode;
  private compressor: DynamicsCompressorNode;

  constructor(private context: AudioContext) {
    // Create gain nodes
    this.masterGain = context.createGain();
    this.sfxGain = context.createGain();
    this.musicGain = context.createGain();
    this.ambientGain = context.createGain();

    // Create compressor for final output (prevents clipping)
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Connect routing: channels -> master -> compressor -> destination
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(context.destination);

    // Set default volumes
    this.masterGain.gain.value = 0.7;
    this.sfxGain.gain.value = 0.8;
    this.musicGain.gain.value = 0.5;
    this.ambientGain.gain.value = 0.6;
  }

  getSFXOutput(): GainNode {
    return this.sfxGain;
  }

  getMusicOutput(): GainNode {
    return this.musicGain;
  }

  getAmbientOutput(): GainNode {
    return this.ambientGain;
  }

  getMasterOutput(): GainNode {
    return this.masterGain;
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.context.currentTime,
      0.1,
    );
  }

  setSFXVolume(volume: number): void {
    this.sfxGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.context.currentTime,
      0.1,
    );
  }

  setMusicVolume(volume: number): void {
    this.musicGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.context.currentTime,
      0.1,
    );
  }

  setAmbientVolume(volume: number): void {
    this.ambientGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.context.currentTime,
      0.1,
    );
  }

  getMasterVolume(): number {
    return this.masterGain.gain.value;
  }

  getSFXVolume(): number {
    return this.sfxGain.gain.value;
  }

  getMusicVolume(): number {
    return this.musicGain.gain.value;
  }

  getAmbientVolume(): number {
    return this.ambientGain.gain.value;
  }

  /**
   * Mute all audio (set master to 0)
   */
  mute(): void {
    this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
  }

  /**
   * Unmute (restore master volume)
   */
  unmute(volume: number): void {
    this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
  }

  dispose(): void {
    this.sfxGain.disconnect();
    this.musicGain.disconnect();
    this.ambientGain.disconnect();
    this.masterGain.disconnect();
    this.compressor.disconnect();
  }
}
