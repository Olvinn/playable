import * as THREE from 'three';
import { GridModel } from './assets/match-3/GridModel';
import { ThreeGridView } from './assets/match-3/ThreeGridView';
import { GridController } from './assets/match-3/GridController';
import { GridGenerator } from "./assets/match-3/GridGenerator.ts";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(0, 5, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')!.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 5, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const gridGenerator = new GridGenerator({ rows: 8, cols: 16, colorCount: 5 });
const gridModel = new GridModel(gridGenerator);
const gridView = new ThreeGridView({
    rows: 8,
    cols: 16,
    renderer,
    marginLeft: 0.04,
    marginRight: 0.04,
    marginBottom: 0.05,
    minCellSize: 0.15,
    maxCellSize: 0.6,
});
const gridController = new GridController(gridModel, gridView);

window.addEventListener('resize', () => gridView.handleResize());

function animate() {
    requestAnimationFrame(animate);
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
    gridView.render();
}
animate();
