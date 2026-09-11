import * as THREE from 'three';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from './assets/match-3/GridGenerator';
import { buildGridColliders } from './assets/match-3/GridColliderSync';
import { AdaptiveCamera } from './assets/match-3/AdaptiveCamera';
import { PhysicsWorld } from './assets/match-3/physics/PhysicsWorld';
import { CollisionResolver } from './assets/match-3/physics/CollisionResolver';
import { LineCollider } from './assets/match-3/physics/colliders/LineCollider';
import { SphereSpawner } from './assets/match-3/SphereSpawner';
import { TubeView } from './assets/match-3/TubeView';
import { DoorPair } from './assets/match-3/DoorPair';

// --- Renderer, single shared scene/camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

// --- Match-3 grid ---
const ROWS = 8;
const COLS = 12;
const CELL_SIZE = 0.5;
const GAP = CELL_SIZE * 0.15;
const CELL_PITCH = CELL_SIZE + GAP;
const GRID_WIDTH = COLS * CELL_SIZE + (COLS - 1) * GAP;

const gridGenerator = new GridGenerator({ rows: ROWS, cols: COLS, colorCount: 4 });
const gridModel = new GridModel(gridGenerator);
const gridView = new ThreeGridView({
    rows: ROWS,
    cols: COLS,
    scene,
    camera,
    renderer,
    cellSize: CELL_SIZE,
    gap: GAP,
});

const adaptiveCamera = new AdaptiveCamera({
    camera,
    contentWidth: GRID_WIDTH,
    widthFraction: 0.9,
    baseFov: 40,
    minFov: 22,
    maxFov: 65,
    baseDistance: 10,
    minDistance: 5,
    maxDistance: 18,
    tiltDeg: 16,
    marginBottom: 0.05,
});

const collisionResolver = new CollisionResolver({ cellSize: CELL_PITCH });
const physicsWorld = new PhysicsWorld(collisionResolver, { gravity: 9.8, maxSpeed: 25 });

function syncBoxColliders(): void {
    collisionResolver.setBoxColliders(buildGridColliders(gridModel, gridView));
}

const gridController = new GridController(gridModel, gridView, { onBoardChanged: syncBoxColliders });
syncBoxColliders();

const leftEdge = gridView.getCellCenter2D(0, 0).x - CELL_PITCH / 2;
const rightEdge = gridView.getCellCenter2D(0, COLS - 1).x + CELL_PITCH / 2;
const topRowY = gridView.getCellCenter2D(0, 0).y;

// --- Upright bottle: narrow neck (the exit path) on top, wide mouth at the bottom holding the spheres ---
const MOUTH_WIDTH = GRID_WIDTH;
const NECK_WIDTH = CELL_PITCH * 2.5;
const TUBE_HEIGHT = CELL_PITCH * 30;
const NECK_HEIGHT_FRACTION = .99;

const mouthBottomY = topRowY + CELL_PITCH * 0.5;
const neckTopY = mouthBottomY + TUBE_HEIGHT * 2;

const tubeView = new TubeView({
    scene,
    neckTopY,
    mouthBottomY,
    neckWidth: NECK_WIDTH,
    mouthWidth: MOUTH_WIDTH,
    neckHeightFraction: NECK_HEIGHT_FRACTION,
    shoulderSegments: 8,
});

// --- Doors guarding the neck's top opening — the "path" from the original spec ---
const doorPair = new DoorPair({
    scene,
    doorY: neckTopY,
    openingWidth: NECK_WIDTH,
});

function syncWallColliders(): void {
    collisionResolver.setSegments([...tubeView.colliders, ...doorPair.getColliders()]);
}

collisionResolver.setPlanes([
    new LineCollider(new THREE.Vector2(leftEdge, 0), new THREE.Vector2(1, 0)),
    new LineCollider(new THREE.Vector2(rightEdge, 0), new THREE.Vector2(-1, 0)),
]);
syncWallColliders();

// --- Spawn once, packed into the wide mouth just above the grid ---
const shoulderHeight = TUBE_HEIGHT * (1 - NECK_HEIGHT_FRACTION);
const TOTAL_SPHERES = 1000;

const spawner = new SphereSpawner({
    scene,
    world: physicsWorld,
    totalSpheres: TOTAL_SPHERES,
    spawnMinX: -MOUTH_WIDTH / 10 + CELL_PITCH * 0.1,
    spawnMaxX: MOUTH_WIDTH / 10 - CELL_PITCH * 0.1,
    spawnMinY: mouthBottomY + CELL_PITCH * 0.4,
    spawnMaxY: mouthBottomY + shoulderHeight * 100, // stays in the lower, wider part of the shoulder — avoid the narrowing upper region
    despawnY: -CELL_PITCH * 3,
    radius: CELL_PITCH * 0.3,
    colors: [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55],
});
spawner.spawnAll();

// --- Win condition: doors open in proportion to spheres cleared. ---
// This is one reasonable reading of "win when the path is clear" — not the
// only one. An alternative you might prefer: keep doors shut until 100%
// cleared, then open (rather than opening gradually alongside progress).
// Swap the fraction below for whatever rule you settle on.
let despawnedCount = 0;
spawner.onDespawn(() => {
    despawnedCount++;
});

window.addEventListener('resize', () => {
    adaptiveCamera.handleResize();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    spawner.update();
    physicsWorld.step(deltaSeconds);

    const clearedFraction = despawnedCount / TOTAL_SPHERES;
    doorPair.setOpenAmount(clearedFraction);
    syncWallColliders(); // doors moved — resolver's segment list needs the updated angle

    renderer.render(scene, camera);
}
animate();