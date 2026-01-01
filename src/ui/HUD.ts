import { Timer } from '../utils/Timer';
import { eventBus, GameEvents } from '../utils/EventBus';

/**
 * In-game HUD - timer, gems, control hints
 */
export class HUD {
  private container: HTMLElement;
  private timerElement: HTMLElement;
  private gemsElement: HTMLElement;
  private hintsElement: HTMLElement;

  private timer: Timer;
  private gemsCollected = 0;
  private totalGems = 0;

  private visible = false;

  constructor() {
    this.timer = new Timer();
    this.container = this.createContainer();
    this.timerElement = this.createTimerElement();
    this.gemsElement = this.createGemsElement();
    this.hintsElement = this.createHintsElement();

    this.container.appendChild(this.timerElement);
    this.container.appendChild(this.gemsElement);
    this.container.appendChild(this.hintsElement);

    document.body.appendChild(this.container);

    this.setupEventListeners();
    this.hide();
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'hud';
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 100;
    `;
    return el;
  }

  private createTimerElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      font-variant-numeric: tabular-nums;
    `;
    el.textContent = '00:00.00';
    return el;
  }

  private createGemsElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    el.innerHTML = `
      <span style="color: #44ff88;">&#9670;</span>
      <span id="gem-count">0 / 0</span>
    `;
    return el;
  }

  private createHintsElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      font-size: 14px;
      opacity: 0.7;
    `;
    el.innerHTML = `
      <div>WASD - Move</div>
      <div>Space - Jump</div>
      <div>R - Respawn</div>
      <div>Esc - Pause</div>
    `;
    return el;
  }

  private setupEventListeners(): void {
    eventBus.on(GameEvents.GEM_COLLECTED, () => {
      this.gemsCollected++;
      this.updateGems();
    });
  }

  /**
   * Update HUD each frame
   */
  update(): void {
    if (!this.visible) return;
    this.timerElement.textContent = this.timer.getFormatted();
  }

  /**
   * Show HUD and start timer
   */
  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.hintsElement.style.display = 'block';
  }

  /**
   * Hide HUD
   */
  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
    this.hintsElement.style.display = 'none';
  }

  /**
   * Start the timer
   */
  startTimer(): void {
    this.timer.start();
  }

  /**
   * Pause the timer
   */
  pauseTimer(): void {
    this.timer.pause();
  }

  /**
   * Resume the timer
   */
  resumeTimer(): void {
    this.timer.resume();
  }

  /**
   * Stop the timer and return elapsed time
   */
  stopTimer(): number {
    this.timer.stop();
    return this.timer.getElapsed();
  }

  /**
   * Get current time
   */
  getTime(): number {
    return this.timer.getElapsed();
  }

  /**
   * Get formatted time string
   */
  getFormattedTime(): string {
    return this.timer.getFormatted();
  }

  /**
   * Set total gem count for level
   */
  setTotalGems(count: number): void {
    this.totalGems = count;
    this.gemsCollected = 0;
    this.updateGems();
  }

  /**
   * Reset for new level
   */
  reset(): void {
    this.gemsCollected = 0;
    this.timer.start();
    this.updateGems();
  }

  private updateGems(): void {
    const countEl = this.gemsElement.querySelector('#gem-count');
    if (countEl) {
      countEl.textContent = `${this.gemsCollected} / ${this.totalGems}`;
    }
  }

  dispose(): void {
    this.container.remove();
    this.hintsElement.remove();
  }
}
