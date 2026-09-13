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
import { MarblePusher } from './assets/match-3/MarblePusher';
import { NeckPath } from './assets/match-3/NeckPath';
import { createNeckProfile } from './assets/match-3/NeckProfile';
import { buildSCurveWaypoints } from './assets/match-3/NeckWaypoints';

// ============================================================
// CONFIGURATION
// ============================================================

// --- Grid ---
const GRID_ROWS = 8;
const GRID_COLS = 11;
const GRID_CELL_SIZE = 0.5;
const GRID_CELL_GAP = 0.03;
const GRID_COLOR_COUNT = 3;

// --- Camera ---
const CAMERA_WIDTH_FRACTION = 0.9;
const CAMERA_BASE_FOV_DEG = 40;
const CAMERA_MIN_FOV_DEG = 22;
const CAMERA_MAX_FOV_DEG = 65;
const CAMERA_MIN_DISTANCE = 5;
const CAMERA_MAX_DISTANCE = 18;
const CAMERA_TILT_DEG = 16;
const CAMERA_MARGIN_BOTTOM = 0.05;

// --- Physics ---
const PHYSICS_GRAVITY = 9.8;
const PHYSICS_MAX_SPEED = 25;

// --- Marbles ---
const SPHERE_RADIUS = 0.15;
const SPHERE_TOTAL_COUNT = 220;
const SPHERE_MASS = 1;
const SPHERE_RESTITUTION = 0.15;
const SPHERE_PACKING_FACTOR = 1.1;
const SPHERE_JITTER = 0.15;
const SPHERE_COLORS = [0xffffff];

// --- Curved bottleneck (neck = narrow top path, mouth = wide bottom pool) ---
const NECK_HALF_WIDTH = 0.55;       // widened from the previous thread-thin 0.28
const MOUTH_HALF_WIDTH = 3.0;
const NECK_FRACTION = 0.65;         // stays neck-width until 65% along, so the mid-path gate sits in the narrow section
const TUBE_SEGMENTS = 32;
const TUBE_WALL_THICKNESS = 0.2;
const TUBE_HEIGHT = 6.0;
const TUBE_CURVE_SWING = 1.3;       // wider swing for a visibly winding path
const TUBE_CURVE_WAVES = 2;         // sin(t*PI*waves) needs a full period (waves=2) for a true S — waves=1 only makes a single "C" hump
const TUBE_CURVE_SAMPLES = 14;
const TUBE_GAP_ABOVE_GRID = 0.3;

// --- Pusher: continuous gentle creep, no extend/retract stroke ---
const PUSHER_START_T = 0.05;
const PUSHER_ADVANCE_SPEED = 0.03; // arc-length fraction per second — tune this for how "gentle" the push feels
const PUSHER_WALL_CLEARANCE = 0.04;
const PUSHER_THICKNESS = 0.14;
const PUSHER_COLOR = 0xdd8844;

// --- Render depths ---
const DEPTH_TUBE_WALLS = 0.4;
const DEPTH_PUSHER = 0.42;
const DEPTH_SPHERE_BASE = 0.5;
const DEPTH_SPHERE_JITTER = 0.05;

// ============================================================
// SETUP
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(CAMERA_BASE_FOV_DEG, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

// ============================================================
// MATCH-3 GRID
// ============================================================

const gridGenerator = new GridGenerator({ rows: GRID_ROWS, cols: GRID_COLS, colorCount: GRID_COLOR_COUNT });
const gridModel = new GridModel(gridGenerator);
const gridView = new ThreeGridView({
    rows: GRID_ROWS,
    cols: GRID_COLS,
    scene,
    camera,
    renderer,
    cellSize: GRID_CELL_SIZE,
    gap: GRID_CELL_GAP,
});

const gridWidth = GRID_COLS * GRID_CELL_SIZE + (GRID_COLS - 1) * GRID_CELL_GAP;
const gridCellPitch = GRID_CELL_SIZE + GRID_CELL_GAP;

const adaptiveCamera = new AdaptiveCamera({
    camera,
    contentWidth: gridWidth,
    widthFraction: CAMERA_WIDTH_FRACTION,
    baseFov: CAMERA_BASE_FOV_DEG,
    minFov: CAMERA_MIN_FOV_DEG,
    maxFov: CAMERA_MAX_FOV_DEG,
    minDistance: CAMERA_MIN_DISTANCE,
    maxDistance: CAMERA_MAX_DISTANCE,
    tiltDeg: CAMERA_TILT_DEG,
    marginBottom: CAMERA_MARGIN_BOTTOM,
});

// ============================================================
// PHYSICS WORLD
// ============================================================

const collisionResolver = new CollisionResolver({ cellSize: gridCellPitch });
const physicsWorld = new PhysicsWorld(collisionResolver, { gravity: PHYSICS_GRAVITY, maxSpeed: PHYSICS_MAX_SPEED });

function syncBoxColliders(): void {
    collisionResolver.setBoxColliders(buildGridColliders(gridModel, gridView));
}

new GridController(gridModel, gridView, { onBoardChanged: syncBoxColliders });
syncBoxColliders();

// ============================================================
// DERIVED LAYOUT
// ============================================================

const gridLeftEdge = gridView.getCellCenter2D(0, 0).x - gridCellPitch / 2;
const gridRightEdge = gridView.getCellCenter2D(0, GRID_COLS - 1).x + gridCellPitch / 2;
const gridTopRowY = gridView.getCellCenter2D(0, 0).y;

const mouthBottomY = gridTopRowY + TUBE_GAP_ABOVE_GRID;
const neckTopY = mouthBottomY + TUBE_HEIGHT;

// ============================================================
// CURVED BOTTLENECK: path, width profile, walls
// ============================================================

const neckWaypoints = buildSCurveWaypoints({
    top: new THREE.Vector2(0, neckTopY),
    bottom: new THREE.Vector2(0, mouthBottomY),
    swing: TUBE_CURVE_SWING,
    waves: TUBE_CURVE_WAVES,
    samples: TUBE_CURVE_SAMPLES,
});
const neckPath = new NeckPath({ waypoints: neckWaypoints });

const neckProfile = createNeckProfile({
    neckHalfWidth: NECK_HALF_WIDTH,
    mouthHalfWidth: MOUTH_HALF_WIDTH,
    neckFraction: NECK_FRACTION,
});

const tubeView = new TubeView({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    segments: TUBE_SEGMENTS,
    wallThickness: TUBE_WALL_THICKNESS,
    renderDepth: DEPTH_TUBE_WALLS,
});

// const neckGate = new NeckGate({
//     scene,
//     path: neckPath,
//     t: GATE_T,
//     halfWidth: neckProfile(GATE_T),
//     thickness: GATE_THICKNESS,
//     color: GATE_COLOR,
//     renderDepth: DEPTH_GATE,
// });

// Wall + gate colliders are both static for now (gate never opens), so this only needs to run once.
collisionResolver.setPlanes([
    new LineCollider(new THREE.Vector2(gridLeftEdge, 0), new THREE.Vector2(1, 0)),
    new LineCollider(new THREE.Vector2(gridRightEdge, 0), new THREE.Vector2(-1, 0)),
]);
collisionResolver.setSegments([...tubeView.colliders]);

// ============================================================
// PUSHER — creeps gently forward, stopped short of the closed gate
// ============================================================

const marblePusher = new MarblePusher({
    scene,
    path: neckPath,
    startT: PUSHER_START_T,
    maxT: 1,
    advanceSpeed: PUSHER_ADVANCE_SPEED,
    halfWidth: neckProfile(PUSHER_START_T) - PUSHER_WALL_CLEARANCE,
    thickness: PUSHER_THICKNESS,
    color: PUSHER_COLOR,
    renderDepth: DEPTH_PUSHER,
});

// Pusher's collider is mutated in place each frame; the resolver just needs the reference once.
collisionResolver.setPushers([marblePusher.getCollider()]);

// ============================================================
// SPAWN MARBLES — packed along the whole curved tube
// ============================================================

const spawner = new SphereSpawner({
    scene,
    world: physicsWorld,
    totalSpheres: SPHERE_TOTAL_COUNT,
    despawnY: -gridCellPitch * 3,
    radius: SPHERE_RADIUS,
    colors: SPHERE_COLORS,
    packingFactor: SPHERE_PACKING_FACTOR,
    jitter: SPHERE_JITTER,
    mass: SPHERE_MASS,
    restitution: SPHERE_RESTITUTION,
    renderDepth: DEPTH_SPHERE_BASE,
    renderDepthJitter: DEPTH_SPHERE_JITTER,
});

spawner.spawnAll([
    {
        kind: 'path',
        path: neckPath,
        halfWidthAt: neckProfile,
        startT: PUSHER_START_T + 0.02, // stay clear of the pusher's starting position
        endT: 1,
    },
]);

// ============================================================
// RESIZE + MAIN LOOP
// ============================================================

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

    marblePusher.update(deltaSeconds);
    spawner.update();
    physicsWorld.step(deltaSeconds);

    // TODO (win condition, not implemented yet): once neckGate's zone is
    // clear of both spheres and the pusher (marblePusher.hasReachedLimit()
    // relaxed alongside neckGate.setOpenAmount(1)), that's the win state.

    renderer.render(scene, camera);
}
animate();