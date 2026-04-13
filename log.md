# WebDMX Simulation — Development Log

## 2026-04-05

### Session: Lanjut dari Google AI Studio → Claude Code

---

### 1. Review File Awal (`Simulation.html`)
- File dibuat sebelumnya di Google AI Studio
- Stack: Three.js (v0.160), OrbitControls, EffectComposer + UnrealBloomPass, lil-gui
- Konten awal:
  - Stage putih (30x0.5x15)
  - Choir silhouettes kiri & kanan
  - Screen dengan Ikeda-style visual (random white bars)
  - **8 totem** dengan tinggi random (1.5–7.5 unit), masing-masing 1 moving head
  - 3 preset animasi: X-Cross, Audience Scanner, Chaos
  - Raycasting collision detection untuk beam vs lantai/stage
  - GUI control panel (preset, brightness, speed)

---

### 2. Perubahan: Struktur Totem (8 → 4, tambah 3 heads per totem)

**Masalah:** 8 totem dengan tinggi random tidak akurat untuk referensi NONOTAK.

**Target:** 4 totem fixed height, simetris kiri-kanan, masing-masing 3 moving heads.

**Perubahan di kode:**
- `lightPositions` diubah dari 8 posisi random → 4 posisi fixed:
  - Left Front: `{x: -13, z: -3}`
  - Left Back: `{x: -13, z: 3}`
  - Right Front: `{x: 13, z: -3}`
  - Right Back: `{x: 13, z: 3}`
- `TOTEM_HEIGHT = 8` (semua sama tinggi)
- Fungsi `createMovingHead` dirombak → `createTotem` yang return 3 head objects
- `lights` array sekarang 12 entries (4 totem × 3 heads)
- Animation loop diupdate menggunakan `totemIdx` dan `headIdx`

---

### 3. Fix: Beam Shape Terbalik (mengecil di lantai → mengembang)

**Masalah:** Beam cylinder mengecil saat menyentuh lantai — kebalikan dari spotlight nyata.

**Root cause:**
- `CylinderGeometry(0.02, 1, ...)` → radiusTop kecil, radiusBottom besar
- `beam.rotation.x = Math.PI / 2` → beam mengarah -Z (berlawanan dengan raycaster +Z)
- Hasil: besar di head, kecil di lantai

**Fix:**
- Swap radii: `CylinderGeometry(1, 0.02, 1, 32, 1, true)` — besar di ujung, kecil di source
- Ganti rotasi: `beam.rotation.x = -Math.PI / 2` — sekarang sejajar dengan raycaster +Z
- `beamWidth` naik dari `0.15` → `0.4` agar circle di lantai lebih terlihat

---

### 4. Fix: Posisi 3 Heads per Totem

**Iterasi 1 (salah):** 3 heads dengan x-offset (-0.5, 0, +0.5) — semua di puncak totem.

**Iterasi 2 (salah):** 3 heads di bagian bawah tiang `y: 0.5 + i * 0.4` — semua nempel di lantai.

**Iterasi 3 (benar):** 3 heads tersebar sepanjang tiang:
```js
const yPositions = [1, h / 2, h]; // bawah, tengah, atas
```
- Head 0: y = 1 (bawah)
- Head 1: y = 4 (tengah)
- Head 2: y = 8 (atas/puncak)

---

---

### 5. Reorganisasi File: HTML + JS Dipisah

**Masalah:** Semua kode (HTML, CSS, JS) dalam satu file — sulit di-maintain.

**Solusi:**
- `Simulation.html` → hanya HTML, CSS, dan importmap (Three.js CDN mapping)
- `simulation.js` → semua logika Three.js (scene, lights, animation, GUI)
- `importmap` tetap di HTML karena itu browser feature, bukan JS
- Untuk development: wajib pakai local HTTP server (`python3 -m http.server 8080`)
  karena Chrome blokir ES module dari `file://` protocol

---

### 6. Perubahan: 6 Totem di Luar Stage + Fix Rotasi

**Masalah:**
- Hanya 4 totem (2 per sisi) → perlu 6 (3 per sisi)
- Totem di x=±13 masih di dalam stage (stage span x: ±15)
- Rotasi beam Preset 1 & 2 terbalik — mengarah keluar bukan ke panggung

**Fix:**
- `lightPositions` → 6 posisi: x=±17 (di luar stage), z= -5, 0, +5
- `isLeft` threshold: `totemIdx < 3`
- Preset 1: `yoke.rotation.y = isLeft ? -1.5 : 1.5` (flip signs)
- Preset 1: `head.rotation.x = -(0.3 + headIdx * 0.1)` (tilt ke bawah)
- Preset 2 & 3: scan berpusat di `baseAngle = isLeft ? -π/2 : π/2`

---

### 7. Fix: Beam Tembus Bawah Stage

**Masalah:** Beam cone yang hampir horizontal memiliki sisi geometri yang menonjol di bawah y=0.5 (permukaan stage) — terlihat tembus ke bawah.

**Fix:** Three.js clipping plane
```js
renderer.localClippingEnabled = true;
const stageClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
// applied to beamMat: clippingPlanes: [stageClipPlane]
```
Semua beam geometry dipotong paksa di y=0.5.

---

### 8. Rename Project

- Title HTML & UI label: `"KALATIDHA x NONOTAK STYLE"` → `"Artjog Opening"`

---

---

## 2026-04-12

### Session: Fix Bloom, Brightness, dan Screen Integration

---

### 9. Fix: Stage Terang karena UnrealBloomPass Spill

**Masalah:** Stage terlihat terang/putih saat Brightness slider dinaikkan.

**Root Cause:**
- `MeshBasicMaterial` pada stage sudah immune terhadap AmbientLight.
- Penyebab sebenarnya: `UnrealBloomPass` dengan `radius=0.4` menyebarkan bloom dari beam (AdditiveBlending, opacity 0.7-0.8) ke seluruh permukaan stage.

**Fix:**
- `radius: 0.4 → 0.12` — bloom spread ketat, hanya di sekitar beam
- `threshold: 0.8 → 0.65` — pixel di atas 0.65 bloom (beam di 0.8 bloom, stage di 0.1 tidak)

---

### 10. Fix: Brightness Slider Tidak Ada Efek

**Masalah:** Setelah fix bloom, slider Brightness tidak berpengaruh pada apapun.

**Root Cause:**
- Slider sebelumnya hanya control `ambientLight.intensity`.
- Semua object (stage, beam, screen) menggunakan `MeshBasicMaterial` → immune terhadap AmbientLight.
- Beam opacity hardcoded di 0.7–0.8, tidak ada koneksi ke slider.

**Fix:**
- `roomBrightness` default: `0.017 → 0.8`
- Slider sekarang langsung control **beam opacity** di animation loop: `bri = lightParams.roomBrightness`, beam opacity = `bri` (bukan hardcoded 0.8)
- `ambientLight` decoupled dari slider (fixed low value)

---

### 11. Fix: Screen Shader Over-Bloom

**Masalah:** Setelah threshold bloom diturunkan ke 0.65, screen shader menjadi white blob sangat terang.

**Root Cause:**
- Screen shader output: `gl_FragColor = fragColor * 0.75` → luminance max ~0.75
- Threshold 0.65 < 0.75 → seluruh screen pixel trigger bloom → putih semua

**Fix:**
- Ubah output cap: `fragColor * 0.75 → fragColor * 0.60`
- Screen luminance max ~0.60 → di bawah threshold 0.65 → tidak bloom
- Beam di 0.8 tetap bloom, screen stabil

---

---

### 12. Ganti Screen Shader: Rotating Box Raymarcher

**Shader sebelumnya:** torus matrix-rain (dari ShaderToy komunitas)

**Shader baru:** karya Patrick Hartono — rotating box dengan:
- Flickering background (strobe hitam/putih ~5fps via Perlin hash)
- Ray marching 64 langkah terhadap `boxSDF`
- Box dirotasi 3 sumbu menggunakan fungsi `rotate()` berbasis quaternion
- Texturing via `noise3D` (Perlin-based) + simple diffuse lighting
- Bloom safety: output cap `* 0.60` → max luminance 0.60 < threshold 0.65

**Adaptasi ShaderToy → Three.js:**
- `mainImage(out vec4, in vec2)` → `void main()`
- `iTime` → `uTime`, `iResolution` → `uResolution`
- `fragColor` → `gl_FragColor`

---

### Status Saat Ini
- File terorganisir: `Simulation.html` + `simulation.js` ✓
- 5 totem total: 3 kiri (z=-6,0,+6), 2 kanan (z=-3,+3) — audience perspective ✓
- Head per totem alternating: L1=2, L2=3, L3=2 / R1=3, R2=2 → total 12 heads ✓
- Beam shape spotlight cone ✓
- Beam tidak tembus bawah stage (clipping plane) ✓
- Rotasi semua preset mengarah ke stage ✓
- Screen: rotating box raymarcher (Patrick Hartono) via WebGLRenderTarget ✓
- 4 preset: X-Cross (tilt animated), Audience Scanner, Chaos, Horizontal Cross ✓
- Sequential Chase toggle (apply di semua preset) ✓
- Brightness slider → control beam opacity langsung ✓
- Bloom: radius=0.12 (ketat), threshold=0.65 (beam bloom, stage & screen tidak) ✓
- Project name: Artjog Opening ✓

---

## 2026-04-13

### Session: Real-World Scale + Floor Grid + Choir Fix

---

### 13. Rescale ke Dimensi Nyata (1 unit = 1 meter)

**Stage:** `BoxGeometry(30, 0.5, 15)` → `BoxGeometry(12, 0.5, 8)` — sesuai dimensi asli 12M × 8M.

**Floor Grid:** Tambah `THREE.GridHelper(30, 30)` di y=0.01 sebagai referensi skala (tiap cell = 1M × 1M), seperti viewport Blender.

**Totem positions:** Disesuaikan ke skala baru — x=±8 (luar stage ±6), z proporsional (±3), `TOTEM_HEIGHT = 6`.

**Audience silhouettes:** Tinggi random 1.5–1.7M (sebelumnya fixed 1.8). Dipindah ke x=±3 dalam stage.

**Camera:** `position.set(0, 8, 22)`, target `(0, 2, 0)`.

---

### ⚠ TODO: Screen Size Belum Tepat

Screen saat ini `PlaneGeometry(10, 5)` — ukuran ini placeholder, belum disesuaikan dengan dimensi nyata backdrop/screen di venue Artjog. Perlu update setelah ada data ukuran screen asli.

---

### 14. Fix: Screen Position — Menyentuh Lantai Panggung

**Masalah:** Screen floating — bottom edge di Y=1.5, ada gap 1M dari stage surface.

**Root cause:** `screen.position.set(0, 4, -4)` — center di Y=4, tapi screen tinggi 5 unit, sehingga bottom edge di Y=4−2.5=1.5.

**Fix:**
- Dari foto referensi venue (panggung.jpeg, Jeje-4.jpg): backdrop berdiri langsung dari lantai panggung.
- Hitung ulang: `bottom = 0.5 (stage surface)`, `height = 5`, `center_y = 0.5 + 2.5 = 3.0`
- `screen.position.set(0, 4, -4)` → `screen.position.set(0, 3.0, -4)` (`simulation.js` line 175)

---

### 15. Tambah: Info Panel Bottom-Right

**Fitur:** Panel overlay di pojok kanan bawah berisi referensi dimensi nyata dan setup rig.

**Konten:**
- Stage: 12M × 8M
- Scale: 1 unit = 1 meter
- Grid: 1 cell = 1M × 1M
- Moving Heads: 12 total — 5 totems (L:3 / R:2)
- Totem Height: 6M
- Screen: 10M × 5M ⚠ (placeholder, ditandai redup)

**Implementasi:** Pure HTML di `Simulation.html` — CSS `#info-layer` (bottom-right, text-align right, border-right flip dari aesthetic kiri), tidak perlu JS karena nilai statis.
