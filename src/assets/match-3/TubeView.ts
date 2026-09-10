import * as THREE from 'three';
import { LineCollider } from './physics/colliders/LineCollider';

export interface TubeOptions {
    scene: THREE.Scene;
    minX: number;
    maxX: number;
    topY: number;
    bottomY: number;
    wallThickness?: number;
    color?: number;
    renderDepth?: number;
}

/**
 * A visual chute (two side walls, open top and bottom) plus matching
 * LineColliders keeping spheres inside [minX, maxX] while they fall through
 * it into the grid below.
 */
export class TubeView {
    readonly colliders: LineCollider[];
    private leftWall: THREE.Mesh;
    private rightWall: THREE.Mesh;
    private scene: THREE.Scene;

    constructor(options: TubeOptions) {
        this.scene = options.scene;
        const thickness = options.wallThickness ?? 0.05;
        const height = options.topY - options.bottomY;
        const color = options.color ?? 0x333355;
        const depth = options.renderDepth ?? 0.4;

        const wallGeometry = new THREE.BoxGeometry(thickness, height, depth);
        const wallMaterial = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5 });

        this.leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        this.leftWall.position.set(options.minX, (options.topY + options.bottomY) / 2, depth / 2);
        this.scene.add(this.leftWall);

        this.rightWall = new THREE.Mesh(wallGeometry, wallMaterial.clone());
        this.rightWall.position.set(options.maxX, (options.topY + options.bottomY) / 2, depth / 2);
        this.scene.add(this.rightWall);

        this.colliders = [
            new LineCollider(new THREE.Vector2(options.minX, 0), new THREE.Vector2(1, 0)),
            new LineCollider(new THREE.Vector2(options.maxX, 0), new THREE.Vector2(-1, 0)),
        ];
    }

    dispose(): void {
        this.scene.remove(this.leftWall);
        this.scene.remove(this.rightWall);
        this.leftWall.geometry.dispose();
        (this.leftWall.material as THREE.Material).dispose();
        this.rightWall.geometry.dispose();
        (this.rightWall.material as THREE.Material).dispose();
    }
}