import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from './assets/match-3/GridGenerator';
import { buildGridColliders } from './assets/match-3/GridColliderSync';
import { AdaptiveCamera } from './assets/match-3/AdaptiveCamera';
import { PhysicsWorld } from './assets/match-3/physics/PhysicsWorld';
import { SquareCollider } from './assets/match-3/physics/colliders/SquareCollider';
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
const VIGNETTE_STRENGTH = 0.88;
const VIGNETTE_INNER_RADIUS_PERCENT = 30;
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
// Loosened to 1.3 after moving to Matter.js (from an original 1.1) specifically to reduce
// jamming — Matter's accurate narrow-phase resolves contacts exactly, so a tightly-packed pile
// settles into a genuinely rigid, load-bearing arch that a modest push can't reliably clear. Pulled
// partway back down after direct feedback that the tube looked too sparse — 1.15 is a compromise
// between "enough marbles to look full" and "enough gaps for the pile to locally rearrange instead
// of locking rigid"; re-verify jam reliability after changing this.
const SPHERE_PACKING_FACTOR = 1.22;
const SPHERE_JITTER = 0.15;
const SPHERE_COLORS = [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55, 0xcc66ff];
const MARBLE_FILL_START_T = 0.05; // leaves a (smaller, after the same feedback) gap at the very top of the tube for the platform to rest into

// --- Match-3 <-> tube link — matching is what actually clears a path, not the platform's own push
// force alone. Without this, the platform reaching the door depends entirely on
// PLATFORM_PUSH_ACCELERATION vs. the pile's resistance, which makes winning completely independent
// of anything the player does on the board — not a difficulty tradeoff, a broken win condition. ---
const MARBLES_CLEARED_PER_MATCH = 20; // removed from the tube on every successful swap, regardless of how many tiles cascaded
const MATCH_CLEAR_AHEAD_RANGE = 0.12; // arc-length fraction ahead of the platform's current position that a match reaches into

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
// Tried at 0.2 and 0.08 (a perfectly horizontal run gives gravity zero pull along the direction of
// travel, which was the original motivation) but reverted to 0: *any* slope, even small, distorts
// the Catmull-Rom curve fit at the very start of the path into a real curvature spike (confirmed
// directly — the tangent's angle swings noticeably across a short span there), which pinches the
// tube tight enough to wall-jam anything wider than about 0.5 half-width. Since neither friction
// nor slope turned out to be what was actually blocking progress (verified: zero friction changed
// nothing; PLATFORM_PUSH_ACCELERATION is what needed tuning), this wasn't worth the width it cost.
const SERPENTINE_RUN_SLOPE_FRACTION = 0;

// --- Rescue platform + character (a box for now) ---
const PLATFORM_START_T = 0.02; // starts right at the top of the tube, on top of the fully-packed pile
// The platform's physics body rotates to track the tube's local direction (see
// PlatformCharacter's bounded setAngularVelocity() correction), which is what makes a wider
// platform possible at all: a fixed-orientation box can't go around *any* curve, however gentle,
// without a corner catching the wall the instant the corridor's direction rotates away from its
// fixed edges. Widened from 0.5 (was letting marbles slip past the sides) back up toward the
// tube's own half-width (0.6) — 0.58 was the widest that held up reliably across repeated fresh
// runs; the exact 0.6 (zero clearance) still hit a hard stall in testing. Also turned out to be
// sensitive to SERPENTINE_RUN_SLOPE_FRACTION — see that constant's own comment.
const PLATFORM_HALF_WIDTH = 0.58;
const PLATFORM_HALF_THICKNESS = 0.05;
// A realistic weight for a small plank + person, not the 100x-a-marble value this used to be —
// that was tuned specifically to muscle through a stubborn bottleneck near the mouth, at the cost
// of every contact (not just that one) getting shoved harder than it should, which is what read as
// the platform pushing too aggressively overall. See PLATFORM_PUSH_ACCELERATION below for how the
// forward push itself is now derived from weight rather than tuned as a flat number.
const PLATFORM_MASS = 10;
const PLATFORM_RESTITUTION = 0.05;
// A genuine force now (see PhysicsBox.applyAcceleration and PlatformCharacter.pushTowardDoor), not
// a kinematic speed the platform simply teleported to every frame regardless of resistance — that
// mechanism, not the raw magnitude, is what made the old version feel like it was pushing too
// hard: "reach this speed no matter what's in the way" doesn't look like a person pushing
// something, regardless of how strong that person is. Expressed as a multiple of gravity rather
// than an arbitrary world-units/s² figure because applyAcceleration() turns that into `mass *
// acceleration` automatically, independent of whatever PLATFORM_MASS happens to be.
//
// 1.0 (literally "their own combined weight, no more") was tried first and stalled solid at the
// very top of the tube on nearly every run — verified directly with friction zeroed out on every
// body, which made no difference at all, proving that particular jam is a pure compressive-load
// (normal-force) blockage, not a friction/arch effect more force can't fix. 4.0g reliably broke
// through it. Brought back down to 3.5g ("less powerful," per direct feedback that 4.0g still felt
// too strong) after widening the platform to 0.58 — the extra width needs a bit more force to clear
// the same early jam, so this is the lowest value that still held up across repeated fresh runs at
// the current width. Still a real force integrated against real resistance, not an unconditional
// fixed speed — that mechanism, not the raw multiplier, is what "pushing too hard" was actually
// describing.
const PLATFORM_PUSH_ACCELERATION = 3.5 * PHYSICS_GRAVITY;
const PLATFORM_COLOR = 0x8899aa;
const CHARACTER_SIZE = 0.3;
const CHARACTER_COLOR = 0xff4477;

// --- Door (still no collider — nothing physically stops marbles or the platform going past it —
// but reaching it is now the actual win condition, via PlatformCharacter's arrivalT/onArrive, not
// "every marble drained." That also sidesteps the tube's single worst spot: the natural congestion
// where the tight neck opens into the wide mouth, which earlier testing found could stall the
// platform for a very long time even under otherwise-reliable settings. ---
// Past the point where PLATFORM_PUSH_ACCELERATION alone can reliably get, on purpose. Pure physics
// (no matches at all) plateaus around t=0.58-0.6 against a genuine granular arch that more force
// doesn't fix without also breaking the "gentle push" feel (verified: even 20g just blows through
// in a few seconds instead of stalling, which is exactly as disconnected from play as never
// reaching it at all). The gap between there and here is meant to be closed by
// SphereSpawner.removeAheadOfPath, called from onBoardChanged on every successful match — reaching
// this now requires actually clearing marbles via the board, not just letting the platform sit.
//
// Also chosen to land just past neckFraction (~0.948, where SerpentineWaypoints' own comments
// guarantee the path is straight and centered on bottom.x=0) rather than inside the last hairpin
// bend (0.85 used to sit there, at x≈+1.18 — visibly off-center). An earlier attempt to recenter
// that by shifting the whole serpentine sideways (SERPENTINE_TOP_X_OFFSET) instead distorted the
// merge curve into a visible pinch, since the merge's own shape depends on the gap between the
// last run's end and bottom.x. Moving the door instead of the tube gets an exactly-centered point
// (verified: x≈-0.001) for free, with zero change to the tube's actual shape.
const DOOR_T = 0.95;
const DOOR_HEIGHT = 0.8;
const DOOR_COLOR = 0xd9a441;

// --- Chaser (lose condition: an unstoppable wall crawling down the tube behind the player,
// replacing a plain countdown — see ChaserPlatform.ts) ---
// NeckPath is arc-length parameterized, so a constant t-per-second rate is a genuinely constant
// world-space crawl speed. Tuned to cross the same t=0.95 (DOOR_T) span in about the same ~30s
// the old timer gave, as a starting difficulty baseline — re-tune by feel, not by re-deriving this.
const CHASER_SPEED_T_PER_SECOND = DOOR_T / 30;
const CHASER_COLOR = 0xaa2222;

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

// Gives the glass marbles' transmission/clearcoat something to reflect — without this, glass
// materials with no scene.environment render flat and dark since there's nothing to catch.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

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
const spawnerDespawnY = -gridCellPitch * 3;

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

syncBoxColliders();
// GridController itself is created further down, once spawner/platformCharacter/neckPath exist —
// see the comment there for why matching needs to reach into the tube, not just the grid.

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
    runSlopeFraction: SERPENTINE_RUN_SLOPE_FRACTION,
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

// Grid boundary walls: scoped to start exactly where the tube's own walls stop (the mouth, at
// mouthBottomY), so they don't fight the comment above — nothing here reaches up into the tube's
// bends. Below the mouth there was previously no side containment at all, so marbles that spilled
// past the outer columns once the pile settled onto the grid just rolled off the edge into open
// space instead of staying on the board.
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

// ============================================================
// SPAWN MARBLES — packed along the whole tube
// ============================================================

const spawner = new SphereSpawner({
    scene,
    world: physicsWorld,
    totalSpheres: SPHERE_TOTAL_COUNT,
    despawnY: spawnerDespawnY,
    radius: SPHERE_RADIUS,
    colors: SPHERE_COLORS,
    packingFactor: SPHERE_PACKING_FACTOR,
    jitter: SPHERE_JITTER,
    mass: SPHERE_MASS,
    restitution: SPHERE_RESTITUTION,
    renderDepth: DEPTH_SPHERE_BASE,
    renderDepthJitter: DEPTH_SPHERE_JITTER,
});

// The tube's own bottom (t=1, mouthBottomY) sits only TUBE_GAP_ABOVE_GRID above the grid's
// *center*, which is less than the grid cell's own half-size — so packing marbles all the way to
// t=1 (as a naive endT:1 would) spawns the bottom-most ones already overlapping the top row's
// collider, before physics ever gets a step to separate them. Stop the fill far enough above the
// grid's real top surface (matching GridColliderSync's collider sizing) that a full marble radius
// plus a small margin clears it, and let gravity settle that last short gap naturally instead.
const gridTopSurfaceY = gridTopRowY + (GRID_CELL_SIZE + GRID_CELL_GAP) / 2 + 0.01;
const marbleFillEndY = gridTopSurfaceY + SPHERE_RADIUS + 0.05;
const marbleFillEndT = neckPath.findClosestT(new THREE.Vector2(0, marbleFillEndY));

spawner.spawnAll([
    {
        kind: 'path',
        path: neckPath,
        halfWidthAt: neckProfile,
        startT: MARBLE_FILL_START_T,
        endT: marbleFillEndT,
    },
]);

// ============================================================
// RESCUE PLATFORM + CHARACTER — starts resting on top of the full pile
// ============================================================

// Set once, by whichever of win/lose fires first — guards against the chaser catching up the same
// frame the door's reached, or either firing twice.
let gameEnded = false;

const gameOverlay = new GameOverlay({
    onRestart: () => window.location.reload(),
});

// Reaching arrivalT only stops the platform (see PlatformCharacter) — it doesn't win on its own
// anymore. The door itself still has marbles resting in front of it whenever the platform's own
// width doesn't fully seal the tube there, or a few slide past its sides after it's already
// frozen; a win the instant the platform arrives could fire with the door still visibly blocked.
// platformArrived just records that the platform has done its part; isDoorClear() (checked every
// frame below) is what actually gates the win on the door being visibly, physically open.
let platformArrived = false;

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
    arrivalT: DOOR_T,
    onArrive: () => {
        platformArrived = true;
    },
    platformColor: PLATFORM_COLOR,
    characterColor: CHARACTER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

// Starts at t=0, right behind the platform's own PLATFORM_START_T — see ChaserPlatform for why it
// has no physics body of its own.
const chaser = new ChaserPlatform({
    scene,
    path: neckPath,
    halfWidthAt: neckProfile,
    speedTPerSecond: CHASER_SPEED_T_PER_SECOND,
    color: CHASER_COLOR,
    renderDepth: DEPTH_PLATFORM,
});

// ============================================================
// DOOR — the win target, partway up the tube (see DOOR_T)
// ============================================================

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

// True once no marble's body overlaps the door's own footprint (a sphere counts as still
// blocking it if its edge, not just its center, crosses into the rectangle) — checked every frame
// once the platform's arrived, since marbles can keep sliding past a platform that doesn't fully
// seal the tube's width right up until the door is actually visibly clear.
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

// ============================================================
// MATCH-3 <-> TUBE LINK
// ============================================================

// The one place a successful match actually does something to the pile: it clears real marbles
// from the tube immediately ahead of the platform, not just recomputes grid colliders. This is
// what makes reaching the door depend on playing the board — before this, PLATFORM_PUSH_ACCELERATION
// vs. the pile's own resistance was the *only* thing deciding the outcome, so a player who never
// touched the grid would win exactly as often as one who played it perfectly.
function onBoardChanged(): void {
    syncBoxColliders();

    const platformT = neckPath.findClosestT(platformCharacter.box.collider.center);
    spawner.removeAheadOfPath(neckPath, platformT, Math.min(platformT + MATCH_CLEAR_AHEAD_RANGE, 1), MARBLES_CLEARED_PER_MATCH);
}

new GridController(gridModel, gridView, { onBoardChanged, onCellsCleared: syncBoxColliders });

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

    if (!gameEnded) {
        spawner.update();
        platformCharacter.pushTowardDoor(neckPath, deltaSeconds);
        platformCharacter.sync();
        physicsWorld.step(deltaSeconds);
        platformCharacter.clampSpeed();
        chaser.update(deltaSeconds);

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