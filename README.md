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

### TouchDesigner WebSocket Control *(implemented)*

TouchDesigner drives the simulation in real time via WebSocket. Architecture: **TD = WebSocket Server (port 9980), browser = client.**

The browser connects to TD on load. If TD is not running, the sim works standalone — all parameters remain GUI-controllable.

**Parameters (JSON keys):**

| Key | Type | Range | Effect |
|-----|------|-------|--------|
| `preset` | string | `"PRESET 1"–"PRESET 4"` | Switch animation pattern |
| `brightness` | float | 0.0–1.0 | Beam opacity + ambient intensity |
| `animSpeed` | float | 0.5–10.0 | Animation rate multiplier |
| `beamWidth` | float | 0.1–0.8 | Beam cone width |
| `seqChase` | bool | true/false | Sequential chase strobe overlay |
| `bloomStrength` | float | 0.0–3.0 | Post-processing bloom intensity |
| `chaseInterval` | float | 0.05–1.0 | Seconds per chase step |
| `beamColor` | string | `"#rrggbb"` | Beam color (hex) |

**Message format (TD → Browser):**
```json
{ "preset": "PRESET 2", "brightness": 0.8, "animSpeed": 2.0, "beamWidth": 0.4, "seqChase": false, "bloomStrength": 1.5, "chaseInterval": 0.12, "beamColor": "#ffffff" }
```
Partial updates are supported — only send the keys that changed.

**TouchDesigner setup:**
1. Add a **WebSocket Server DAT** — set Network Mode: Server, Port: 9980
2. Add an **Execute DAT** (or Script DAT) to serialize parameters to JSON and call:
   ```python
   import json
   op('websocket_server').send(json.dumps({
       "preset": op('preset_select').par.value0.val,
       "brightness": float(op('brightness_slider')[0]),
       "animSpeed": float(op('speed_slider')[0]),
       "beamWidth": float(op('beamwidth_slider')[0]),
       "seqChase": bool(op('seqchase_toggle')[0]),
       "bloomStrength": float(op('bloom_slider')[0]),
       "chaseInterval": float(op('chase_interval')[0]),
       "beamColor": str(op('color_picker').par.value0.val)
   }))
   ```
3. Browser connects automatically to `ws://localhost:9980` on page load.

**If TD and browser are on different machines (LAN):** change `ws://localhost:9980` in `simulation.js` line 187 to the TD machine's IP address.

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
