# Marble Run

A 3D marble platformer built for the web. Roll, jump, and collect your way through 16 handcrafted obstacle courses featuring physics-based movement, procedural audio, and neon-lit visuals -- all running in the browser with no plugins required.

<p align="center">
  <strong>Roll. Jump. Collect.</strong>
</p>

## Features

- **Physics-Based Gameplay** -- Realistic marble rolling and jumping powered by Rapier3D (WASM), with continuous collision detection and fixed-timestep simulation
- **16 Levels** -- Progressive difficulty from gentle introductions to demanding gauntlets, with mechanics layered in as you advance
- **21 Piece Types** -- Platforms, ramps, moving platforms, conveyor belts, spinners, bounce pads, ice surfaces, collapsing platforms, teleporters, and more
- **Power-Up System** -- Speed Boost, Double Jump, and Shield pickups with timed durations
- **Procedural Audio** -- All sound effects synthesized in real-time via the Web Audio API; no external audio files needed
- **Adaptive Music** -- Stem-based mixing system that responds to gameplay intensity (exploration, action, tension, victory, failure)
- **3D Spatial Audio** -- Positional audio engine for immersive environmental sound
- **Visual Effects** -- GPU particle systems, marble trail ribbons, starfield backgrounds, screen shake, neon glow, and per-event VFX bursts
- **Full UI System** -- Animated main menu, level select with best times, in-game HUD, pause menu, and results screen
- **Replay System** -- Record and play back gameplay inputs for deterministic testing

## Tech Stack

| Layer     | Technology                                   |
| --------- | -------------------------------------------- |
| Language  | TypeScript (ES2022, strict mode)             |
| Rendering | Three.js v0.182 (WebGL, shadow maps, fog)    |
| Physics   | Rapier3D v0.19 (WASM, CCD, ray casting)      |
| Audio     | Web Audio API (procedural synthesis)         |
| Build     | Vite v7.2 (HMR, TypeScript compilation)      |
| Testing   | Vitest v4.0 + built-in replay test framework |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- A modern browser with WebGL and WebAssembly support (Chrome, Firefox, Edge, Safari)

### Installation

```bash
git clone https://github.com/scalinity/Marble-Run.git
cd Marble-Run
npm install
```

### Running in Development

```bash
npm run dev
```

This starts the Vite dev server with hot module replacement and opens the game in your default browser.

### Building for Production

```bash
npm run build
```

Compiles TypeScript and bundles with Vite. Output is written to the `dist/` directory.

### Previewing the Production Build

```bash
npm run preview
```

## How to Play

### Controls

| Key                    | Action                        |
| ---------------------- | ----------------------------- |
| `W A S D` / Arrow Keys | Move marble (camera-relative) |
| `Space`                | Jump                          |
| `R`                    | Respawn at last checkpoint    |
| `Escape`               | Pause / Unpause               |

### Objective

Roll your marble through each obstacle course, collecting gems along the way, and reach the **Goal Gate** to complete the level. Some levels require collecting all gems before the gate will open.

### Mechanics

- **Checkpoints** save your respawn position mid-level
- **Coyote time** (0.15s) gives a brief window to jump after leaving an edge
- **Jump buffering** (0.2s) queues your jump input if you press slightly early
- **Moving platforms** carry your marble along their path
- **Ice surfaces** reduce friction for momentum-based sliding
- **Teleporters** warp you between linked pads
- **Bounce pads** launch you into the air
- **Spinner hazards** knock you back (unless you have a Shield)
- **Collapsing platforms** crumble beneath you and respawn after a delay

### Power-Ups

| Power-Up    | Effect                    | Duration |
| ----------- | ------------------------- | -------- |
| Speed Boost | 1.8x movement speed       | 5s       |
| Double Jump | Extra jump while airborne | 10s      |
| Shield      | Absorbs one hazard hit    | 8s       |

## Levels

| #   | Name                 | Key Mechanics                              |
| --- | -------------------- | ------------------------------------------ |
| 1   | Getting Started      | Basic movement and jumping                 |
| 2   | Moving Parts         | Moving platforms                           |
| 3   | Narrow Escape        | Narrow bridges, all gems required          |
| 4   | Gauntlet Run         | Spinner hazards                            |
| 5   | Sky Tower            | Vertical platforming, all gems required    |
| 6   | Crossroads           | Branching paths, all gems required         |
| 7   | Bounce House         | Bounce pads                                |
| 8   | Frozen Falls         | Ice surfaces                               |
| 9   | Portal Maze          | Teleporters                                |
| 10  | Rotating Chaos       | Rotating platforms, all gems required      |
| 11  | Conveyor Gauntlet    | Conveyor belts, all gems required          |
| 12  | Teleporter Labyrinth | Complex teleporter networks, all gems req. |
| 13  | The Crucible         | Mixed hazards, all gems required           |
| 14  | Vertical Odyssey     | Extreme verticality, all gems required     |
| 15  | Synchronized Chaos   | Timed moving elements, all gems required   |
| 16  | Hazard Hexagon       | Everything at once, all gems required      |

## Project Structure

```
marble-run/
├── src/
│   ├── main.ts                 # Entry point, game loop
│   ├── config/constants.ts     # All tuning values (physics, VFX, camera, colors)
│   ├── engine/                 # Core systems
│   │   ├── Input.ts            # Keyboard input (WASD/arrows, jump buffer)
│   │   ├── Physics.ts          # Rapier3D wrapper (fixed timestep, ray casting)
│   │   └── Renderer.ts         # Three.js renderer (scene, camera, lighting)
│   ├── game/                   # Game logic
│   │   ├── Game.ts             # Main coordinator, game loop
│   │   ├── CameraRig.ts        # Third-person camera with collision avoidance
│   │   ├── CollisionHandler.ts # Collision events, trigger processing
│   │   ├── LevelLoader.ts      # JSON level parser and piece instantiation
│   │   ├── PlayerController.ts # Marble movement and jump mechanics
│   │   ├── PowerUpManager.ts   # Power-up lifecycle management
│   │   ├── StateMachine.ts     # Game state transitions
│   │   └── pieces/             # 21 level piece types
│   │       ├── static/         # Platforms, ramps, walls, bridges, bounce pads, ice
│   │       ├── kinematic/      # Moving, rotating, collapsing, conveyor, spinner
│   │       └── triggers/       # Gems, goals, checkpoints, power-ups, teleporters
│   ├── levels/                 # 16 JSON level definitions
│   ├── audio/                  # Procedural audio and adaptive music
│   │   ├── AudioDirector.ts    # Main audio coordinator
│   │   ├── MusicManager.ts     # Stem-based adaptive music
│   │   ├── ProceduralAudio.ts  # Synthesized SFX (no external files)
│   │   ├── SpatialAudioEngine.ts # 3D positional audio
│   │   └── systems/            # Collision, rolling, and UI sound systems
│   ├── ui/                     # UI screens (menu, level select, HUD, results)
│   ├── vfx/                    # Visual effects (particles, trails, starfield)
│   ├── testing/                # Replay recording and playback system
│   └── utils/                  # EventBus, Timer, math helpers
├── index.html                  # Entry HTML
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Audio and Visual Design

### Audio

The audio system is entirely procedural -- sound effects are synthesized at runtime using Web Audio API oscillators and noise generators. This means the game has zero external audio file dependencies for SFX.

The music system uses **stem-based adaptive mixing**: separate audio stems for drums, bass, pads, and leads crossfade dynamically based on gameplay state. When exploring, you hear ambient pads; during intense sections, drums and leads layer in; and victory or failure triggers distinct musical responses.

A full mixer bus architecture (Master, SFX, Music, Ambient) allows independent volume control across all channels, with settings persisted to localStorage.

### Visuals

The game uses a **dark neon aesthetic** with a deep navy background (#1a1a2e) and vibrant accent colors -- neon blues, greens, and golds for collectibles, with red reserved for hazards. The marble itself is an emissive green sphere with an inner glow core and equator ring.

Lighting consists of ambient, directional, hemisphere, fill, and rim lights (neon cyan rim) with 4096x4096 PCF soft shadow maps. Distance fog matching the background color provides natural depth cueing.

Visual effects include GPU-based particle systems with object pooling, ribbon trail effects behind the marble, a 2000-star background starfield, screen shake on impacts, and per-event effects for gem collection, level completion, and checkpoints.

## Architecture

The codebase follows an **event-driven architecture** built around a central typed EventBus with 30+ event types. Key patterns include:

- **State Machine** -- Game states (Menu, Level Select, Loading, Playing, Paused, Complete, Failed) with clean transitions
- **Factory Pattern** -- PieceRegistry maps piece type strings to factory functions for data-driven level loading
- **Fixed Timestep Physics** -- Accumulator pattern at 60Hz with a maximum of 5 substeps per frame to prevent physics spiraling
- **Singleton Registries** -- EventBus, AudioDirector, PlatformVelocityRegistry, TeleporterRegistry for cross-system coordination
- **Memory Management** -- All event listeners tracked with unsubscribe functions, dispose() methods on all major classes

Levels are fully **data-driven** via JSON files, making it straightforward to add new levels without touching game code.

## Developer Tools

| Key  | Action                    |
| ---- | ------------------------- |
| `F5` | Start recording replay    |
| `F6` | Stop recording and save   |
| `F7` | Load and play back replay |

Debug flags in `src/config/constants.ts` enable an FPS counter, physics debug visualization, and collision shape rendering.

## Contributing

Contributions are welcome. To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run `npm run build` to verify the project compiles
5. Commit your changes (`git commit -m "Add your feature"`)
6. Push to your branch (`git push origin feature/your-feature`)
7. Open a Pull Request

## License

This project does not currently specify a license. Contact the repository owner for usage terms.
