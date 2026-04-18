# artjog-lighting-sim

A browser-based 3D lighting pre-visualization tool built for the **Artjog Opening** performance. Simulates a moving-head rig on a real-world-scale stage using Three.js and WebGL.

---

## Overview

This tool is used to design and preview lighting choreography before the live show. It renders a scaled 3D model of the stage, totem rigs, and screen, with animated beam simulation driven by a small animation engine with multiple presets.

---

## Features

- **5 moving-head totems** — 3 left / 2 right of stage, 12 heads total
- **4 animation presets:**
  - `PRESET 1` — Geometric X-Cross (diagonal beam cross with tilt animation)
  - `PRESET 2` — Audience Scanner (slow horizontal sweep)
  - `PRESET 3` — Chaos (randomized pan/tilt, Nonotak-style)
  - `PRESET 4` — Horizontal Cross (perpendicular beams meeting center stage)
- **Sequential Chase** — overlay toggle that strobes beams one at a time across all heads
- **Raycast collision detection** — beams terminate at stage/floor surface, no bleed-through
- **Clipping plane** — beam geometry hard-clipped at stage surface level (y = 0.5)
- **Post-processing** — UnrealBloomPass with tight radius, tuned so beams bloom but stage and screen do not
- **Custom GLSL screen shader** — rotating box raymarcher with flickering black/white background, rendered to a WebGLRenderTarget
- **Real-world scale** — 1 unit = 1 meter; stage is 12M × 8M
- **Floor grid** — 30×30 grid, 1 cell = 1M × 1M (Blender-style reference)
- **Fullscreen toggle** — button or press `F`
- **GUI controls** — Preset, Brightness, Animation Speed, Sequential Chase (via lil-gui)

---

## Tech Stack

| Library | Version | Source |
|---|---|---|
| Three.js | 0.160.0 | CDN (unpkg) via importmap |
| OrbitControls | bundled | `three/addons/` |
| EffectComposer + UnrealBloomPass | bundled | `three/addons/` |
| lil-gui | bundled | `three/addons/libs/` |

No build step, no npm. All dependencies loaded via browser importmap.

---

## Getting Started

**Requirement:** A local HTTP server. Chrome blocks ES module imports from `file://` protocol.

```bash
# From the project directory:
python3 -m http.server 8080
```

Then open:

```
http://localhost:8080/Simulation.html
```

---

## File Structure

```
Simulation.html     HTML shell, CSS overlay styles, importmap
simulation.js       Three.js scene, lighting engine, shader, animation loop
```

---

## Controls

| Input | Action |
|---|---|
| GUI — Preset Mode | Switch between 4 animation presets |
| GUI — Brightness | Control beam opacity (0–1) |
| GUI — Anim Speed | Scale animation rate (0.5–10) |
| GUI — Sequential Chase | Toggle single-beam chase sequence |
| Mouse drag | Orbit camera |
| Mouse scroll | Zoom |
| `F` key | Toggle fullscreen |

---

## Rig Reference

| Parameter | Value |
|---|---|
| Stage | 12M × 8M |
| Totem height | 6M |
| Totem positions | x = ±8, outside stage edge |
| Total moving heads | 12 (L: 2+3+2 / R: 3+2) |
| Screen | 10M × 5M *(placeholder — not yet verified against venue)* |

---

## Roadmap / In Progress

### TouchDesigner WebSocket Control *(not yet implemented)*

Plan: expose all lighting parameters via a local WebSocket server so TouchDesigner can drive the simulation in real time.

Parameters to control:
- `preset` — switch between PRESET 1–4
- `roomBrightness` — beam opacity (0–1)
- `animSpeed` — animation rate multiplier
- `beamWidth` — beam cone width
- `seqChase` — toggle sequential chase mode

**Proposed message format (JSON over WebSocket):**

```json
{ "preset": "PRESET 1", "brightness": 0.8, "animSpeed": 2.0, "beamWidth": 0.4, "seqChase": false }
```

TouchDesigner side: use a WebSocket DAT pointed at `ws://localhost:8081` to send updates on parameter change.
Browser side: a `WebSocket` listener updates `lightParams` on each incoming message.

---

## Known Issues

**OBS Window Capture throttling**
Chrome throttles `requestAnimationFrame` when the browser window loses focus, which causes the simulation to stutter or freeze when captured via OBS Window Capture.

Workaround: Use **OBS Browser Source** instead, pointed at:
```
http://localhost:8080/Simulation.html
```
This runs an embedded Chromium instance inside OBS that is not subject to focus-based throttling.

---

## License

MIT
