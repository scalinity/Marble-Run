import { MenuBackground } from './MenuBackground';

/**
 * Main menu screen
 */
export class MainMenu {
  private container: HTMLElement;
  private background: MenuBackground;
  private onStart?: () => void;

  constructor() {
    this.background = new MenuBackground();
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'main-menu';
    el.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: transparent;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 200;
    `;

    el.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 60px;
        background: rgba(13, 13, 26, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        border: 1px solid rgba(68, 136, 255, 0.2);
        box-shadow: 0 0 60px rgba(68, 136, 255, 0.15);
      ">
        <h1 style="
          font-size: 72px;
          margin: 0 0 10px 0;
          text-shadow: 0 0 30px rgba(68, 136, 255, 0.8), 0 0 60px rgba(68, 136, 255, 0.4);
          letter-spacing: 6px;
          background: linear-gradient(135deg, #88ccff 0%, #4488ff 50%, #44ff88 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">MARBLE RUN</h1>

        <p style="
          font-size: 18px;
          opacity: 0.7;
          margin: 0 0 40px 0;
          letter-spacing: 2px;
        ">Roll, Jump, Collect</p>

        <button id="start-button" style="
          padding: 18px 60px;
          font-size: 26px;
          font-weight: bold;
          color: white;
          background: linear-gradient(135deg, #4488ff 0%, #2266dd 100%);
          border: 2px solid rgba(136, 204, 255, 0.3);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(68, 136, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          letter-spacing: 3px;
        ">PLAY</button>
      </div>

      <div style="
        position: fixed;
        bottom: 30px;
        font-size: 14px;
        opacity: 0.6;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        letter-spacing: 1px;
      ">
        Use WASD to move • Space to jump • ESC to pause
      </div>
    `;

    // Add hover effect
    const button = el.querySelector('#start-button') as HTMLButtonElement;
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.08) translateY(-2px)';
      button.style.boxShadow = '0 8px 35px rgba(68, 136, 255, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
      button.style.borderColor = 'rgba(136, 204, 255, 0.6)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1) translateY(0)';
      button.style.boxShadow = '0 4px 20px rgba(68, 136, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
      button.style.borderColor = 'rgba(136, 204, 255, 0.3)';
    });
    button.addEventListener('click', () => {
      this.onStart?.();
    });

    return el;
  }

  /**
   * Set callback for start button
   */
  setOnStart(callback: () => void): void {
    this.onStart = callback;
  }

  show(): void {
    this.container.style.display = 'flex';
    this.background.start();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.background.stop();
  }

  dispose(): void {
    this.background.dispose();
    this.container.remove();
  }
}
