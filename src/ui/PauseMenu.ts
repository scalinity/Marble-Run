/**
 * Pause menu overlay
 */
export class PauseMenu {
  private container: HTMLElement;
  private onResume?: () => void;
  private onRestart?: () => void;
  private onExit?: () => void;

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    this.hide();
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'pause-menu';
    el.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.8);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 300;
    `;

    el.innerHTML = `
      <h2 style="
        font-size: 48px;
        margin: 0 0 40px 0;
      ">PAUSED</h2>

      <div style="display: flex; flex-direction: column; gap: 15px;">
        <button id="resume-button" class="pause-btn" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: linear-gradient(135deg, #4488ff 0%, #2266dd 100%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">Resume</button>

        <button id="restart-button" class="pause-btn" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        ">Restart Level</button>

        <button id="exit-button" class="pause-btn" style="
          padding: 12px 40px;
          font-size: 20px;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        ">Exit to Menu</button>
      </div>

      <p style="
        margin-top: 30px;
        opacity: 0.5;
        font-size: 14px;
      ">Press Esc to resume</p>
    `;

    // Button event listeners
    const resumeBtn = el.querySelector('#resume-button')!;
    const restartBtn = el.querySelector('#restart-button')!;
    const exitBtn = el.querySelector('#exit-button')!;

    resumeBtn.addEventListener('click', () => this.onResume?.());
    restartBtn.addEventListener('click', () => this.onRestart?.());
    exitBtn.addEventListener('click', () => this.onExit?.());

    // Hover effects
    el.querySelectorAll('.pause-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.transform = 'scale(1)';
      });
    });

    return el;
  }

  setOnResume(callback: () => void): void {
    this.onResume = callback;
  }

  setOnRestart(callback: () => void): void {
    this.onRestart = callback;
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
