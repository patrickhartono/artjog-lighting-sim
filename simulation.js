import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.localClippingEnabled = true; // enable clipping planes
document.body.appendChild(renderer.domElement);

// Clip all beam geometry below stage surface (y = 0.5)
const stageClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.12, 0.65);
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.update();
const raycaster = new THREE.Raycaster();

// --- STAGE & ENV ---
const stage = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
stage.position.y = 0.25; scene.add(stage);

// Floor grid reference (like Blender) — 1 cell = 1M × 1M
const gridHelper = new THREE.GridHelper(30, 30, 0x333333, 0x222222);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ visible: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0.5; // same level as stage top — prevents beams going below stage
scene.add(ground);

// Audience Silhouettes — random height 1.5–1.7M
function addChoir(x, z, count) {
    for (let i = 0; i < count; i++) {
        const h = 1.5 + Math.random() * 0.2; // random 1.5–1.7M
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h, 6), new THREE.MeshStandardMaterial({ color: 0x050505 }));
        c.position.set(x + (Math.random() - 0.5) * 4, h / 2 + 0.5, z + (Math.random() - 0.5) * 3);
        scene.add(c);
    }
}
addChoir(-3, 0, 15); addChoir(3, 0, 15);

// Screen (Art Deco Shader via RenderTarget)
const SHADER_W = 1280, SHADER_H = 720;
const shaderTarget = new THREE.WebGLRenderTarget(SHADER_W, SHADER_H);
const shaderScene  = new THREE.Scene();
const shaderCam    = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const shaderUniforms = {
    uTime:       { value: 0.0 },
    uResolution: { value: new THREE.Vector2(SHADER_W, SHADER_H) },
    uMouse:      { value: new THREE.Vector2(0, 0) }
};

const shaderMat = new THREE.ShaderMaterial({
    uniforms: shaderUniforms,
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;

        float taylorInvSqrt(float r) {
            return 1.79284291400159 - 0.85373472095314 * r;
        }

        float noise(vec2 p) {
            vec2 Pi = floor(p);
            vec2 Pf = p - Pi;
            Pi = mod(Pi, 256.0);
            vec2 grad3[12];
            grad3[0]  = vec2(1,1);  grad3[1]  = vec2(-1,1);  grad3[2]  = vec2(1,-1);  grad3[3]  = vec2(-1,-1);
            grad3[4]  = vec2(1,0);  grad3[5]  = vec2(-1,0);  grad3[6]  = vec2(1,0);   grad3[7]  = vec2(-1,0);
            grad3[8]  = vec2(0,1);  grad3[9]  = vec2(0,-1);  grad3[10] = vec2(0,1);   grad3[11] = vec2(0,-1);
            float n00 = dot(grad3[int(mod(Pi.x + mod(Pi.y, 256.0), 12.0))],           Pf);
            float n01 = dot(grad3[int(mod(Pi.x + mod(Pi.y + 1.0, 256.0), 12.0))],     Pf - vec2(0,1));
            float n10 = dot(grad3[int(mod(Pi.x + 1.0 + mod(Pi.y, 256.0), 12.0))],     Pf - vec2(1,0));
            float n11 = dot(grad3[int(mod(Pi.x + 1.0 + mod(Pi.y + 1.0, 256.0), 12.0))], Pf - vec2(1,1));
            vec2 fade = vec2(Pf.x*Pf.x*Pf.x*(Pf.x*(Pf.x*6.0-15.0)+10.0),
                             Pf.y*Pf.y*Pf.y*(Pf.y*(Pf.y*6.0-15.0)+10.0));
            return mix(mix(n00, n10, fade.x), mix(n01, n11, fade.x), fade.y);
        }

        float noise3D(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        }

        vec3 rotate(vec3 p, vec3 axis, float angle) {
            float cosA = cos(angle);
            float sinA = sin(angle);
            return cosA * p + sinA * cross(axis, p) + (1.0 - cosA) * dot(axis, p) * axis;
        }

        float boxSDF(vec3 p, vec3 b) {
            vec3 d = abs(p) - b;
            return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
        }

        void main() {
            vec2 fragCoord = gl_FragCoord.xy;
            vec4 fragColor = vec4(0.0);

            float timeFloor = floor(uTime * 10.0);
            float flicker = fract(sin(dot(vec2(timeFloor, timeFloor), vec2(12.9898, 79.233))) * 43758.5453);
            flicker = step(0.5, flicker);

            vec3 bgColor = vec3(flicker);
            fragColor = vec4(bgColor, 1.0);

            vec2 uv = (fragCoord.xy - uResolution.xy * 0.5) / uResolution.y;

            vec3 ro = vec3(0.0, 0.0, -5.0);
            vec3 rd = normalize(vec3(uv, 1.0));
            vec3 boxSize = vec3(1.0, 1.0, 1.0);
            vec3 lightPos = vec3(2.0, 2.0, -2.0);

            float t = 0.0;
            bool hit = false;

            for (int i = 0; i < 64; i++) {
                vec3 p = ro + t * rd;
                p = rotate(p, vec3(1.0, 0.0, 0.0), sin(uTime));
                p = rotate(p, vec3(0.0, 1.0, 0.0), cos(uTime));
                p = rotate(p, vec3(0.0, 0.0, 1.0), sin(uTime) * cos(uTime));
                float d = boxSDF(p, boxSize);
                if (d < 0.01) {
                    float n = noise3D(p * 10.0);
                    n = n * 0.5 + 0.5;
                    vec3 lightDir = normalize(lightPos - p);
                    float diff = max(0.0, dot(vec3(0.0, 1.0, 0.0), lightDir));
                    vec3 col = vec3(n) * diff;
                    fragColor = vec4(col, 1.0);
                    hit = true;
                    break;
                }
                t += d;
                if (t > 10.0) break;
            }

            if (!hit) {
                fragColor = vec4(bgColor, 1.0);
            }

            gl_FragColor = fragColor * 0.60;
        }
    `
});

shaderScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMat));

const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshBasicMaterial({ map: shaderTarget.texture })
);
screen.position.set(0, 3.0, -4);
scene.add(screen);

// --- LIGHTING ENGINE (4 TOTEM, 3 HEADS EACH) ---
const lights = [];
const lightParams = { preset: 'PRESET 3', roomBrightness: 0.8, animSpeed: 0.5, beamWidth: 0.4, seqChase: false, bloomStrength: 1.5, chaseInterval: 0.12, beamColor: '#ffffff' };
let chaseIndex = 0;
let lastChaseTime = 0;

// WebSocket client — connects to TouchDesigner WebSocket Server DAT (port 9980)
// Sim runs standalone if TD is not connected; all params remain GUI-controllable.
const ws = new WebSocket('ws://localhost:9980');
ws.onmessage = (event) => {
    try {
        Object.assign(lightParams, JSON.parse(event.data));
        gui.controllers.forEach(c => c.updateDisplay());
    } catch (e) { console.warn('[WS] Bad message:', e); }
};
ws.onopen = () => ws.send(JSON.stringify({ type: 'status', connected: true, preset: lightParams.preset }));
ws.onerror = () => console.warn('[WS] TouchDesigner not connected — running standalone');
const ambientLight = new THREE.AmbientLight(0xffffff, lightParams.roomBrightness);
scene.add(ambientLight);

const TOTEM_HEIGHT = 6;
const lightPositions = [
    { x: -8, z: -3, yPositions: [2, 5] },    // Left 1  — 2 heads
    { x: -8, z:  0, yPositions: [1, 3, 5] }, // Left 2  — 3 heads
    { x: -8, z:  3, yPositions: [2, 5] },    // Left 3  — 2 heads
    { x:  8, z: -2, yPositions: [1, 3, 5] }, // Right 1 — 3 heads
    { x:  8, z:  2, yPositions: [2, 5] },    // Right 2 — 2 heads
];

function createTotem(config) {
    const group = new THREE.Group();
    const h = TOTEM_HEIGHT;
    const totem = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    totem.position.y = h / 2; group.add(totem);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, clippingPlanes: [stageClipPlane] });
    const yPositions = config.yPositions;
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
gui.add(lightParams, 'preset', ['PRESET 1', 'PRESET 2', 'PRESET 3', 'PRESET 4']).name('Preset Mode').onChange(v => document.getElementById('mode-display').innerText = v);
gui.add(lightParams, 'roomBrightness', 0, 1.0).name('Brightness');
gui.add(lightParams, 'animSpeed', 0.5, 10).name('Anim Speed');
gui.add(lightParams, 'seqChase').name('Sequential Chase');

// --- FULLSCREEN ---
const btnFS = document.getElementById('btn-fullscreen');
btnFS.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});
document.addEventListener('fullscreenchange', () => {
    btnFS.textContent = document.fullscreenElement ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]';
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') btnFS.click();
});

// --- ANIMATION ---
const startTime = Date.now();
let _lastBeamColor = lightParams.beamColor;
function animate() {
    const t = (Date.now() - startTime) * 0.001;
    const speed = lightParams.animSpeed;
    shaderUniforms.uTime.value = t;
    bloomPass.strength = lightParams.bloomStrength;
    if (lightParams.beamColor !== _lastBeamColor) {
        lights.forEach(l => l.beam.material.color.set(lightParams.beamColor));
        _lastBeamColor = lightParams.beamColor;
    }
    renderer.setRenderTarget(shaderTarget);
    renderer.render(shaderScene, shaderCam);
    renderer.setRenderTarget(null);

    lights.forEach((l, idx) => {
        const totemIdx = l.totemIdx;
        const headIdx = l.headIdx;
        const isLeft = totemIdx < 3;
        const isEven = totemIdx % 2 === 0;
        const phase = headIdx * 0.3;
        const baseAngle = isLeft ? -Math.PI / 2 : Math.PI / 2;

        const bri = lightParams.roomBrightness;
        if (lightParams.preset === 'PRESET 1') {
            // Pola Silang Diagonal (X-CROSS)
            l.yoke.rotation.y = isLeft ? -1.5 : 1.5;
            l.head.rotation.x = -(0.3 + headIdx * 0.1) * (1 - Math.sin(t * speed + phase));
            l.beam.material.opacity = (Math.sin(t * speed * 2 + phase) > 0 === isEven) ? bri : 0;
        }
        else if (lightParams.preset === 'PRESET 4') {
            // Horizontal Cross — beam tegak lurus, saling silang di tengah stage
            l.yoke.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;
            l.head.rotation.x = 0;
            l.beam.material.opacity = (Math.sin(t * speed * 2 + phase) > 0 === isEven) ? bri : 0;
        }
        else if (lightParams.preset === 'PRESET 2') {
            // Pola Audience Level Scanner
            l.yoke.rotation.y = baseAngle + Math.sin(t * speed * 0.5 + phase) * 0.6;
            l.head.rotation.x = -0.2;
            l.beam.material.opacity = (Math.sin(t * speed * 4 + phase) > 0.5 === isEven) ? bri : 0;
        }
        else {
            // Chaos Mode (Random Nonotak)
            l.yoke.rotation.y = baseAngle + Math.sin(t * speed + totemIdx + phase) * 1.5;
            l.head.rotation.x = Math.cos(t * speed * 0.5 + totemIdx + phase) * 0.8 - 0.3;
            l.beam.material.opacity = Math.random() > 0.1 ? bri * 0.9 : 0;
        }

        // --- SEQUENTIAL CHASE OVERLAY ---
        if (lightParams.seqChase) {
            if (t - lastChaseTime > lightParams.chaseInterval / speed) {
                chaseIndex = (chaseIndex + 1) % lights.length;
                lastChaseTime = t;
            }
            l.beam.material.opacity = (idx === chaseIndex) ? l.beam.material.opacity : 0;
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

// Prevent Chrome from throttling rAF when window loses focus (e.g. OBS Window Capture)
let rafId = null;
let intervalId = null;
function startRaf() {
    if (rafId) return;
    rafId = requestAnimationFrame(function loop() { animate(); rafId = requestAnimationFrame(loop); });
}
function stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}
window.addEventListener('blur', () => {
    stopRaf();
    if (!intervalId) intervalId = setInterval(animate, 1000 / 60);
});
window.addEventListener('focus', () => {
    clearInterval(intervalId); intervalId = null;
    startRaf();
});
startRaf();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
