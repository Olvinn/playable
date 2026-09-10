import * as THREE from 'three';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from './assets/match-3/GridGenerator';
import { buildGridColliders } from './assets/match-3/GridColliderSync';
import { PhysicsWorld } from './assets/match-3/physics/PhysicsWorld';
import { CollisionResolver } from './assets/match-3/physics/CollisionResolver';
import { LineCollider } from './assets/match-3/physics/colliders/LineCollider';
import { SphereSpawner } from './assets/match-3/SphereSpawner';
import { TubeView } from './assets/match-3/TubeView';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 5, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Match-3 grid ---
const ROWS = 8;
const COLS = 12;

const gridGenerator = new GridGenerator({ rows: ROWS, cols: COLS, colorCount: 4 });
const gridModel = new GridModel(gridGenerator);
const gridView = new ThreeGridView({
    rows: ROWS,
    cols: COLS,
    renderer,
    marginLeft: 0.1,
    marginRight: 0.1,
    marginBottom: 0.05,
    minCellSize: 0.15,
    maxCellSize: 0.6,
    cameraFov: 25,
});

// --- Physics world, cell-pitch-sized so box colliders map 1:1 onto grid cells ---
const cellPitch = gridView.getCellSize() + gridView.getGap();
const collisionResolver = new CollisionResolver({ cellSize: cellPitch });
const physicsWorld = new PhysicsWorld(collisionResolver, { gravity: 9.8, maxSpeed: 25 });

function syncBoxColliders(): void {
    collisionResolver.setBoxColliders(buildGridColliders(gridModel, gridView));
}

const gridController = new GridController(gridModel, gridView, { onBoardChanged: syncBoxColliders });
syncBoxColliders(); // seed with the initial board before any swap happens

// --- World bounds spanning the grid's full width, plus the tube's own walls above it ---
const leftEdge = gridView.getCellCenter2D(0, 0).x - cellPitch / 2;
const rightEdge = gridView.getCellCenter2D(0, COLS - 1).x + cellPitch / 2;
const topRowY = gridView.getCellCenter2D(0, 0).y;

const tubeTopY = topRowY + cellPitch * 4;
const tubeBottomY = topRowY + cellPitch * 0.5;

const tubeView = new TubeView({
    scene,
    minX: leftEdge + cellPitch,
    maxX: rightEdge - cellPitch,
    topY: tubeTopY,
    bottomY: tubeBottomY,
});

collisionResolver.setPlanes([
    new LineCollider(new THREE.Vector2(leftEdge, 0), new THREE.Vector2(1, 0)),
    new LineCollider(new THREE.Vector2(rightEdge, 0), new THREE.Vector2(-1, 0)),
    ...tubeView.colliders,
]);

// --- Sphere spawner ---
const spawner = new SphereSpawner({
    scene,
    world: physicsWorld,
    spawnMinX: leftEdge + cellPitch * 1.5,
    spawnMaxX: rightEdge - cellPitch * 1.5,
    spawnY: tubeTopY - cellPitch * 0.5,
    despawnY: -cellPitch * 3,
    radius: cellPitch * 0.35,
    colors: [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55],
    spawnIntervalSeconds: 0.5,
});

window.addEventListener('resize', () => gridView.handleResize());

let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastTime) / 1000, 1 / 30); // clamp so a backgrounded tab doesn't cause a huge catch-up step
    lastTime = now;

    spawner.update(deltaSeconds);
    physicsWorld.step(deltaSeconds);

    renderer.render(scene, camera);
    gridView.render();
}
animate();