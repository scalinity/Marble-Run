import { Game } from './game/Game';

// Wait for DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Get container
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  // Create and start game
  const game = new Game(container);

  try {
    await game.start();
  } catch (error) {
    console.error('Failed to start game:', error);
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        color: white;
        font-family: system-ui, sans-serif;
        text-align: center;
        padding: 20px;
      ">
        <h1>Failed to Start Game</h1>
        <p style="opacity: 0.7;">Your browser may not support WebGL or WASM.</p>
        <p style="opacity: 0.5; font-size: 14px;">${error}</p>
      </div>
    `;
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    game.dispose();
  });
});
