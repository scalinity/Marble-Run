# Marble Run

**A physics-based platformer built from first principles.**

---

## What This Is

Marble Run is a 3D marble platformer. You roll, you jump, you collect gems, you reach the goal. Sixteen levels, physics-driven movement, procedural audio, neon aesthetics.

This is a craft project. We wanted to understand how games actually work — collision detection, physics simulation, adaptive audio, level design — so we built one from scratch.

If you are here because you want to study game development, there is something useful in here. If you just want to play, the link is below.

---

## The Principles We Followed

### Physics First

Everything the marble does — rolling, jumping, landing, sliding, falling — emerges from a physics simulation, not animation curves. We use Rapier3D with continuous collision detection and a fixed timestep accumulator. When the marble bounces, it is because the physics engine said so.

### Audio Without Assets

All sound effects are synthesized at runtime via Web Audio API. No mp3s, no wav files, no external assets. Every bounce, collect, and click exists as code. This taught us more about audio design than any amount of imported sounds would have.

The music adapts to gameplay state — ambient pads during exploration, drums and leads during action sequences, distinct cues for victory and failure.

### Design Without Graphics

We built levels in JSON before we built them in Three.js. The data drives the experience. Platforms, gaps, hazards, checkpoints, goals — all defined declaratively. This meant we could iterate on level design without touching game code.

---

## Features

| Feature | Implementation |
|---------|----------------|
| **Physics** | Rapier3D WASM, CCD, ray casting |
| **Controls** | WASD/arrows + jump with coyote time and jump buffering |
| **16 Levels** | Progressive difficulty, mechanic layering |
| **21 Piece Types** | Static, kinematic, and trigger-based pieces |
| **Power-Ups** | Speed boost, double jump, shield with timed durations |
| **Audio** | Procedural synthesis, adaptive music, 3D spatial positioning |
| **Visuals** | Three.js with GPU particles, ribbons, screen shake, neon aesthetics |
| **Replay System** | Record/playback for deterministic testing |
| **Full UI** | Menus, level select with best times, HUD, pause, results |

---

## Architecture Overview

```
marble-run/
├── src/
│   ├── main.ts              # Entry point, game loop initialization
│   ├── config/              # Tuning constants (physics, VFX, camera)
│   ├── engine/
│   │   ├── Input.ts        # Keyboard state, jump buffer, coyote time
│   │   ├── Physics.ts      # Rapier3D wrapper, fixed timestep
│   │   └── Renderer.ts     # Three.js scene, camera, lighting
│   ├── game/
│   │   ├── Game.ts         # Main coordinator, state machine
│   │   ├── Player.ts       # Marble movement, physics coupling
│   │   ├── Camera.ts       # Third-person follow with collision avoidance
│   │   ├── Collision.ts    # Event handling, trigger processing
│   │   ├── LevelLoader.ts  # JSON parsing, piece factory
│   │   ├── Powerups.ts     # Effect system with duration management
│   │   └── State.ts        # Menu, Playing, Paused, Complete, Failed
│   ├── pieces/
│   │   ├── static/         # Platforms, ramps, walls, ice
│   │   ├── kinematic/      # Moving, rotating, collapsing, conveyors
│   │   └── triggers/       # Gems, goals, checkpoints, teleporters
│   ├── audio/
│   │   ├── Director.ts     # Audio coordinator
│   │   ├── Music.ts        # Adaptive stem-based mixing
│   │   ├── SFX.ts         # Procedural synthesis
│   │   └── Spatial.ts      # Positional audio engine
│   ├── vfx/
│   │   ├── Particles.ts    # GPU particle systems with pooling
│   │   ├── Trails.ts       # Ribbon trails behind marble
│   │   └── Effects.ts      # Screen shake, glow, event bursts
│   ├── ui/                  # Screens and HUD components
│   └── testing/            # Replay recording and playback
├── levels/                 # JSON level definitions (16 levels)
└── public/                 # Static assets (minimal)
```

---

## Technical Details We Found Interesting

### Fixed Timestep Physics

The game runs physics at a constant 60Hz regardless of frame rate. The accumulator pattern ensures deterministic simulation even when frame times vary. This makes replays work — same inputs produce same outputs.

### Coyote Time and Jump Buffering

Platformers feel bad when inputs do not register. We implemented:

- **Coyote time (150ms)**: Jump still registers briefly after leaving a platform
- **Jump buffering (200ms)**: Jump registers briefly before hitting ground

These small windows transform feel.

### Procedural Audio Architecture

The audio system is entirely code:

- **Oscillators**: Sine, square, sawtooth, noise for different sounds
- **Envelopes**: ADSR for amplitude and filter
- **Randomization**: Pitch and timing variation prevent ear fatigue
- **Spatialization**: 3D positioning based on marble and sound source location

### Adaptive Music

Four audio stems mix based on game state:
- Exploration: Pads + light bass
- Action: Drums + lead synth
- Victory: Full arrangement, major key
- Failure: Discordant fade

Stems crossfade smoothly. The music responds to what you are doing.

---

## Controls

| Key | Action |
|-----|--------|
| `W A S D` or Arrows | Move marble |
| `Space` | Jump |
| `R` | Respawn at last checkpoint |
| `Escape` | Pause |

---

## Getting Started

```bash
git clone https://github.com/scalinity/Marble-Run.git
cd Marble-Run
npm install
npm run dev    # Development server with HMR
npm run build  # Production build
npm run preview # Preview production build
```

Requires Node.js 18+ and a modern browser with WebGL 2.0 and WebAssembly support.

---

## What We Learned

Building this taught us more about game development than years of tutorials:

- **Physics engines are subtle.** Tuning friction, restitution, and contact materials takes endless iteration.
- **Audio is half the experience.** We underinvested initially. When we rebuilt the audio system, the game transformed.
- **Level design is geometry.** Bad levels cannot be fixed with fancy graphics.
- **Determinism is hard.** Replay systems expose every timing edge case.
- **Juice matters.** Screen shake, particles, trails — all the "unnecessary" polish — make the difference between a tech demo and something fun.

---

## Acknowledgments

Built with:

- **Three.js** — Rendering
- **Rapier3D** — Physics
- **Vite** — Build tooling
- **Web Audio API** — All audio, no assets

---

## License

This project does not have a standard open-source license. Contact the repository owner for usage terms.

---

**Marble Run: Built to understand how games work.**
