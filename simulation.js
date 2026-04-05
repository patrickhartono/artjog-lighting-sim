import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.localClippingEnabled = true; // enable clipping planes
document.body.appendChild(renderer.domElement);

// Clip all beam geometry below stage surface (y = 0.5)
const stageClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1));

const controls = new OrbitControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();

// --- STAGE & ENV ---
const stage = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 15), new THREE.MeshStandardMaterial({ color: 0xffffff }));
stage.position.y = 0.25; scene.add(stage);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ visible: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0.5; // same level as stage top — prevents beams going below stage
scene.add(ground);

// Choir Clusters (Warna Gelap Siluet)
function addChoir(x, z, count) {
    for (let i = 0; i < count; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x050505 }));
        c.position.set(x + (Math.random() - 0.5) * 6, 1.2, z + (Math.random() - 0.5) * 4);
        scene.add(c);
    }
}
addChoir(-8, 0, 15); addChoir(8, 0, 15);

// Screen (Ikeda Visual)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 512; canvas.height = 256;
const screenTex = new THREE.CanvasTexture(canvas);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({ map: screenTex }));
screen.position.set(0, 6, -8); scene.add(screen);

function updateIkeda() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) if (Math.random() > 0.8) ctx.fillRect(Math.random() * canvas.width, 0, Math.random() * 8, canvas.height);
    screenTex.needsUpdate = true;
}

// --- LIGHTING ENGINE (4 TOTEM, 3 HEADS EACH) ---
const lights = [];
const lightParams = { preset: 'PRESET 1', roomBrightness: 0.1, animSpeed: 2.0, beamWidth: 0.4 };
const ambientLight = new THREE.AmbientLight(0xffffff, lightParams.roomBrightness);
scene.add(ambientLight);

const TOTEM_HEIGHT = 8;
const lightPositions = [
    { x: -17, z: -5 },  // Left Front
    { x: -17, z:  0 },  // Left Middle
    { x: -17, z:  5 },  // Left Back
    { x:  17, z: -5 },  // Right Front
    { x:  17, z:  0 },  // Right Middle
    { x:  17, z:  5 },  // Right Back
];

function createTotem(config) {
    const group = new THREE.Group();
    const h = TOTEM_HEIGHT;
    const totem = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    totem.position.y = h / 2; group.add(totem);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, clippingPlanes: [stageClipPlane] });
    const yPositions = [1, h / 2, h]; // bawah, tengah, atas tiang
    const heads = [];

    yPositions.forEach((yPos, i) => {
        const yoke = new THREE.Group();
        yoke.position.set(0, yPos, 0);
        group.add(yoke);

        const head = new THREE.Group();
        yoke.add(head);
        head.add(new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0x000000 })));

        // BEAM: kecil di source (head), membesar ke lantai (spotlight cone)
        const beamGeo = new THREE.CylinderGeometry(1, 0.02, 1, 32, 1, true);
        beamGeo.translate(0, 0.5, 0);
        const beam = new THREE.Mesh(beamGeo, beamMat.clone());
        beam.rotation.x = -Math.PI / 2; // y+ → z+ (sesuai raycaster)
        head.add(beam);

        heads.push({ yoke, head, beam, totemIdx: config.idx, headIdx: i });
    });

    group.position.set(config.x, 0, config.z); scene.add(group);
    return heads;
}

lightPositions.forEach((p, i) => createTotem({ ...p, idx: i }).forEach(h => lights.push(h)));

// --- GUI ---
const gui = new GUI({ title: 'CONTROL PANEL' });
gui.add(lightParams, 'preset', ['PRESET 1', 'PRESET 2', 'PRESET 3']).name('Preset Mode').onChange(v => document.getElementById('mode-display').innerText = v);
gui.add(lightParams, 'roomBrightness', 0, 1.0).name('Brightness').onChange(v => ambientLight.intensity = v);
gui.add(lightParams, 'animSpeed', 0.5, 10).name('Anim Speed');

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;
    const speed = lightParams.animSpeed;
    updateIkeda();

    lights.forEach((l, idx) => {
        const totemIdx = l.totemIdx;
        const headIdx = l.headIdx;
        const isLeft = totemIdx < 3;
        const isEven = totemIdx % 2 === 0;
        const phase = headIdx * 0.3;
        const baseAngle = isLeft ? -Math.PI / 2 : Math.PI / 2;

        if (lightParams.preset === 'PRESET 1') {
            // Pola Silang Diagonal (X-CROSS)
            l.yoke.rotation.y = isLeft ? -1.5 : 1.5;
            l.head.rotation.x = -(0.3 + headIdx * 0.1);
            l.beam.material.opacity = (Math.sin(t * speed * 2 + phase) > 0 === isEven) ? 0.8 : 0;
        }
        else if (lightParams.preset === 'PRESET 2') {
            // Pola Audience Level Scanner
            l.yoke.rotation.y = baseAngle + Math.sin(t * speed * 0.5 + phase) * 0.6;
            l.head.rotation.x = -0.2;
            l.beam.material.opacity = (Math.sin(t * speed * 4 + phase) > 0.5 === isEven) ? 0.8 : 0;
        }
        else {
            // Chaos Mode (Random Nonotak)
            l.yoke.rotation.y = baseAngle + Math.sin(t * speed + totemIdx + phase) * 1.5;
            l.head.rotation.x = Math.cos(t * speed * 0.5 + totemIdx + phase) * 0.8 - 0.3;
            l.beam.material.opacity = Math.random() > 0.1 ? 0.7 : 0;
        }

        // COLLISION DETECTION (Stop at floor)
        const headPos = new THREE.Vector3();
        l.head.getWorldPosition(headPos);
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(l.head.getWorldQuaternion(new THREE.Quaternion()));
        raycaster.set(headPos, dir);
        const hit = raycaster.intersectObjects([stage, ground]);

        if (hit.length > 0) {
            l.beam.scale.set(lightParams.beamWidth, hit[0].distance, lightParams.beamWidth);
        } else {
            l.beam.scale.set(lightParams.beamWidth, 100, lightParams.beamWidth);
        }
    });

    composer.render();
    controls.update();
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
