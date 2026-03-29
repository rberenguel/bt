import * as THREE from 'three';
import { LineSegmentsGeometry } from './libs/LineSegmentsGeometry.js';
import { LineMaterial } from './libs/LineMaterial.js';
import { LineSegments2 } from './libs/LineSegments2.js';
import { initHaptic, triggerHaptic, triggerHapticError } from '../shared/haptic.js';
import { saveSession } from './storage.js';
import { openHistoryModal } from './history.js';

// --- CONFIG ---
const FRAME_COUNT = 2; // number of animation frames to cycle (2 = easier, 3 = harder)

const PALETTE = [
    0xffcc44, // yellow
    0xff8833, // orange
    0xff6677, // red
    0x44cc88, // green
    0xff88ee, // pink
    0x44ccdd, // cyan
    0xcc88ff, // purple
    0xaaaaaa, // grey
];

// --- SESSION TRACKING ---
const ROUNDS_PER_SESSION = 5;
let sessionSolved = 0;
let sessionFailed = 0;
let roundsPlayed = 0;

function showEndScreen() {
    const accuracy = Math.round((sessionSolved / ROUNDS_PER_SESSION) * 100);
    saveSession({ solved: sessionSolved, failed: sessionFailed, total: ROUNDS_PER_SESSION, accuracy });
    document.getElementById('end-score').textContent = `${sessionSolved} / ${ROUNDS_PER_SESSION}`;
    document.getElementById('end-accuracy').textContent = `${accuracy}%`;
    document.getElementById('end-screen').classList.add('visible');
}

// --- GAME STATE ---
let score = 0;
let isResolving = false;
let currentTargetAxis = '';
let currentOptions = [];
let currentPath3D = [];

// --- THREE.JS SETUP ---
const container = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();

function getCanvasSize() {
    const gc = document.getElementById('game-container');
    return { width: gc.clientWidth, height: gc.clientHeight };
}

// Using an Orthographic camera to match the 2D silhouettes exactly (no perspective distortion)
const frustumSize = 20.8;
let { width: initW, height: initH } = getCanvasSize();
let aspect = initW / initH;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    0.1, 100
);
camera.position.set(0, 0, 40);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(initW, initH);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const shapeGroup = new THREE.Group();
scene.add(shapeGroup);

// Animation target for snapping
const targetQuaternion = new THREE.Quaternion();

// --- PATH GENERATION (MAZE / SPANNING TREE) ---
function generateDenseSequence(gridSize, frameCount = 3) {
    const sequence = [];
    for(let f = 0; f < frameCount; f++) {
        const edges = [];
        const visited = new Set();
        const stack = [];

        const startX = Math.floor(Math.random() * gridSize);
        const startY = Math.floor(Math.random() * gridSize);
        stack.push({x: startX, y: startY});
        visited.add(`${startX},${startY}`);

        while(stack.length > 0) {
            const current = stack[stack.length - 1];
            const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}].sort(() => Math.random() - 0.5);
            let moved = false;
            for(let d of dirs) {
                const nx = current.x + d.x;
                const ny = current.y + d.y;
                const key = `${nx},${ny}`;
                if(nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !visited.has(key)) {
                    visited.add(key);
                    edges.push({x1: current.x, y1: current.y, x2: nx, y2: ny});
                    stack.push({x: nx, y: ny});
                    moved = true;
                    break;
                }
            }
            if(!moved) stack.pop();
        }

        // Add back ~15% of walls to create loops
        for(let y = 0; y < gridSize; y++) {
            for(let x = 0; x < gridSize; x++) {
                if(x < gridSize-1 && Math.random() < 0.15) edges.push({x1: x, y1: y, x2: x+1, y2: y});
                if(y < gridSize-1 && Math.random() < 0.15) edges.push({x1: x, y1: y, x2: x, y2: y+1});
            }
        }

        const half = gridSize / 2;
        sequence.push(edges.map(e => ({
            x1: e.x1 - half + 0.5, y1: e.y1 - half + 0.5,
            x2: e.x2 - half + 0.5, y2: e.y2 - half + 0.5
        })));
    }
    return sequence;
}

// --- 3D RENDERING ---
function map2DTo3DFace(x, y, faceIndex, gridSize) {
    const half = gridSize / 2;
    if (faceIndex === 0) return new THREE.Vector3(x, y, half);
    if (faceIndex === 1) return new THREE.Vector3(half, y, -x);
    if (faceIndex === 2) return new THREE.Vector3(-x, y, -half);
    if (faceIndex === 3) return new THREE.Vector3(-half, y, x);
    if (faceIndex === 4) return new THREE.Vector3(x, half, -y);
    if (faceIndex === 5) return new THREE.Vector3(x, -half, y);
}

function renderCubeFaces(faceSequences, filledFaces, gridSize) {
    while(shapeGroup.children.length > 0){
        shapeGroup.remove(shapeGroup.children[0]);
    }

    const { width, height } = getCanvasSize();
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const matRed = new LineMaterial({
        color,
        linewidth: 3,
        resolution: new THREE.Vector2(width, height)
    });
    const matBlue = new LineMaterial({
        color: 0x883300,  // dark orange shadow
        linewidth: 3,
        transparent: true,
        opacity: 0,
        resolution: new THREE.Vector2(width, height)
    });

    for (let f = 0; f < FRAME_COUNT; f++) {
        const frameGroup = new THREE.Group();
        frameGroup.visible = false;

        for(let i = 0; i < filledFaces.length; i++) {
            const faceIndex = filledFaces[i];
            const segments2D = faceSequences[i][f];

            const positions = [];
            segments2D.forEach(s => {
                const p1 = map2DTo3DFace(s.x1, s.y1, faceIndex, gridSize);
                const p2 = map2DTo3DFace(s.x2, s.y2, faceIndex, gridSize);
                positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            });

            const geometryRed = new LineSegmentsGeometry();
            geometryRed.setPositions(positions);
            const geometryBlue = new LineSegmentsGeometry();
            geometryBlue.setPositions(positions);

            const lineRed = new LineSegments2(geometryRed, matRed);
            const lineBlue = new LineSegments2(geometryBlue, matBlue);

            const offset = 0;
            lineRed.position.set(offset, offset, 0);
            lineBlue.position.set(-offset, -offset, 0);

            frameGroup.add(lineRed);
            frameGroup.add(lineBlue);
        }
        shapeGroup.add(frameGroup);
    }

    shapeGroup.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
}

// --- 2D DRAWING LOGIC ---
function draw2DSegments(canvas, segments2D) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'bevel';
    ctx.lineCap = 'square';

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    segments2D.forEach(s => {
        minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
        minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
    });

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const range = Math.max(rangeX, rangeY);

    const padding = 20;
    const usableWidth = canvas.width - padding * 2;
    const scale = usableWidth / range;

    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;

    ctx.beginPath();
    segments2D.forEach((s) => {
        const drawX1 = (s.x1 - centerX) * scale + canvas.width / 2;
        const drawY1 = -(s.y1 - centerY) * scale + canvas.height / 2;
        const drawX2 = (s.x2 - centerX) * scale + canvas.width / 2;
        const drawY2 = -(s.y2 - centerY) * scale + canvas.height / 2;

        ctx.moveTo(drawX1, drawY1);
        ctx.lineTo(drawX2, drawY2);
    });
    ctx.stroke();
}

// --- GAME LOGIC ---
let targetFaceIndex = 0;
let targetView = 'outside';
let lastDrawnFrame = -1;
let resolveTimeout = null;

function startLevel() {
    isResolving = false;
    document.getElementById('overlay').classList.remove('show-overlay');

    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('correct', 'wrong');
    });

    // Each entry is the 3 faces meeting at one corner of the cube (8 corners total)
    // 0=Front, 1=Right, 2=Back, 3=Left, 4=Top, 5=Bottom
    const cornerTriples = [
        [4, 0, 1], [4, 0, 3], [4, 2, 1], [4, 2, 3],
        [5, 0, 1], [5, 0, 3], [5, 2, 1], [5, 2, 3]
    ];
    const filledFaces = cornerTriples[Math.floor(Math.random() * cornerTriples.length)];

    const generatedSequences = [];
    for(let i = 0; i < 6; i++) {
        generatedSequences.push(generateDenseSequence(10, FRAME_COUNT));
    }

    renderCubeFaces(generatedSequences, filledFaces, 10);

    const targetFaceSequenceIndex = Math.floor(Math.random() * 3);
    targetFaceIndex = filledFaces[targetFaceSequenceIndex];
    targetView = Math.random() > 0.5 ? 'outside' : 'inside';

    const targetSequence = targetView === 'inside'
        ? generatedSequences[targetFaceSequenceIndex].map(frame => frame.map(s => ({ x1: -s.x1, y1: s.y1, x2: -s.x2, y2: s.y2 })))
        : generatedSequences[targetFaceSequenceIndex];

    currentOptions = [
        { sequence: targetSequence, isCorrect: true },
        { sequence: generatedSequences[3], isCorrect: false },
        { sequence: generatedSequences[4], isCorrect: false },
        { sequence: generatedSequences[5], isCorrect: false }
    ];

    currentOptions.sort(() => Math.random() - 0.5);
    lastDrawnFrame = -1;
}

function resolveLevel(selectedIndex) {
    if (isResolving) return;
    isResolving = true;

    const selectedOption = currentOptions[selectedIndex];
    const cards = document.querySelectorAll('.option-card');

    roundsPlayed++;

    if (selectedOption.isCorrect) {
        sessionSolved++;
        cards[selectedIndex].classList.add('correct');
        score++;
        document.getElementById('score').innerText = score;
        document.getElementById('overlay').innerText = "MATCH";
        document.getElementById('overlay').style.color = "var(--correct-color)";
        triggerHaptic();
    } else {
        sessionFailed++;
        cards[selectedIndex].classList.add('wrong');
        const correctIndex = currentOptions.findIndex(o => o.isCorrect);
        cards[correctIndex].classList.add('correct');
        score = Math.max(0, score - 1);
        document.getElementById('score').innerText = score;
        document.getElementById('overlay').innerText = "MISS";
        document.getElementById('overlay').style.color = "var(--wrong-color)";
        triggerHapticError();
    }

    document.getElementById('overlay').classList.add('show-overlay');

    let targetXRot = 0;
    let targetYRot = 0;

    if (targetFaceIndex === 0) {
        targetYRot = targetView === 'outside' ? 0 : Math.PI;
    } else if (targetFaceIndex === 1) {
        targetYRot = targetView === 'outside' ? -Math.PI / 2 : Math.PI / 2;
    } else if (targetFaceIndex === 2) {
        targetYRot = targetView === 'outside' ? Math.PI : 0;
    } else if (targetFaceIndex === 3) {
        targetYRot = targetView === 'outside' ? Math.PI / 2 : -Math.PI / 2;
    } else if (targetFaceIndex === 4) {
        targetXRot = Math.PI / 2;
        targetYRot = targetView === 'outside' ? 0 : Math.PI;
    } else if (targetFaceIndex === 5) {
        targetXRot = -Math.PI / 2;
        targetYRot = targetView === 'outside' ? 0 : Math.PI;
    }

    targetQuaternion.setFromEuler(new THREE.Euler(targetXRot, targetYRot, 0, 'YXZ'));

    resolveTimeout = setTimeout(() => {
        if (roundsPlayed >= ROUNDS_PER_SESSION) {
            showEndScreen();
        } else {
            startLevel();
        }
    }, 1500);
}

// --- INPUT ---
document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
        if (isResolving) {
            triggerHaptic();
            clearTimeout(resolveTimeout);
            if (roundsPlayed >= ROUNDS_PER_SESSION) {
                showEndScreen();
            } else {
                startLevel();
            }
            return;
        }
        const idx = parseInt(card.getAttribute('data-index'));
        resolveLevel(idx);
    });
});

// --- DRAG TO ROTATE ---
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
const DRAG_SENSITIVITY = 0.007;
const _quatY = new THREE.Quaternion();
const _quatX = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);

const gameContainer = document.getElementById('game-container');

gameContainer.addEventListener('mousedown', e => {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
});

gameContainer.addEventListener('touchstart', e => {
    isDragging = true;
    lastPointerX = e.touches[0].clientX;
    lastPointerY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    _quatY.setFromAxisAngle(_axisY, -dx * DRAG_SENSITIVITY);
    _quatX.setFromAxisAngle(_axisX, -dy * DRAG_SENSITIVITY);
    shapeGroup.quaternion.premultiply(_quatY).premultiply(_quatX);
});

window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - lastPointerX;
    const dy = e.touches[0].clientY - lastPointerY;
    lastPointerX = e.touches[0].clientX;
    lastPointerY = e.touches[0].clientY;
    _quatY.setFromAxisAngle(_axisY, -dx * DRAG_SENSITIVITY);
    _quatX.setFromAxisAngle(_axisX, -dy * DRAG_SENSITIVITY);
    shapeGroup.quaternion.premultiply(_quatY).premultiply(_quatX);
}, { passive: true });

window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('touchend', () => { isDragging = false; });

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (!isResolving && !isDragging) {
        shapeGroup.rotation.x += 0.003;
        shapeGroup.rotation.y += 0.005;
        shapeGroup.rotation.z += 0.002;
    } else if (isResolving) {
        shapeGroup.quaternion.slerp(targetQuaternion, 0.1);
    }

    const currentFrameIndex = Math.floor(Date.now() / 1000) % FRAME_COUNT;

    if (currentFrameIndex !== lastDrawnFrame && currentOptions.length > 0) {
        lastDrawnFrame = currentFrameIndex;

        shapeGroup.children.forEach((frameGroup, idx) => {
            frameGroup.visible = (idx === currentFrameIndex);
        });

        const cards = document.querySelectorAll('.option-card');
        cards.forEach((card, index) => {
            if (currentOptions[index]) {
                const canvas = card.querySelector('canvas');
                draw2DSegments(canvas, currentOptions[index].sequence[currentFrameIndex]);
            }
        });
    }

    renderer.render(scene, camera);
}

// --- RESIZE ---
window.addEventListener('resize', () => {
    const { width, height } = getCanvasSize();
    const newAspect = width / height;
    camera.left = -frustumSize * newAspect / 2;
    camera.right = frustumSize * newAspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    shapeGroup.children.forEach(frameGroup => {
        frameGroup.children.forEach(child => {
            if (child.material && child.material.resolution) {
                child.material.resolution.set(width, height);
            }
        });
    });
});

// --- VERSION ---
fetch('manifest.json')
    .then(r => r.json())
    .then(manifest => {
        if (!manifest.version) return;
        const v = 'v' + manifest.version;
        const elV = document.getElementById('app-version');
        const elVI = document.getElementById('app-version-intro');
        if (elV) elV.innerText = v;
        if (elVI) elVI.innerText = v;
    })
    .catch(() => {});

// --- INTRO / INFO ---
const introEl = document.getElementById('intro');

document.getElementById('play-btn').addEventListener('click', () => {
    triggerHaptic();
    introEl.classList.remove('visible');
});

document.getElementById('info-btn').addEventListener('click', () => {
    triggerHaptic();
    introEl.classList.add('visible');
});

// --- STATS ---
document.getElementById('stats-btn').addEventListener('click', () => {
    triggerHaptic(); 
    openHistoryModal();
});

document.getElementById('close-history-btn').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('history-modal').classList.add('hidden');
});

// --- END SCREEN ACTIONS ---
document.getElementById('hub-link').addEventListener('click', () => { triggerHaptic(); });

document.getElementById('play-again-btn').addEventListener('click', () => {
    triggerHaptic();
    sessionSolved = 0;
    sessionFailed = 0;
    roundsPlayed = 0;
    score = 0;
    document.getElementById('score').innerText = 0;
    document.getElementById('end-screen').classList.remove('visible');
    isResolving = false;
    startLevel();
});

// --- INIT ---
initHaptic();
startLevel();
animate();
