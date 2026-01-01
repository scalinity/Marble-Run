import { Timer } from '../utils/Timer';

interface ResultsData {
  levelName: string;
  time: number;
  gemsCollected: number;
  totalGems: number;
  bestTime?: number;
  isNewBest: boolean;
}

/**
 * Level completion results screen
 */
export class ResultsScreen {
  private container: HTMLElement;
  private onNextLevel?: () => void;
  private onReplay?: () => void;
  private onExit?: () => void;

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    this.hide();
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'results-screen';
    el.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.85);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 300;
    `;

    return el;
  }

  /**
   * Show results for completed level
   */
  showResults(data: ResultsData): void {
    this.container.innerHTML = `
      <h2 style="
        font-size: 56px;
        margin: 0 0 10px 0;
        color: #44ff88;
        text-shadow: 0 0 20px rgba(68, 255, 136, 0.5);
      ">LEVEL COMPLETE!</h2>

      <p style="
        font-size: 24px;
        opacity: 0.8;
        margin: 0 0 40px 0;
      ">${data.levelName}</p>

      <div style="
        display: flex;
        flex-direction: column;
        gap: 15px;
        align-items: center;
        margin-bottom: 40px;
      ">
        <div style="font-size: 20px;">
          <span style="opacity: 0.7;">Time: </span>
          <span style="font-size: 32px; font-weight: bold;">${Timer.format(data.time)}</span>
          ${data.isNewBest ? '<span style="color: #ffdd44; margin-left: 10px;">NEW BEST!</span>' : ''}
        </div>

        <div style="font-size: 20px;">
          <span style="opacity: 0.7;">Gems: </span>
          <span style="color: ${data.gemsCollected === data.totalGems ? '#44ff88' : 'white'};">
            ${data.gemsCollected} / ${data.totalGems}
          </span>
          ${data.gemsCollected === data.totalGems ? '<span style="margin-left: 10px;">&#9733;</span>' : ''}
        </div>

        ${data.bestTime ? `
          <div style="font-size: 16px; opacity: 0.6;">
            Best: ${Timer.format(data.bestTime)}
          </div>
        ` : ''}
      </div>

      <div style="display: flex; gap: 15px;">
        <button id="next-button" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: linear-gradient(135deg, #44ff88 0%, #22cc66 100%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">Next Level</button>

        <button id="replay-button" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">Replay</button>

        <button id="exit-button" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">Menu</button>
      </div>
    `;

    // Button listeners
    const nextBtn = this.container.querySelector('#next-button')!;
    const replayBtn = this.container.querySelector('#replay-button')!;
    const exitBtn = this.container.querySelector('#exit-button')!;

    nextBtn.addEventListener('click', () => this.onNextLevel?.());
    replayBtn.addEventListener('click', () => this.onReplay?.());
    exitBtn.addEventListener('click', () => this.onExit?.());

    // Hover effects
    [nextBtn, replayBtn, exitBtn].forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.transform = 'scale(1)';
      });
    });

    this.show();
  }

  setOnNextLevel(callback: () => void): void {
    this.onNextLevel = callback;
  }

  setOnReplay(callback: () => void): void {
    this.onReplay = callback;
  }

  setOnExit(callback: () => void): void {
    this.onExit = callback;
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
  }
}
