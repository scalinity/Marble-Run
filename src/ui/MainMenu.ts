/**
 * Main menu screen
 */
export class MainMenu {
  private container: HTMLElement;
  private onStart?: () => void;

  constructor() {
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 200;
    `;

    el.innerHTML = `
      <h1 style="
        font-size: 64px;
        margin: 0 0 10px 0;
        text-shadow: 0 0 20px rgba(68, 136, 255, 0.5);
        letter-spacing: 4px;
      ">MARBLE RUN</h1>

      <p style="
        font-size: 18px;
        opacity: 0.7;
        margin: 0 0 50px 0;
      ">Roll, Jump, Collect</p>

      <button id="start-button" style="
        padding: 15px 50px;
        font-size: 24px;
        font-weight: bold;
        color: white;
        background: linear-gradient(135deg, #4488ff 0%, #2266dd 100%);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 15px rgba(68, 136, 255, 0.4);
      ">PLAY</button>

      <div style="
        position: fixed;
        bottom: 30px;
        font-size: 14px;
        opacity: 0.5;
      ">
        Use WASD to move, Space to jump
      </div>
    `;

    // Add hover effect
    const button = el.querySelector('#start-button') as HTMLButtonElement;
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 25px rgba(68, 136, 255, 0.6)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 15px rgba(68, 136, 255, 0.4)';
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
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
  }
}
