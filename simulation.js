import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.localClippingEnabled = true; // enable clipping planes
document.body.appendChild(renderer.domElement);

// Clip all beam geometry below stage surface (y = 0.5)
const stageClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.12, 0.65));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.update();
const raycaster = new THREE.Raycaster();

// --- STAGE & ENV ---
const stage = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 15), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
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
        varying vec2 vUv;

        const bool TURN_ON_ANTI_ALIASING = true;
        const float PI = 3.14159265358979323846264;
        const int MAX_PRIMARY_RAY_STEPS = 80;

        float sdTorus(vec3 p, vec2 t) {
            vec2 q = vec2(length(p.xz) - t.x, p.y);
            return length(q) - t.y;
        }
        float distanceField(vec3 p) {
            return -sdTorus(p.yxz, vec2(5.0, 1.0));
        }
        vec3 castRay(vec3 pos, vec3 dir) {
            for (int i = 0; i < MAX_PRIMARY_RAY_STEPS; i++) {
                float dist = distanceField(pos);
                pos += dist * dir;
            }
            return pos;
        }
        float random(in float x) { return fract(sin(x) * 1e4); }
        float random(in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
        float pattern(vec2 st, vec2 v, float t) {
            vec2 p = floor(st + v);
            return step(t, random(25.0 + p * 0.000004) + random(p.x) * 0.75);
        }

        void main() {
            vec2 fragCoord = gl_FragCoord.xy;
            vec4 fragColor = vec4(0.0);

            if (TURN_ON_ANTI_ALIASING) {
                for (int xi = 0; xi < 2; xi++) {
                    for (int yi = 0; yi < 2; yi++) {
                        vec2 aaOffset = vec2(xi == 0 ? -0.25 : 0.25, yi == 0 ? -0.25 : 0.25);
                        vec2 screenPos = ((fragCoord + aaOffset) / uResolution) * 2.0 - 1.0;
                        vec3 cameraPos = vec3(0.0, 4.2, -3.8);
                        vec3 cameraDir = vec3(0.0, 0.22, 1.3);
                        vec3 planeU = vec3(1.0, 0.0, 0.0) * 0.8;
                        vec3 planeV = vec3(0.0, uResolution.y / uResolution.x, 0.0);
                        vec3 rayDir = normalize(cameraDir + screenPos.x * planeU + screenPos.y * planeV);
                        vec3 rayPos = castRay(cameraPos, rayDir);
                        float majorAngle = atan(rayPos.z, rayPos.y);
                        float minorAngle = atan(rayPos.x, length(rayPos.yz) - 5.0);
                        vec2 st = vec2(majorAngle / PI / 2.0, minorAngle / PI);
                        vec2 grid = vec2(1000.0, 50.0);
                        st *= grid;
                        vec2 ipos = floor(st);
                        vec2 fpos = fract(st);
                        vec2 vel = vec2(uTime * 0.09 * max(grid.x, grid.y));
                        vel *= vec2(1.0, 0.0) * (0.4 + 2.0 * pow(random(1.0 + ipos.y), 2.0));
                        vec2 offset = 0.0 * vec2(0.2, 0.25);
                        vec3 color = vec3(0.0);
                        float replaceMouse = 0.75 + 0.45 * sin(0.6 * uTime + 0.015 * st.x);
                        color.r = pattern(st + offset, vel, replaceMouse);
                        color.g = pattern(st, vel, replaceMouse);
                        color.b = pattern(st - offset, vel, replaceMouse);
                        color *= step(0.2, fpos.y);
                        fragColor += 0.25 * vec4(color, 1.0);
                    }
                }
            } else {
                vec2 screenPos = (fragCoord / uResolution) * 2.0 - 1.0;
                vec3 cameraPos = vec3(0.0, 4.2, -3.8);
                vec3 cameraDir = vec3(0.0, 0.22, 1.3);
                vec3 planeU = vec3(1.0, 0.0, 0.0) * 0.8;
                vec3 planeV = vec3(0.0, uResolution.y / uResolution.x, 0.0);
                vec3 rayDir = normalize(cameraDir + screenPos.x * planeU + screenPos.y * planeV);
                vec3 rayPos = castRay(cameraPos, rayDir);
                float majorAngle = atan(rayPos.z, rayPos.y);
                float minorAngle = atan(rayPos.x, length(rayPos.yz) - 5.0);
                vec2 st = vec2(majorAngle / PI / 2.0, minorAngle / PI);
                vec2 grid = vec2(1000.0, 50.0);
                st *= grid;
                vec2 ipos = floor(st);
                vec2 fpos = fract(st);
                vec2 vel = vec2(uTime * 0.09 * max(grid.x, grid.y));
                vel *= vec2(1.0, 0.0) * (0.4 + 2.0 * pow(random(1.0 + ipos.y), 2.0));
                vec2 offset = 0.0 * vec2(0.2, 0.25);
                vec3 color = vec3(0.0);
                float replaceMouse = 0.75 + 0.45 * sin(0.6 * uTime + 0.015 * st.x);
                color.r = pattern(st + offset, vel, replaceMouse);
                color.g = pattern(st, vel, replaceMouse);
                color.b = pattern(st - offset, vel, replaceMouse);
                color *= step(0.2, fpos.y);
                fragColor = vec4(color, 1.0);
            }

            gl_FragColor = fragColor * 0.60;
        }
    `
});

shaderScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMat));

const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 11),
    new THREE.MeshBasicMaterial({ map: shaderTarget.texture })
);
screen.position.set(0, 6, -8);
scene.add(screen);

// --- LIGHTING ENGINE (4 TOTEM, 3 HEADS EACH) ---
const lights = [];
const lightParams = { preset: 'PRESET 3', roomBrightness: 0.8, animSpeed: 0.5, beamWidth: 0.4, seqChase: false };
let chaseIndex = 0;
let lastChaseTime = 0;
const CHASE_INTERVAL = 0.12; // detik per step
const ambientLight = new THREE.AmbientLight(0xffffff, lightParams.roomBrightness);
scene.add(ambientLight);

const TOTEM_HEIGHT = 8;
const lightPositions = [
    { x: -17, z: -6, yPositions: [2, 6] },    // Left 1  — 2 heads
    { x: -17, z:  0, yPositions: [1, 4, 8] }, // Left 2  — 3 heads
    { x: -17, z:  6, yPositions: [2, 6] },    // Left 3  — 2 heads
    { x:  17, z: -3, yPositions: [1, 4, 8] }, // Right 1 — 3 heads
    { x:  17, z:  3, yPositions: [2, 6] },    // Right 2 — 2 heads
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

// --- ANIMATION ---
const startTime = Date.now();
function animate() {
    requestAnimationFrame(animate);
    const t = (Date.now() - startTime) * 0.001;
    const speed = lightParams.animSpeed;
    shaderUniforms.uTime.value = t;
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
            if (t - lastChaseTime > CHASE_INTERVAL / speed) {
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
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
