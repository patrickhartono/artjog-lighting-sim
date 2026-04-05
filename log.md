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

### Status Saat Ini
- File terorganisir: `Simulation.html` + `simulation.js` ✓
- 6 totem (3 kiri, 3 kanan) di luar stage ✓
- 3 heads per totem: bawah (y=1), tengah (y=4), atas (y=8) ✓
- Beam shape spotlight cone ✓
- Beam tidak tembus bawah stage (clipping plane) ✓
- Rotasi semua preset mengarah ke stage ✓
- Project name: Artjog Opening ✓
