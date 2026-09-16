import * as THREE from 'three';
import { NeckPath } from './NeckPath';

export interface ChaserPlatformOptions {
    scene: THREE.Scene;
    path: NeckPath;
    halfWidthAt: (t: number) => number;
    speedTPerSecond: number;
    startT?: number;
    thickness?: number;
    color?: number;
    renderDepth?: number;
}

export class ChaserPlatform {
    private scene: THREE.Scene;
    private path: NeckPath;
    private halfWidthAt: (t: number) => number;
    private speedTPerSecond: number;
    private mesh: THREE.Mesh;
    private renderDepth: number;
    t: number;

    constructor(options: ChaserPlatformOptions) {
        this.scene = options.scene;
        this.path = options.path;
        this.halfWidthAt = options.halfWidthAt;
        this.speedTPerSecond = options.speedTPerSecond;
        this.t = options.startT ?? 0;
        this.renderDepth = options.renderDepth ?? 0.45;

        const thickness = options.thickness ?? 0.18;
        const geometry = new THREE.PlaneGeometry(1, thickness * 2);
        const material = new THREE.MeshStandardMaterial({ color: options.color ?? 0xaa2222 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        this.sync();
    }

    update(deltaSeconds: number): void {
        this.t = Math.min(this.t + this.speedTPerSecond * deltaSeconds, 1);
        this.sync();
    }

    private sync(): void {
        const point = this.path.getPoint(this.t);
        const tangent = this.path.getTangent(this.t);
        const angle = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
        this.mesh.position.set(point.x, point.y, this.renderDepth);
        this.mesh.rotation.z = angle;
        this.mesh.scale.x = this.halfWidthAt(this.t) * 2;
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
