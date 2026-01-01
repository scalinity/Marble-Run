import { Timer } from '../utils/Timer';

interface LevelInfo {
  id: string;
  name: string;
  bestTime?: number;
}

/**
 * Level selection screen
 */
export class LevelSelect {
  private container: HTMLElement;
  private levels: LevelInfo[] = [];
  private onSelect?: (levelId: string) => void;
  private onBack?: () => void;

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    this.hide();
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'level-select';
    el.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 200;
    `;

    return el;
  }

  private render(): void {
    this.container.innerHTML = `
      <h2 style="
        font-size: 48px;
        margin: 0 0 40px 0;
        text-shadow: 0 0 15px rgba(68, 136, 255, 0.4);
      ">SELECT LEVEL</h2>

      <div id="level-grid" style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        max-width: 600px;
      "></div>

      <button id="back-button" style="
        margin-top: 40px;
        padding: 10px 30px;
        font-size: 18px;
        color: white;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
      ">Back</button>
    `;

    const grid = this.container.querySelector('#level-grid')!;

    this.levels.forEach((level, index) => {
      const button = document.createElement('button');
      button.style.cssText = `
        width: 150px;
        height: 120px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(68, 136, 255, 0.2);
        border: 2px solid rgba(68, 136, 255, 0.5);
        border-radius: 12px;
        color: white;
        cursor: pointer;
        transition: transform 0.2s, background 0.2s;
      `;

      button.innerHTML = `
        <span style="font-size: 36px; font-weight: bold;">${index + 1}</span>
        <span style="font-size: 14px; opacity: 0.8; margin-top: 5px;">${level.name}</span>
        ${level.bestTime ? `<span style="font-size: 12px; color: #44ff88; margin-top: 5px;">${Timer.format(level.bestTime)}</span>` : ''}
      `;

      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.background = 'rgba(68, 136, 255, 0.4)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.background = 'rgba(68, 136, 255, 0.2)';
      });
      button.addEventListener('click', () => {
        this.onSelect?.(level.id);
      });

      grid.appendChild(button);
    });

    const backButton = this.container.querySelector('#back-button')!;
    backButton.addEventListener('click', () => {
      this.onBack?.();
    });
    backButton.addEventListener('mouseenter', () => {
      (backButton as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)';
    });
    backButton.addEventListener('mouseleave', () => {
      (backButton as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
    });
  }

  /**
   * Set available levels
   */
  setLevels(levels: LevelInfo[]): void {
    this.levels = levels;
    this.render();
  }

  /**
   * Update best time for a level
   */
  updateBestTime(levelId: string, time: number): void {
    const level = this.levels.find((l) => l.id === levelId);
    if (level) {
      if (!level.bestTime || time < level.bestTime) {
        level.bestTime = time;
        this.render();
      }
    }
  }

  setOnSelect(callback: (levelId: string) => void): void {
    this.onSelect = callback;
  }

  setOnBack(callback: () => void): void {
    this.onBack = callback;
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
