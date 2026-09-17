import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from './assets/match-3/GridGenerator';
import { AdaptiveCamera } from './assets/match-3/AdaptiveCamera';
import { PhysicsWorld } from './assets/match-3/physics/PhysicsWorld';
import { SquareCollider } from './assets/match-3/physics/colliders/SquareCollider';
import { SegmentCollider } from './assets/match-3/physics/colliders/SegmentCollider';
import { SphereSpawner } from './assets/match-3/SphereSpawner';
import { TubeView } from './assets/match-3/TubeView';
import { PlatformCharacter } from './assets/match-3/PlatformCharacter';
import { ChaserPlatform } from './assets/match-3/ChaserPlatform';
import { Door } from './assets/match-3/Door';
import { GameOverlay } from './assets/match-3/GameOverlay';
import { TubeBackdrop } from './assets/match-3/TubeBackdrop';
import { Vignette } from './assets/match-3/Vignette';
import { GroundPlane } from './assets/match-3/GroundPlane';
import { NeckPath } from './assets/match-3/NeckPath';
import { createNeckProfile } from './assets/match-3/NeckProfile';
import { buildSerpentineWaypoints } from './assets/match-3/SerpentineWaypoints';

const GRID_ROWS = 8;
const GRID_COLS = 11;
const GRID_CELL_SIZE = 0.5;
const GRID_CELL_GAP = 0.03;
const GRID_COLOR_COUNT = 3;

const BACKGROUND_TEXTURE_URL = '/textures/dirt.png';
const BACKGROUND_NORMAL_MAP_URL = '/textures/dirt_normal.png';
const BACKGROUND_TILE_WORLD_SIZE = 2;
const BACKGROUND_NORMAL_SCALE = 2;
const GROUND_WIDTH = 300;
const GROUND_HEIGHT = 300;
const DEPTH_GROUND = -50;
const VIGNETTE_STRENGTH = 0.88;
const VIGNETTE_INNER_RADIUS_PERCENT = 30;
const TUBE_BACKDROP_OPACITY = 0.7;
const DEPTH_TUBE_BACKDROP = -0.3;

const CAMERA_WIDTH_FRACTION = 0.9;
const CAMERA_BASE_FOV_DEG = 12;
const CAMERA_MIN_FOV_DEG = 8;
const CAMERA_MAX_FOV_DEG = 20;
const CAMERA_MIN_DISTANCE = 30;
const CAMERA_MAX_DISTANCE = 100;
const CAMERA_TILT_DEG = 16;
const CAMERA_MARGIN_BOTTOM = 0.05;
const CAMERA_FAR_PLANE = 300;

const PHYSICS_GRAVITY = 9.8;

const SPHERE_RADIUS = 0.15;
const SPHERE_TOTAL_COUNT = 6000;
const SPHERE_MASS = 1;
const SPHERE_RESTITUTION = 0.15;
const SPHERE_PACKING_FACTOR = 1.22;
const SPHERE_JITTER = 0.15;
const SPHERE_RADIUS_VARIANCE = 0.35;
const SPHERE_COLORS = [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55, 0xcc66ff];
const MARBLE_FILL_START_T = 0.05;

const NECK_HALF_WIDTH = 0.6;
const MOUTH_HALF_WIDTH = 3.0;
const TUBE_SEGMENTS = 200;
const TUBE_WALL_THICKNESS = 0.2;
const TUBE_HEIGHT = 7.0;
const TUBE_GAP_ABOVE_GRID = 0.2;
const TUBE_TOP_EXTENSION_LENGTH = 8;

const SERPENTINE_RUNS = 3;
const SERPENTINE_RUN_HALF_LENGTH = 0.9;
const SERPENTINE_BEND_RADIUS = 1.1;
const SERPENTINE_BEND_SAMPLES = 10;
const SERPENTINE_MERGE_FRACTION = 0.5;
const SERPENTINE_RUN_SLOPE_FRACTION = 0;

const PLATFORM_START_T = 0.02;
const PLATFORM_HALF_WIDTH = 0.58;
const PLATFORM_HALF_THICKNESS = 0.05;
const PLATFORM_MASS = 10;
const PLATFORM_RESTITUTION = 0.05;
const PLATFORM_PUSH_ACCELERATION = 3.5 * PHYSICS_GRAVITY;
const PLATFORM_COLOR = 0x8899aa;
const CHARACTER_SIZE = 0.3;
const CHARACTER_COLOR = 0xff4477;

const DOOR_T = 0.95;
const DOOR_HEIGHT = 0.8;
const DOOR_COLOR = 0xd9a441;

const CHASER_SPEED_T_PER_SECOND = DOOR_T / 30;
const CHASER_COLOR = 0xaa2222;

const INTRO_HOLD_SECONDS = 0.8;
const INTRO_FADE_SECONDS = 1;
const INTRO_PUSH_DELAY_SECONDS = INTRO_HOLD_SECONDS;
const INTRO_CHASER_DELAY_SECONDS = INTRO_PUSH_DELAY_SECONDS + 3;

const DEPTH_TUBE_WALLS = 0.4;
const DEPTH_PLATFORM = 0.5;
const DEPTH_DOOR = -0.2;
const DEPTH_SPHERE_BASE = -0.1;
const DEPTH_SPHERE_JITTER = 0.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(CAMERA_BASE_FOV_DEG, window.innerWidth / window.innerHeight, 0.1, CAMERA_FAR_PLANE);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

new Vignette({ strength: VIGNETTE_STRENGTH, innerRadiusPercent: VIGNETTE_INNER_RADIUS_PERCENT });

const introFade = document.createElement('div');
introFade.style.cssText = [
    'position:fixed', 'inset:0', 'background:#000', 'z-index:20', 'pointer-events:none',
    `transition:opacity ${INTRO_FADE_SECONDS}s ease`, 'opacity:1',
].join(';');
document.body.appendChild(introFade);
setTimeout(() => { introFade.style.opacity = '0'; }, INTRO_HOLD_SECONDS * 1000);
setTimeout(() => introFade.remove(), (INTRO_HOLD_SECONDS + INTRO_FADE_SECONDS) * 1000);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

const cubeGltf = await new GLTFLoader().loadAsync('/meshes/cube.glb');
let gridBoxGeometry: THREE.BufferGeometry | undefined;
cubeGltf.scene.traverse((child) => {
    if (!gridBoxGeometry && child instanceof THREE.Mesh) gridBoxGeometry = child.geometry;
});
if (!gridBoxGeometry) throw new Error('cube.glb contains no mesh');
gridBoxGeometry.scale(0.5, 0.5, 0.5);

const physicsWorld = new PhysicsWorld({ gravity: PHYSICS_GRAVITY });

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
    boxGeometry: gridBoxGeometry,
    physicsWorld,
});

const gridWidth = GRID_COLS * GRID_CELL_SIZE + (GRID_COLS - 1) * GRID_CELL_GAP;
const gridCellPitch = GRID_CELL_SIZE + GRID_CELL_GAP;
const spawnerDespawnY = -gridCellPitch * 3;

const tubeWidth = 2 * (SERPENTINE_RUN_HALF_LENGTH + SERPENTINE_BEND_RADIUS + NECK_HALF_WIDTH);
const contentWidth = Math.max(gridWidth, tubeWidth);

const adaptiveCamera = new AdaptiveCamera({
    camera,
    contentWidth,
    widthFraction: CAMERA_WIDTH_FRACTION,
    baseFov: CAMERA_BASE_FOV_DEG,
    minFov: CAMERA_MIN_FOV_DEG,
    maxFov: CAMERA_MAX_FOV_DEG,
    minDistance: CAMERA_MIN_DISTANCE,
    maxDistance: CAMERA_MAX_DISTANCE,
    tiltDeg: CAMERA_TILT_DEG,
    marginBottom: CAMERA_MARGIN_BOTTOM,
});

const gridTopRowY = gridView.getCellCenter2D(0, 0).y;

const mouthBottomY = gridTopRowY + TUBE_GAP_ABOVE_GRID;
const neckTopY = mouthBottomY + TUBE_HEIGHT;

new GroundPlane({
    scene,
    textureUrl: BACKGROUND_TEXTURE_URL,
    normalMapUrl: BACKGROUND_NORMAL_MAP_URL,
    width: GROUND_WIDTH,
    height: GROUND_HEIGHT,
    tileWorldSize: BACKGROUND_TILE_WORLD_SIZE,
    center: new THREE.Vector2(0, (mouthBottomY + neckTopY) / 2),
    renderDepth: DEPTH_GROUND,
    normalScale: BACKGROUND_NORMAL_SCALE,
});

const { waypoints: neckWaypoints, straightApproachStart } = buildSerpentineWaypoints({
    top: new THREE.Vector2(0, neckTopY),
    bottom: new THREE.Vector2(0, mouthBottomY),
    runs: SERPENTINE_RUNS,
    runHalfLength: SERPENTINE_RUN_HALF_LENGTH,
    bendRadius: SERPENTINE_BEND_RADIUS,
    bendSamples: SERPENTINE_BEND_SAMPLES,
    mergeFraction: SERPENTINE_MERGE_FRACTION,
    runSlopeFraction: SERPENTINE_RUN_SLOPE_FRACTION,
});
const neckPath = new NeckPath({ waypoints: neckWaypoints });

const neckFraction = neckPath.findClosestT(straightApproachStart);

const neckProfile = createNeckProfile({
    neckHalfWidth: NECK_HALF_WIDTH,
    mouthHalfWidth: MOUTH_HALF_WIDTH,
    neckFraction,
});

const tubeView = new TubeView({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    segments: TUBE_SEGMENTS,
    wallThickness: TUBE_WALL_THICKNESS,
    renderDepth: DEPTH_TUBE_WALLS,
    textureUrl: BACKGROUND_TEXTURE_URL,
    tileWorldSize: BACKGROUND_TILE_WORLD_SIZE,
});

new TubeBackdrop({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    segments: TUBE_SEGMENTS,
    opacity: TUBE_BACKDROP_OPACITY,
    renderDepth: DEPTH_TUBE_BACKDROP,
});

const tubeSeamPoint = neckPath.getPoint(0);
const tubeSeamTangent = neckPath.getTangent(0);
const topExtensionPath = new NeckPath({
    waypoints: [
        tubeSeamPoint.clone().addScaledVector(tubeSeamTangent, -TUBE_TOP_EXTENSION_LENGTH),
        tubeSeamPoint,
    ],
});
const topExtensionHalfWidth = (): number => NECK_HALF_WIDTH;

const topExtensionMarbleEndT = 1 - (PLATFORM_HALF_WIDTH + CHARACTER_SIZE) / TUBE_TOP_EXTENSION_LENGTH;

const topExtensionWallSegments = Math.ceil(TUBE_TOP_EXTENSION_LENGTH / (TUBE_WALL_THICKNESS / 3));

const topExtensionTube = new TubeView({
    scene,
    path: topExtensionPath,
    halfWidthAt: topExtensionHalfWidth,
    segments: topExtensionWallSegments,
    wallThickness: TUBE_WALL_THICKNESS,
    renderDepth: DEPTH_TUBE_WALLS,
    textureUrl: BACKGROUND_TEXTURE_URL,
    tileWorldSize: BACKGROUND_TILE_WORLD_SIZE,
});

new TubeBackdrop({
    scene,
    path: topExtensionPath,
    halfWidthAt: topExtensionHalfWidth,
    segments: 2,
    opacity: TUBE_BACKDROP_OPACITY,
    renderDepth: DEPTH_TUBE_BACKDROP,
});

function buildCrossBarrier(center: THREE.Vector2, normal: THREE.Vector2, halfWidth: number, samples = 10): SegmentCollider[] {
    const chain: SegmentCollider[] = [];
    let prev = center.clone().addScaledVector(normal, -halfWidth);
    for (let i = 1; i <= samples; i++) {
        const across = -halfWidth + (2 * halfWidth) * (i / samples);
        const next = center.clone().addScaledVector(normal, across);
        chain.push(new SegmentCollider(prev, next));
        prev = next;
    }
    return chain;
}

const topExtensionBarrierNormal = new THREE.Vector2(-tubeSeamTangent.y, tubeSeamTangent.x);
const topExtensionBarrierChain = buildCrossBarrier(
    topExtensionPath.getPoint(topExtensionMarbleEndT), topExtensionBarrierNormal, NECK_HALF_WIDTH
);
const topExtensionDeadEndBarrierChain = buildCrossBarrier(
    topExtensionPath.getPoint(0), topExtensionBarrierNormal, NECK_HALF_WIDTH
);

physicsWorld.setStaticWalls(
    [
        tubeView.leftColliders, tubeView.rightColliders,
        topExtensionTube.leftColliders, topExtensionTube.rightColliders,
        topExtensionBarrierChain, topExtensionDeadEndBarrierChain,
    ],
    TUBE_WALL_THICKNESS
);

const GRID_SIDE_WALL_THICKNESS = 0.3;
const gridSideWallHeight = mouthBottomY - spawnerDespawnY;
const gridSideWallCenterY = (mouthBottomY + spawnerDespawnY) / 2;
physicsWorld.addStaticBoxes([
    new SquareCollider(
        new THREE.Vector2(-gridWidth / 2 - GRID_SIDE_WALL_THICKNESS / 2, gridSideWallCenterY),
        new THREE.Vector2(GRID_SIDE_WALL_THICKNESS / 2, gridSideWallHeight / 2),
        'grid-wall-left'
    ),
    new SquareCollider(
        new THREE.Vector2(gridWidth / 2 + GRID_SIDE_WALL_THICKNESS / 2, gridSideWallCenterY),
        new THREE.Vector2(GRID_SIDE_WALL_THICKNESS / 2, gridSideWallHeight / 2),
        'grid-wall-right'
    ),
]);

const characterExclusion = {
    center: neckPath.getPoint(PLATFORM_START_T),
    radius: PLATFORM_HALF_WIDTH + CHARACTER_SIZE,
};

const spawner = new SphereSpawner({
    scene,
    world: physicsWorld,
    totalSpheres: SPHERE_TOTAL_COUNT,
    despawnY: spawnerDespawnY,
    radius: SPHERE_RADIUS,
    radiusVariance: SPHERE_RADIUS_VARIANCE,
    colors: SPHERE_COLORS,
    packingFactor: SPHERE_PACKING_FACTOR,
    jitter: SPHERE_JITTER,
    mass: SPHERE_MASS,
    restitution: SPHERE_RESTITUTION,
    renderDepth: DEPTH_SPHERE_BASE,
    renderDepthJitter: DEPTH_SPHERE_JITTER,
    excludeNear: characterExclusion,
});

const gridTopSurfaceY = gridTopRowY + (GRID_CELL_SIZE + GRID_CELL_GAP) / 2 + 0.01;
const marbleFillEndY = gridTopSurfaceY + SPHERE_RADIUS + 0.05;
const marbleFillEndT = neckPath.findClosestT(new THREE.Vector2(0, marbleFillEndY));

spawner.spawnAll([
    {
        kind: 'path',
        path: topExtensionPath,
        halfWidthAt: topExtensionHalfWidth,
        startT: 0,
        endT: topExtensionMarbleEndT,
    },
    {
        kind: 'path',
        path: neckPath,
        halfWidthAt: neckProfile,
        startT: MARBLE_FILL_START_T,
        endT: marbleFillEndT,
    },
]);

const topExtensionStart = topExtensionPath.getPoint(0);
const topExtensionEnd = topExtensionPath.getPoint(1);
const topExtensionDelta = topExtensionEnd.clone().sub(topExtensionStart);
const topExtensionLengthSq = topExtensionDelta.lengthSq();

function isOnTopExtension(position: THREE.Vector2): boolean {
    const along = position.clone().sub(topExtensionStart).dot(topExtensionDelta) / topExtensionLengthSq;
    if (along < 0 || along > 1) return false;
    const closest = topExtensionStart.clone().addScaledVector(topExtensionDelta, along);
    return position.distanceTo(closest) <= topExtensionHalfWidth() + TUBE_WALL_THICKNESS;
}

const SCREEN_MARGIN_NDC = 0.1;

function isOnScreen(position: THREE.Vector2): boolean {
    const ndc = new THREE.Vector3(position.x, position.y, 0).project(camera);
    return ndc.x >= -1 - SCREEN_MARGIN_NDC && ndc.x <= 1 + SCREEN_MARGIN_NDC
        && ndc.y >= -1 - SCREEN_MARGIN_NDC && ndc.y <= 1 + SCREEN_MARGIN_NDC
        && ndc.z < 1;
}

function isVisibleExtensionMarble(position: THREE.Vector2): boolean {
    return isOnTopExtension(position) && isOnScreen(position);
}

spawner.removeWhere(isVisibleExtensionMarble);

let gameEnded = false;

const gameOverlay = new GameOverlay({
    onRestart: () => window.location.reload(),
});

let platformArrived = false;

const platformCharacter = new PlatformCharacter({
    scene,
    world: physicsWorld,
    position: neckPath.getPoint(PLATFORM_START_T),
    initialTangent: neckPath.getTangent(PLATFORM_START_T),
    platformHalfWidth: PLATFORM_HALF_WIDTH,
    platformHalfThickness: PLATFORM_HALF_THICKNESS,
    characterSize: CHARACTER_SIZE,
    mass: PLATFORM_MASS,
    restitution: PLATFORM_RESTITUTION,
    pushAcceleration: PLATFORM_PUSH_ACCELERATION,
    arrivalT: DOOR_T,
    onArrive: () => {
        platformArrived = true;
    },
    platformColor: PLATFORM_COLOR,
    characterColor: CHARACTER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

const chaser = new ChaserPlatform({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    speedTPerSecond: CHASER_SPEED_T_PER_SECOND,
    color: CHASER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

const doorCenter = neckPath.getPoint(DOOR_T);
const doorHalfWidth = neckProfile(DOOR_T);

new Door({
    scene,
    center: doorCenter,
    halfWidth: doorHalfWidth,
    height: DOOR_HEIGHT,
    color: DOOR_COLOR,
    renderDepth: DEPTH_DOOR,
    textureUrl: '/textures/door.png',
});

const doorHalfHeight = DOOR_HEIGHT / 2;
function isDoorClear(): boolean {
    for (const sphere of physicsWorld.getSpheres()) {
        const { center, radius } = sphere.collider;
        if (Math.abs(center.x - doorCenter.x) < doorHalfWidth + radius
            && Math.abs(center.y - doorCenter.y) < doorHalfHeight + radius) {
            return false;
        }
    }
    return true;
}

new GridController(gridModel, gridView);

window.addEventListener('resize', () => {
    adaptiveCamera.handleResize();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
let elapsedSeconds = 0;
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    if (!gameEnded) {
        elapsedSeconds += deltaSeconds;
        spawner.update();
        spawner.removeWhere(isVisibleExtensionMarble);
        if (elapsedSeconds >= INTRO_PUSH_DELAY_SECONDS) {
            platformCharacter.pushTowardDoor(neckPath, deltaSeconds);
        }
        platformCharacter.sync();
        physicsWorld.step(deltaSeconds);
        platformCharacter.clampSpeed();
        if (elapsedSeconds >= INTRO_CHASER_DELAY_SECONDS) {
            chaser.update(deltaSeconds);
        }

        if (platformArrived && isDoorClear()) {
            gameEnded = true;
            gameOverlay.showWin();
        } else {
            const playerT = neckPath.findClosestT(platformCharacter.box.collider.center);
            if (chaser.t >= playerT) {
                gameEnded = true;
                gameOverlay.showLose();
            }
        }
    }

    renderer.render(scene, camera);
}
animate();
