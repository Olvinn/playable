import * as THREE from 'three';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from './assets/match-3/GridGenerator';
import { buildGridColliders } from './assets/match-3/GridColliderSync';
import { AdaptiveCamera } from './assets/match-3/AdaptiveCamera';
import { PhysicsWorld } from './assets/match-3/physics/PhysicsWorld';
import { SphereSpawner } from './assets/match-3/SphereSpawner';
import { TubeView } from './assets/match-3/TubeView';
import { PlatformCharacter } from './assets/match-3/PlatformCharacter';
import { Door } from './assets/match-3/Door';
import { WinOverlay } from './assets/match-3/WinOverlay';
import { TubeBackdrop } from './assets/match-3/TubeBackdrop';
import { Vignette } from './assets/match-3/Vignette';
import { GroundPlane } from './assets/match-3/GroundPlane';
import { NeckPath } from './assets/match-3/NeckPath';
import { createNeckProfile } from './assets/match-3/NeckProfile';
import { buildSerpentineWaypoints } from './assets/match-3/SerpentineWaypoints';

// ============================================================
// CONFIGURATION
// ============================================================

// --- Grid ---
const GRID_ROWS = 8;
const GRID_COLS = 11;
const GRID_CELL_SIZE = 0.5;
const GRID_CELL_GAP = 0.03;
const GRID_COLOR_COUNT = 3;

// --- Background ---
const BACKGROUND_TEXTURE_URL = '/textures/dirt.png';
const BACKGROUND_NORMAL_MAP_URL = '/textures/dirt_normal.png';
const BACKGROUND_TILE_WORLD_SIZE = 2; // world units per texture tile — keeps the same scale as before, now on real lit geometry
const BACKGROUND_NORMAL_SCALE = 2;
const GROUND_WIDTH = 300; // huge and static in world space so it covers the camera frustum at any zoom, no per-frame sizing needed
const GROUND_HEIGHT = 300;
const DEPTH_GROUND = -50; // far enough behind everything to never compete with it, well within the camera's far clip
const VIGNETTE_STRENGTH = 0.75;
const VIGNETTE_INNER_RADIUS_PERCENT = 40;
const TUBE_BACKDROP_OPACITY = 0.7;
const DEPTH_TUBE_BACKDROP = -0.3; // behind the marbles, so it reads as shadow rather than covering them

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

// --- Marbles ---
const SPHERE_RADIUS = 0.15;
const SPHERE_TOTAL_COUNT = 6000; // deliberately exceeds the tube's packing capacity so it always spawns completely full
const SPHERE_MASS = 1;
const SPHERE_RESTITUTION = 0.15;
// Loosened from 1.1 after moving to Matter.js: with the old hand-rolled solver's approximate
// collision, a tight starting pack didn't matter much because the solver was already imprecise.
// Matter's accurate narrow-phase resolves contacts exactly, so a tightly-packed pile settles into
// a genuinely rigid, load-bearing arch that a modest kinematic push can't reliably clear (verified
// directly: real, non-wall-related multi-marble jams at a fixed point, persisting for 80+
// simulated seconds even after the platform had real clearance from the walls). A bit more
// starting space gives the pile room to locally rearrange under the platform's push instead of
// locking rigid.
const SPHERE_PACKING_FACTOR = 1.3;
const SPHERE_JITTER = 0.15;
const SPHERE_COLORS = [0xffffff];
const MARBLE_FILL_START_T = 0.07; // leaves a gap at the very top of the tube for the platform to rest into

// --- Bottleneck (neck = narrow winding path, mouth = wide bottom pool) ---
const NECK_HALF_WIDTH = 0.6;        // wide enough for two marbles abreast, not so wide the tube's own footprint outgrows the grid it sits on
const MOUTH_HALF_WIDTH = 3.0;
// NECK_FRACTION is computed at runtime (see below) — it must land inside the guaranteed-straight
// final approach, or the widening ramp overlaps a curved hairpin and the offset walls self-intersect.
const TUBE_SEGMENTS = 200;          // higher than a straight/sine tube needs — the serpentine has several tight hairpins to approximate smoothly
const TUBE_WALL_THICKNESS = 0.2;
// Tall enough that adjacent runs' walls don't overlap: two runs are TUBE_HEIGHT/(RUNS+1) apart
// vertically, but each run's own wall sits NECK_HALF_WIDTH+WALL_THICKNESS/2 off its centerline —
// at 5.0 those overlapped by ~0.15 (a visible pinched "step" right where the path turns, and
// likely why the platform could get wedged there too, not just a cosmetic issue). 7.0 leaves a
// real gap between them.
const TUBE_HEIGHT = 7.0;            // short enough that the whole tube (character included) fits on screen at once, same as the reference — a camera tall enough to also fit an 18-unit tube would have to zoom out far enough to shrink the grid back to untappable
const TUBE_GAP_ABOVE_GRID = 0.2;

// --- Serpentine path: straight runs joined by hairpin U-turns (the Royal-Match-style pipe shape) ---
// Kept inside the grid's own width (see contentWidth below) — in the reference, the tube's whole
// footprint sits within the board underneath it; the board isn't shrunk to make room for the tube.
const SERPENTINE_RUNS = 3;
const SERPENTINE_RUN_HALF_LENGTH = 0.9;
const SERPENTINE_BEND_RADIUS = 1.1; // must clear NECK_HALF_WIDTH or the turn's inner wall pinches shut
const SERPENTINE_BEND_SAMPLES = 10;
const SERPENTINE_MERGE_FRACTION = 0.5;

// --- Rescue platform + character (a box for now) ---
const PLATFORM_START_T = 0.02; // starts right at the top of the tube, on top of the fully-packed pile
// The platform's physics body now rotates to track the tube's local direction (see
// PlatformCharacter's bounded setAngularVelocity() correction), which is what makes a wider
// platform possible at all: a fixed-orientation box can't go around *any* curve, however gentle,
// without a corner catching the wall the instant the corridor's direction rotates away from its
// fixed edges. This is a real, verified improvement over matching the tube's own width (0.6),
// which still hit a hard stall in testing, and a meaningful increase over the previous 0.33 — but
// be aware it isn't a complete fix: under heavy local marble load the *rotational* degree of
// freedom can get arrested the same way straight-line motion once did (contact resolution can
// cancel a commanded angular velocity to exactly zero, mid-turn), so an occasional long pause
// while rounding the tightest bends is still possible. Reducing this value trades some visual
// width back for a lower chance of hitting that.
const PLATFORM_HALF_WIDTH = 0.5;
const PLATFORM_HALF_THICKNESS = 0.05;
// A realistic weight for a small plank + person, not the 100x-a-marble value this used to be —
// that was tuned specifically to muscle through a stubborn bottleneck near the mouth, at the cost
// of every contact (not just that one) getting shoved harder than it should, which is what read as
// the platform pushing too aggressively overall. See PLATFORM_PUSH_ACCELERATION below for how the
// forward push itself is now derived from weight rather than tuned as a flat number.
const PLATFORM_MASS = 10;
const PLATFORM_RESTITUTION = 0.05;
// A genuine force now (see PhysicsBox.applyAcceleration and PlatformCharacter.pushTowardDoor), not
// a kinematic speed the platform simply teleported to every frame regardless of resistance —
// that's what made it feel like it was pushing too hard, since "reach this speed no matter what's
// in the way" isn't how a person pushing something actually works. Expressed directly as a
// multiple of gravity rather than an arbitrary world-units/s² figure, because applyAcceleration()
// turns that into `mass * acceleration` automatically — so 1.0 here really does mean "the character
// pushes with a force equal to their own (and the platform's) combined weight," independent of
// whatever PLATFORM_MASS happens to be — the most literal reading of "only pushes with its own
// weight." On a vertical run gravity itself (applied to every body already) adds to this along the
// same direction; on a horizontal run this is genuinely the only forward force there is.
//
// Tested 0.3g through 2g directly: below ~1g it can stall completely and immediately, at the very
// top of the tube where packing is densest. Above 1g, more force stopped helping — 1g and 2g hit
// the exact same wall partway through and neither could push past it. That's a real, physical
// granular arch (marbles bridging into a self-supporting structure, the same way sand can jam in
// an hourglass neck), not an undersized force — no amount of straight-ahead push breaks an arch
// like that; it needs to be disturbed some other way. So this value is chosen as "the most force
// that's still just their own weight, and no more, since more doesn't reliably help anyway" — not
// a guarantee the platform can never stall. It can, on a badly-arched pile. That's the honest
// tradeoff of a physically real push replacing the old artificially strong one.
const PLATFORM_PUSH_ACCELERATION = 1.0 * PHYSICS_GRAVITY;
const PLATFORM_COLOR = 0x8899aa;
const CHARACTER_SIZE = 0.3;
const CHARACTER_COLOR = 0xff4477;

// --- Door (purely visual — no collider; win is "marble count reaches zero", see animate()) ---
const DOOR_HEIGHT = 0.8;
const DOOR_COLOR = 0xd9a441;

// --- Render depths ---
const DEPTH_TUBE_WALLS = 0.4;
const DEPTH_PLATFORM = 0.5;
const DEPTH_DOOR = -0.2; // behind the marbles, in front of TubeBackdrop's dark fill — hidden until the marbles clear
const DEPTH_SPHERE_BASE = -0.1; // pulled back from the grid boxes' front face so marbles don't visually poke through cell edges
const DEPTH_SPHERE_JITTER = 0.05;

// ============================================================
// SETUP
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e); // fallback shown until the ground plane's textures finish loading

const camera = new THREE.PerspectiveCamera(CAMERA_BASE_FOV_DEG, window.innerWidth / window.innerHeight, 0.1, CAMERA_FAR_PLANE);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

new Vignette({ strength: VIGNETTE_STRENGTH, innerRadiusPercent: VIGNETTE_INNER_RADIUS_PERCENT });

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

// The camera is fit to the grid — that's what needs to stay large enough to tap on mobile. The
// serpentine is sized to fit inside that same width (see SERPENTINE_* above); this max() is just
// a safety net so a future width tweak that overshoots gets caught by zooming out, rather than
// silently cropping the tube off-screen.
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

// ============================================================
// PHYSICS WORLD
// ============================================================

const physicsWorld = new PhysicsWorld({ gravity: PHYSICS_GRAVITY });

function syncBoxColliders(): void {
    physicsWorld.setGridColliders(buildGridColliders(gridModel, gridView));
}

new GridController(gridModel, gridView, { onBoardChanged: syncBoxColliders });
syncBoxColliders();

// ============================================================
// DERIVED LAYOUT
// ============================================================

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

// ============================================================
// SERPENTINE BOTTLENECK: path, width profile, walls
// ============================================================

const { waypoints: neckWaypoints, straightApproachStart } = buildSerpentineWaypoints({
    top: new THREE.Vector2(0, neckTopY),
    bottom: new THREE.Vector2(0, mouthBottomY),
    runs: SERPENTINE_RUNS,
    runHalfLength: SERPENTINE_RUN_HALF_LENGTH,
    bendRadius: SERPENTINE_BEND_RADIUS,
    bendSamples: SERPENTINE_BEND_SAMPLES,
    mergeFraction: SERPENTINE_MERGE_FRACTION,
});
const neckPath = new NeckPath({ waypoints: neckWaypoints });

// Widening must start no earlier than the straight final approach, or the offset walls
// self-intersect through the last hairpin. findClosestT locates that point precisely
// regardless of how arc length ends up distributed across the runs/bends/merge above.
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
});

new TubeBackdrop({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    segments: TUBE_SEGMENTS,
    opacity: TUBE_BACKDROP_OPACITY,
    renderDepth: DEPTH_TUBE_BACKDROP,
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

// No global left/right plane colliders — the tube's own walls already contain marbles all the
// way down to the mouth (which widens to cover the grid's width), and the serpentine's bends
// swing well past the grid's edges. A plane fixed at the grid's width would clip anything in a
// bend back to x=+-gridHalfWidth regardless of where the tube's actual wall is at that height —
// teleporting marbles out of the tube into empty space instead of containing them.
physicsWorld.setStaticWalls([tubeView.leftColliders, tubeView.rightColliders], TUBE_WALL_THICKNESS);

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
    pushAcceleration: PLATFORM_PUSH_ACCELERATION,
    platformColor: PLATFORM_COLOR,
    characterColor: CHARACTER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

// ============================================================
// DOOR — the win target, sitting right where the tube meets the grid
// ============================================================

new Door({
    scene,
    center: new THREE.Vector2(0, mouthBottomY),
    halfWidth: neckProfile(1),
    height: DOOR_HEIGHT,
    color: DOOR_COLOR,
    renderDepth: DEPTH_DOOR,
});

const winOverlay = new WinOverlay();
let hasWon = false;

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
    platformCharacter.pushTowardDoor(neckPath, deltaSeconds);
    platformCharacter.sync();
    physicsWorld.step(deltaSeconds);

    if (!hasWon && spawner.getActiveCount() === 0) {
        hasWon = true;
        winOverlay.show();
    }

    // TODO (lose, not implemented yet): a timer counting down to a loss if
    // the platform hasn't reached the door in time.

    renderer.render(scene, camera);
}
animate();