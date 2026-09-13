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
import { PlatformCharacter } from './assets/match-3/PlatformCharacter';
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

// --- Camera --- (narrow FOV + long distance reads as near-orthographic while the tilt still sells depth)
const CAMERA_WIDTH_FRACTION = 0.9;
const CAMERA_BASE_FOV_DEG = 12;
const CAMERA_MIN_FOV_DEG = 8;
const CAMERA_MAX_FOV_DEG = 20;
const CAMERA_MIN_DISTANCE = 30;
const CAMERA_MAX_DISTANCE = 100;
const CAMERA_TILT_DEG = 16;
const CAMERA_MARGIN_BOTTOM = 0.05;
const CAMERA_FAR_PLANE = 300; // pushed out to match the much larger camera distance above

// --- Physics ---
const PHYSICS_GRAVITY = 9.8;
const PHYSICS_MAX_SPEED = 25;

// --- Marbles ---
const SPHERE_RADIUS = 0.15;
const SPHERE_TOTAL_COUNT = 6000; // deliberately exceeds the tube's packing capacity so it always spawns completely full
const SPHERE_MASS = 1;
const SPHERE_RESTITUTION = 0.15;
const SPHERE_PACKING_FACTOR = 1.1;
const SPHERE_JITTER = 0.15;
const SPHERE_COLORS = [0xffffff];
const MARBLE_FILL_START_T = 0.07; // leaves a gap at the very top of the tube for the platform to rest into

// --- Bottleneck (neck = narrow top path, mouth = wide bottom pool) ---
const NECK_HALF_WIDTH = 0.55;       // widened from the previous thread-thin 0.28
const MOUTH_HALF_WIDTH = 3.0;
const NECK_FRACTION = 0.9;         // stays neck-width until 65% along, so the mid-path gate sits in the narrow section
const TUBE_SEGMENTS = 32;
const TUBE_WALL_THICKNESS = 0.2;
const TUBE_HEIGHT = 18.0;
const TUBE_CURVE_SWING = 0;         // 0 = straight tube for now; the S-curve machinery stays for later
const TUBE_CURVE_WAVES = 2;
const TUBE_CURVE_SAMPLES = 14;
const TUBE_GAP_ABOVE_GRID = 0.2;

// --- Rescue platform + character (a box for now) ---
const PLATFORM_START_T = 0.02; // starts right at the top of the tube, on top of the fully-packed pile
const PLATFORM_HALF_WIDTH = NECK_HALF_WIDTH * 0.8;
const PLATFORM_HALF_THICKNESS = 0.06;
const PLATFORM_MASS = 8;
const PLATFORM_RESTITUTION = 0.05;
const PLATFORM_COLOR = 0x8899aa;
const CHARACTER_SIZE = 0.3;
const CHARACTER_COLOR = 0xff4477;

// --- Render depths ---
const DEPTH_TUBE_WALLS = 0.4;
const DEPTH_PLATFORM = 0.5;
const DEPTH_SPHERE_BASE = -0.1; // pulled back from the grid boxes' front face so marbles don't visually poke through cell edges
const DEPTH_SPHERE_JITTER = 0.05;

// ============================================================
// SETUP
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(CAMERA_BASE_FOV_DEG, window.innerWidth / window.innerHeight, 0.1, CAMERA_FAR_PLANE);

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
// SPAWN MARBLES — packed along the whole tube
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
        startT: MARBLE_FILL_START_T,
        endT: 1,
    },
]);

// ============================================================
// RESCUE PLATFORM + CHARACTER — starts resting on top of the full pile
// ============================================================

const platformCharacter = new PlatformCharacter({
    scene,
    world: physicsWorld,
    position: neckPath.getPoint(PLATFORM_START_T),
    platformHalfWidth: PLATFORM_HALF_WIDTH,
    platformHalfThickness: PLATFORM_HALF_THICKNESS,
    characterSize: CHARACTER_SIZE,
    mass: PLATFORM_MASS,
    restitution: PLATFORM_RESTITUTION,
    platformColor: PLATFORM_COLOR,
    characterColor: CHARACTER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

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

    spawner.update();
    platformCharacter.sync();
    physicsWorld.step(deltaSeconds);

    // TODO (win/lose, not implemented yet): a timer counting down, and a win
    // check once the door's zone is clear of marbles and the platform/
    // character has reached it.

    renderer.render(scene, camera);
}
animate();