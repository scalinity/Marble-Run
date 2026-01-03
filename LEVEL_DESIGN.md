# Marble Run Level Design Guide

This document provides comprehensive guidelines for creating valid, playable levels for the Marble Run game. Follow these specifications to ensure levels work correctly with the game engine.

---

## Table of Contents

1. [Level JSON Schema](#level-json-schema)
2. [Piece Types Reference](#piece-types-reference)
3. [Design Patterns & Measurements](#design-patterns--measurements)
4. [Validation Rules](#validation-rules)
5. [Example Templates](#example-templates)

---

## Level JSON Schema

Every level is defined as a JSON file in `src/levels/` with the following structure:

```json
{
  "id": "level1",
  "name": "Level Name",
  "requireAllGems": false,
  "spawnPoint": [0, 2, 0],
  "pieces": [
    {
      "id": "unique-piece-id",
      "type": "pieceType",
      "position": [x, y, z],
      "rotation": [rx, ry, rz],
      "scale": [sx, sy, sz],
      "params": {}
    }
  ]
}
```

### Required Fields

| Field            | Type      | Description                                                    |
| ---------------- | --------- | -------------------------------------------------------------- |
| `id`             | string    | Unique level identifier (e.g., "level1", "bonus-level")        |
| `name`           | string    | Display name shown in UI                                       |
| `requireAllGems` | boolean   | If true, all gems must be collected before goal                |
| `spawnPoint`     | [x, y, z] | Player spawn position (typically 2 units above start platform) |
| `pieces`         | array     | Array of piece objects defining the level                      |

### Piece Object Structure

| Field      | Type         | Required | Description                              |
| ---------- | ------------ | -------- | ---------------------------------------- |
| `id`       | string       | Yes      | Unique identifier within the level       |
| `type`     | string       | Yes      | Piece type (see reference below)         |
| `position` | [x, y, z]    | Yes      | World position                           |
| `rotation` | [rx, ry, rz] | No       | Rotation in degrees (default: [0, 0, 0]) |
| `scale`    | [sx, sy, sz] | No       | Scale multiplier (default: [1, 1, 1])    |
| `params`   | object       | No       | Type-specific parameters                 |

---

## Piece Types Reference

### Static Pieces (8 types)

These pieces don't move and provide the foundational structure.

#### `platform`

Flat rectangular surface for the marble to roll on.

| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| `width`   | number | 4       | Width (X axis) |
| `depth`   | number | 4       | Depth (Z axis) |
| `height`  | number | 0.5     | Thickness      |

```json
{
  "id": "start-platform",
  "type": "platform",
  "position": [0, 0, 0],
  "params": { "width": 6, "depth": 6 }
}
```

#### `trackStraight`

Straight track segment with raised edges to guide the marble.

| Parameter | Type   | Default | Description     |
| --------- | ------ | ------- | --------------- |
| `length`  | number | 4       | Length (Z axis) |
| `width`   | number | 2       | Width (X axis)  |

```json
{
  "id": "track1",
  "type": "trackStraight",
  "position": [0, 0, -6],
  "params": { "length": 8 }
}
```

#### `trackTurn`

90-degree curved track segment.

| Parameter   | Type   | Default | Description       |
| ----------- | ------ | ------- | ----------------- |
| `radius`    | number | 3       | Turn radius       |
| `width`     | number | 2       | Track width       |
| `direction` | string | "right" | "left" or "right" |

```json
{
  "id": "turn1",
  "type": "trackTurn",
  "position": [0, 0, -10],
  "params": { "radius": 3, "direction": "right" }
}
```

#### `ramp`

Inclined surface for height changes.

| Parameter   | Type   | Default | Description    |
| ----------- | ------ | ------- | -------------- |
| `length`    | number | 6       | Ramp length    |
| `width`     | number | 3       | Ramp width     |
| `height`    | number | 2       | Height gain    |
| `direction` | string | "up"    | "up" or "down" |

```json
{
  "id": "ramp1",
  "type": "ramp",
  "position": [0, 0, -8],
  "params": { "length": 8, "width": 3, "height": 3, "direction": "up" }
}
```

#### `wall`

Vertical barrier to block the marble.

| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| `width`   | number | 4       | Wall width     |
| `height`  | number | 2       | Wall height    |
| `depth`   | number | 0.3     | Wall thickness |

```json
{
  "id": "wall1",
  "type": "wall",
  "position": [3, 0, -5],
  "rotation": [0, 90, 0],
  "params": { "width": 4, "height": 2 }
}
```

#### `narrowBridge`

Thin platform requiring precision movement.

| Parameter | Type   | Default | Description                    |
| --------- | ------ | ------- | ------------------------------ |
| `length`  | number | 8       | Bridge length                  |
| `width`   | number | 1.0     | Bridge width (0.8-1.5 typical) |

```json
{
  "id": "bridge1",
  "type": "narrowBridge",
  "position": [0, 0, -12],
  "params": { "length": 10, "width": 0.8 }
}
```

#### `bouncePad`

Spring pad that launches the marble upward.

| Parameter     | Type   | Default | Description                         |
| ------------- | ------ | ------- | ----------------------------------- |
| `radius`      | number | 1.0     | Pad radius                          |
| `bounceForce` | number | 15      | Launch force (20-25 for high jumps) |

```json
{
  "id": "bouncer1",
  "type": "bouncePad",
  "position": [0, 0.1, -8],
  "params": { "radius": 1.2, "bounceForce": 22 }
}
```

#### `iceSurface`

Low-friction surface causing sliding.

| Parameter | Type   | Default | Description   |
| --------- | ------ | ------- | ------------- |
| `width`   | number | 4       | Surface width |
| `depth`   | number | 8       | Surface depth |

```json
{
  "id": "ice1",
  "type": "iceSurface",
  "position": [0, 0, -10],
  "params": { "width": 5, "depth": 12 }
}
```

---

### Kinematic Pieces (5 types)

These pieces have movement or physics interactions.

#### `movingPlatform`

Platform that travels between two points.

| Parameter      | Type   | Default | Description                      |
| -------------- | ------ | ------- | -------------------------------- |
| `width`        | number | 3       | Platform width                   |
| `depth`        | number | 3       | Platform depth                   |
| `moveAxis`     | string | "x"     | Movement axis: "x", "y", or "z"  |
| `moveDistance` | number | 4       | Distance traveled                |
| `speed`        | number | 2.0     | Movement speed (2.0-4.0 typical) |
| `pauseTime`    | number | 0.5     | Pause at endpoints (seconds)     |

```json
{
  "id": "moving1",
  "type": "movingPlatform",
  "position": [0, 2, -15],
  "params": {
    "width": 3,
    "depth": 3,
    "moveAxis": "x",
    "moveDistance": 6,
    "speed": 2.5,
    "pauseTime": 0.5
  }
}
```

#### `spinnerHazard`

Rotating bar that knocks the marble off (unless shielded).

| Parameter | Type   | Default | Description                             |
| --------- | ------ | ------- | --------------------------------------- |
| `width`   | number | 6       | Bar length                              |
| `height`  | number | 0.4     | Bar height                              |
| `depth`   | number | 0.5     | Bar thickness                           |
| `speed`   | number | 2.0     | Rotation speed (rad/s, 1.5-2.5 typical) |

```json
{
  "id": "spinner1",
  "type": "spinnerHazard",
  "position": [0, 0.5, -20],
  "params": { "width": 5, "height": 0.4, "depth": 0.6, "speed": 2.0 }
}
```

#### `conveyorBelt`

Moving surface that pushes the marble.

| Parameter   | Type   | Default   | Description             |
| ----------- | ------ | --------- | ----------------------- |
| `length`    | number | 6         | Belt length             |
| `width`     | number | 2         | Belt width              |
| `speed`     | number | 3         | Conveyor speed          |
| `direction` | string | "forward" | "forward" or "backward" |

```json
{
  "id": "conveyor1",
  "type": "conveyorBelt",
  "position": [0, 0, -12],
  "params": { "length": 8, "width": 3, "speed": 3, "direction": "forward" }
}
```

#### `collapsingPlatform`

Platform that falls after the marble stands on it.

| Parameter       | Type   | Default | Description               |
| --------------- | ------ | ------- | ------------------------- |
| `width`         | number | 3       | Platform width            |
| `depth`         | number | 3       | Platform depth            |
| `collapseDelay` | number | 1.5     | Seconds before collapse   |
| `respawnTime`   | number | 3.0     | Seconds before respawning |

```json
{
  "id": "collapse1",
  "type": "collapsingPlatform",
  "position": [0, 4, -18],
  "params": { "width": 3, "depth": 3, "collapseDelay": 1.5 }
}
```

#### `rotatingPlatform`

Platform that rotates around an axis.

| Parameter | Type    | Default | Description                     |
| --------- | ------- | ------- | ------------------------------- |
| `width`   | number  | 4       | Platform width                  |
| `depth`   | number  | 4       | Platform depth                  |
| `speed`   | number  | 1.0     | Rotation speed (rad/s)          |
| `axis`    | string  | "y"     | Rotation axis: "x", "y", or "z" |
| `ice`     | boolean | false   | Apply ice friction              |

```json
{
  "id": "rotating1",
  "type": "rotatingPlatform",
  "position": [0, 0, -24],
  "params": { "width": 5, "depth": 5, "speed": 0.6, "axis": "y" }
}
```

---

### Trigger Pieces (7 types)

These pieces trigger game events when the marble touches them.

#### `gem`

Collectible item. Place 1.5 units above the surface.

No parameters required.

```json
{
  "id": "gem1",
  "type": "gem",
  "position": [0, 1.5, -8]
}
```

#### `goalGate`

Level completion trigger. Required for every level.

No parameters required.

```json
{
  "id": "goal",
  "type": "goalGate",
  "position": [0, 0, -50]
}
```

#### `checkpoint`

Respawn point. Activates when touched.

No parameters required.

```json
{
  "id": "checkpoint1",
  "type": "checkpoint",
  "position": [0, 0, -25]
}
```

#### `teleporter`

Teleports marble to linked teleporter.

| Parameter  | Type   | Required | Description                         |
| ---------- | ------ | -------- | ----------------------------------- |
| `linkedId` | string | Yes      | ID of destination teleporter        |
| `color`    | number | No       | Hex color for pairing visualization |

```json
{
  "id": "tele-a",
  "type": "teleporter",
  "position": [0, 0.1, -10],
  "params": { "linkedId": "tele-b", "color": 16711935 }
},
{
  "id": "tele-b",
  "type": "teleporter",
  "position": [10, 5.1, -30],
  "params": { "linkedId": "tele-a", "color": 16711935 }
}
```

#### `speedBoost`

Temporary speed increase power-up.

| Parameter    | Type   | Default | Description               |
| ------------ | ------ | ------- | ------------------------- |
| `duration`   | number | 5       | Effect duration (seconds) |
| `multiplier` | number | 1.8     | Speed multiplier          |

```json
{
  "id": "speed1",
  "type": "speedBoost",
  "position": [0, 0.5, -15]
}
```

#### `doubleJump`

Grants a second jump in mid-air.

| Parameter  | Type   | Default | Description              |
| ---------- | ------ | ------- | ------------------------ |
| `duration` | number | 10      | Time to use the power-up |

```json
{
  "id": "djump1",
  "type": "doubleJump",
  "position": [0, 0.5, -20]
}
```

#### `shield`

Protects from one hazard hit (spinners).

| Parameter  | Type   | Default | Description               |
| ---------- | ------ | ------- | ------------------------- |
| `duration` | number | 8       | Shield duration (seconds) |

```json
{
  "id": "shield1",
  "type": "shield",
  "position": [0, 0.5, -18],
  "params": { "duration": 10 }
}
```

---

## Design Patterns & Measurements

### Standard Measurements

| Metric                  | Typical Value | Notes                        |
| ----------------------- | ------------- | ---------------------------- |
| Spawn point             | `[0, 2, 0]`   | 2 units above start platform |
| Start platform          | 5x5 or 6x6    | Give player room to orient   |
| Standard platform       | 4x4           | Normal gameplay              |
| Precision platform      | 3x3           | Challenging sections         |
| Narrow bridge width     | 0.8-1.5       | Lower = harder               |
| Z-gap between pieces    | 6-12 units    | Typical progression spacing  |
| Gem height offset       | +1.5          | Above surface                |
| Power-up height offset  | +0.5          | Just above surface           |
| Ramp height gain        | 2-4 units     | Per ramp section             |
| Bounce force (normal)   | 15-20         | Standard bounces             |
| Bounce force (high)     | 22-25         | Major elevation changes      |
| Moving platform speed   | 2.0-4.0       | Higher = harder              |
| Spinner speed           | 1.5-2.5 rad/s | Higher = harder              |
| Rotating platform speed | 0.4-1.0 rad/s | Higher = harder              |

### Difficulty Progression

**Early Levels (1-3):**

- Large platforms (5x5+)
- Straight paths, gentle turns
- Few or no hazards
- Wide bridges (1.2+)
- `requireAllGems: false`
- 5-8 gems

**Mid Levels (4-6):**

- Introduce moving platforms
- Add narrow bridges (1.0 width)
- Simple hazards (slow spinners)
- Conveyor belts
- `requireAllGems: true`
- 10-15 gems

**Late Levels (7-10):**

- Complex hazard combinations
- Narrow bridges (0.8-0.9 width)
- Fast spinners (2.0+ rad/s)
- Multiple rotating platforms
- Power-ups required for progression
- 15-20 gems

### Common Piece Combinations

**Safe Start:**

```json
[
  {
    "id": "start",
    "type": "platform",
    "position": [0, 0, 0],
    "params": { "width": 6, "depth": 6 }
  },
  { "id": "gem1", "type": "gem", "position": [0, 1.5, 0] }
]
```

**Track to Platform:**

```json
[
  {
    "id": "track1",
    "type": "trackStraight",
    "position": [0, 0, -6],
    "params": { "length": 6 }
  },
  {
    "id": "platform1",
    "type": "platform",
    "position": [0, 0, -14],
    "params": { "width": 4, "depth": 4 }
  }
]
```

**Bounce Pad Launch:**

```json
[
  {
    "id": "launch-platform",
    "type": "platform",
    "position": [0, 0, -10],
    "params": { "width": 4, "depth": 4 }
  },
  {
    "id": "bouncer",
    "type": "bouncePad",
    "position": [0, 0.1, -10],
    "params": { "bounceForce": 22 }
  },
  {
    "id": "landing",
    "type": "platform",
    "position": [0, 6, -20],
    "params": { "width": 5, "depth": 5 }
  }
]
```

**Checkpoint Station:**

```json
[
  {
    "id": "cp-platform",
    "type": "platform",
    "position": [0, 4, -30],
    "params": { "width": 5, "depth": 5 }
  },
  { "id": "checkpoint1", "type": "checkpoint", "position": [0, 4, -30] },
  { "id": "gem-cp", "type": "gem", "position": [0, 5.5, -30] }
]
```

**Hazard with Shield:**

```json
[
  {
    "id": "shield-platform",
    "type": "platform",
    "position": [0, 0, -40],
    "params": { "width": 3, "depth": 3 }
  },
  {
    "id": "shield1",
    "type": "shield",
    "position": [0, 0.5, -40],
    "params": { "duration": 10 }
  },
  {
    "id": "hazard-platform",
    "type": "platform",
    "position": [0, 0, -50],
    "params": { "width": 6, "depth": 6 }
  },
  {
    "id": "spinner1",
    "type": "spinnerHazard",
    "position": [0, 0.5, -50],
    "params": { "speed": 2.0 }
  }
]
```

**Teleporter Pair:**

```json
[
  {
    "id": "tele-a",
    "type": "teleporter",
    "position": [0, 0.1, -20],
    "params": { "linkedId": "tele-b", "color": 8388863 }
  },
  {
    "id": "dest-platform",
    "type": "platform",
    "position": [15, 8, -40],
    "params": { "width": 4, "depth": 4 }
  },
  {
    "id": "tele-b",
    "type": "teleporter",
    "position": [15, 8.1, -40],
    "params": { "linkedId": "tele-a", "color": 8388863 }
  }
]
```

### Checkpoint Placement

- Place every 20-30 Z-units of progression
- Always on a stable platform (never on moving/rotating pieces)
- Before difficult sections
- After long sequences without safe zones
- Recommended: 2-4 checkpoints per level based on length

### Gem Placement Rules

1. Always place **1.5 units above** the surface
2. One gem on start platform (easy first collect)
3. Spread gems along the critical path
4. Optional gems on side paths for exploration
5. For `requireAllGems: true`: ensure all gems are reachable from the main path

---

## Validation Rules

Before the level will load correctly, ensure:

### Required Elements

- [ ] Must have exactly one `goalGate`
- [ ] `spawnPoint` must be above a platform (2 units typical)
- [ ] Every piece must have unique `id`

### Teleporter Rules

- [ ] Teleporters must come in pairs
- [ ] `linkedId` must reference an existing teleporter
- [ ] Both teleporters should have the same `color` for visual clarity

### Gem Collection

- [ ] If `requireAllGems: true`, all gems must be physically reachable
- [ ] Gems on moving platforms should be collectible during platform travel
- [ ] Gems should not be placed inside geometry

### Physics Considerations

- [ ] Platforms should have slight gaps (0.1-0.2 units) to avoid physics overlap
- [ ] Bounce pads need space above for launch trajectory
- [ ] Teleporter exit should have clearance (not inside walls)

### Playability

- [ ] Path from spawn to goal must exist
- [ ] Checkpoints should be reachable without backtracking
- [ ] Hazards should be survivable with proper timing/power-ups

---

## Example Templates

### Easy Level Template

```json
{
  "id": "easy-template",
  "name": "Easy Level",
  "requireAllGems": false,
  "spawnPoint": [0, 2, 0],
  "pieces": [
    {
      "id": "start-platform",
      "type": "platform",
      "position": [0, 0, 0],
      "params": { "width": 6, "depth": 6 }
    },
    {
      "id": "gem1",
      "type": "gem",
      "position": [0, 1.5, 0]
    },
    {
      "id": "track1",
      "type": "trackStraight",
      "position": [0, 0, -6],
      "params": { "length": 8 }
    },
    {
      "id": "gem2",
      "type": "gem",
      "position": [0, 1.5, -6]
    },
    {
      "id": "mid-platform",
      "type": "platform",
      "position": [0, 0, -16],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "gem3",
      "type": "gem",
      "position": [0, 1.5, -16]
    },
    {
      "id": "track2",
      "type": "trackStraight",
      "position": [0, 0, -22],
      "params": { "length": 6 }
    },
    {
      "id": "goal-platform",
      "type": "platform",
      "position": [0, 0, -30],
      "params": { "width": 6, "depth": 6 }
    },
    {
      "id": "goal",
      "type": "goalGate",
      "position": [0, 0, -30]
    }
  ]
}
```

### Medium Level Template

```json
{
  "id": "medium-template",
  "name": "Medium Level",
  "requireAllGems": true,
  "spawnPoint": [0, 2, 0],
  "pieces": [
    {
      "id": "start-platform",
      "type": "platform",
      "position": [0, 0, 0],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "gem1",
      "type": "gem",
      "position": [0, 1.5, 0]
    },
    {
      "id": "ramp1",
      "type": "ramp",
      "position": [0, 0, -6],
      "params": { "length": 8, "height": 3, "direction": "up" }
    },
    {
      "id": "gem2",
      "type": "gem",
      "position": [0, 2.5, -6]
    },
    {
      "id": "moving1",
      "type": "movingPlatform",
      "position": [0, 3, -16],
      "params": {
        "width": 3,
        "depth": 3,
        "moveAxis": "x",
        "moveDistance": 5,
        "speed": 2.5
      }
    },
    {
      "id": "gem3",
      "type": "gem",
      "position": [0, 4.5, -16]
    },
    {
      "id": "checkpoint1-platform",
      "type": "platform",
      "position": [0, 3, -24],
      "params": { "width": 4, "depth": 4 }
    },
    {
      "id": "checkpoint1",
      "type": "checkpoint",
      "position": [0, 3, -24]
    },
    {
      "id": "narrow1",
      "type": "narrowBridge",
      "position": [0, 3, -32],
      "params": { "length": 10, "width": 1.0 }
    },
    {
      "id": "gem4",
      "type": "gem",
      "position": [0, 4.5, -32]
    },
    {
      "id": "bounce-platform",
      "type": "platform",
      "position": [0, 3, -42],
      "params": { "width": 4, "depth": 4 }
    },
    {
      "id": "bouncer1",
      "type": "bouncePad",
      "position": [0, 3.1, -42],
      "params": { "bounceForce": 20 }
    },
    {
      "id": "high-platform",
      "type": "platform",
      "position": [0, 10, -52],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "gem5",
      "type": "gem",
      "position": [0, 11.5, -52]
    },
    {
      "id": "goal-platform",
      "type": "platform",
      "position": [0, 10, -60],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "goal",
      "type": "goalGate",
      "position": [0, 10, -60]
    }
  ]
}
```

### Hard Level Template

```json
{
  "id": "hard-template",
  "name": "Hard Level",
  "requireAllGems": true,
  "spawnPoint": [0, 2, 0],
  "pieces": [
    {
      "id": "start-platform",
      "type": "platform",
      "position": [0, 0, 0],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "gem1",
      "type": "gem",
      "position": [0, 1.5, 0]
    },
    {
      "id": "rotating1",
      "type": "rotatingPlatform",
      "position": [0, 0, -10],
      "params": { "width": 4, "depth": 4, "speed": 0.6, "axis": "y" }
    },
    {
      "id": "gem2",
      "type": "gem",
      "position": [0, 1.5, -10]
    },
    {
      "id": "narrow1",
      "type": "narrowBridge",
      "position": [0, 0, -20],
      "params": { "length": 12, "width": 0.8 }
    },
    {
      "id": "gem3",
      "type": "gem",
      "position": [0, 1.5, -20]
    },
    {
      "id": "checkpoint1-platform",
      "type": "platform",
      "position": [0, 0, -30],
      "params": { "width": 4, "depth": 4 }
    },
    {
      "id": "checkpoint1",
      "type": "checkpoint",
      "position": [0, 0, -30]
    },
    {
      "id": "shield-platform",
      "type": "platform",
      "position": [0, 0, -38],
      "params": { "width": 3, "depth": 3 }
    },
    {
      "id": "shield1",
      "type": "shield",
      "position": [0, 0.5, -38],
      "params": { "duration": 10 }
    },
    {
      "id": "hazard-platform",
      "type": "platform",
      "position": [0, 0, -48],
      "params": { "width": 6, "depth": 6 }
    },
    {
      "id": "spinner1",
      "type": "spinnerHazard",
      "position": [0, 0.5, -48],
      "params": { "width": 5, "speed": 2.2 }
    },
    {
      "id": "gem4",
      "type": "gem",
      "position": [2, 1.5, -48]
    },
    {
      "id": "gem5",
      "type": "gem",
      "position": [-2, 1.5, -48]
    },
    {
      "id": "ice-section",
      "type": "iceSurface",
      "position": [0, 0, -58],
      "params": { "width": 4, "depth": 10 }
    },
    {
      "id": "gem6",
      "type": "gem",
      "position": [0, 1.5, -58]
    },
    {
      "id": "checkpoint2-platform",
      "type": "platform",
      "position": [0, 0, -70],
      "params": { "width": 4, "depth": 4 }
    },
    {
      "id": "checkpoint2",
      "type": "checkpoint",
      "position": [0, 0, -70]
    },
    {
      "id": "tele-a",
      "type": "teleporter",
      "position": [0, 0.1, -70],
      "params": { "linkedId": "tele-b", "color": 8388863 }
    },
    {
      "id": "final-platform",
      "type": "rotatingPlatform",
      "position": [15, 8, -80],
      "params": { "width": 5, "depth": 5, "speed": 0.8, "axis": "y" }
    },
    {
      "id": "tele-b",
      "type": "teleporter",
      "position": [15, 8.1, -80],
      "params": { "linkedId": "tele-a", "color": 8388863 }
    },
    {
      "id": "gem7",
      "type": "gem",
      "position": [15, 9.5, -80]
    },
    {
      "id": "goal-platform",
      "type": "platform",
      "position": [15, 8, -90],
      "params": { "width": 5, "depth": 5 }
    },
    {
      "id": "goal",
      "type": "goalGate",
      "position": [15, 8, -90]
    }
  ]
}
```

---

## Quick Reference Card

```
SPAWN:      [0, 2, 0] above start platform
GEM HEIGHT: +1.5 above surface
POWERUP:    +0.5 above surface

PLATFORMS:  5x5 (safe), 4x4 (normal), 3x3 (precision)
BRIDGES:    1.2 (easy), 1.0 (medium), 0.8 (hard)
GAPS:       6-12 Z-units between pieces

SPEEDS:
  Moving platforms: 2.0-4.0
  Spinners: 1.5-2.5 rad/s
  Rotating: 0.4-1.0 rad/s
  Conveyors: 2-4

BOUNCE FORCE: 15-20 (normal), 22-25 (high jumps)

CHECKPOINTS: Every 20-30 Z-units, before hard sections
```

---

## File Naming

Level files should be named `levelN.json` where N is the level number:

- `level1.json`, `level2.json`, etc.

Add new levels to `src/levels/index.ts` for them to appear in the game.
