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
    spikeCount?: number;
    spikeRadius?: number;
    spikeHeight?: number;
    spikeColor?: number;
}

export class ChaserPlatform {
    private scene: THREE.Scene;
    private path: NeckPath;
    private halfWidthAt: (t: number) => number;
    private speedTPerSecond: number;
    private group: THREE.Group;
    private barMesh: THREE.Mesh;
    private spikeMeshes: THREE.Mesh[];
    private renderDepth: number;
    private spikeOffsetY: number;
    t: number;

    constructor(options: ChaserPlatformOptions) {
        this.scene = options.scene;
        this.path = options.path;
        this.halfWidthAt = options.halfWidthAt;
        this.speedTPerSecond = options.speedTPerSecond;
        this.t = options.startT ?? 0;
        this.renderDepth = options.renderDepth ?? 0.45;

        const thickness = options.thickness ?? 0.18;
        const spikeCount = options.spikeCount ?? 7;
        const spikeRadius = options.spikeRadius ?? 0.09;
        const spikeHeight = options.spikeHeight ?? 0.22;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        const barGeometry = new THREE.PlaneGeometry(1, thickness * 2);
        const barMaterial = new THREE.MeshStandardMaterial({ color: options.color ?? 0xaa2222 });
        this.barMesh = new THREE.Mesh(barGeometry, barMaterial);
        this.group.add(this.barMesh);

        this.spikeOffsetY = -(thickness + spikeHeight / 2);

        const spikeGeometry = new THREE.ConeGeometry(spikeRadius, spikeHeight, 8);
        const spikeMaterial = new THREE.MeshStandardMaterial({
            color: options.spikeColor ?? 0x888888,
            roughness: 0.3,
            metalness: 0.6,
        });
        this.spikeMeshes = [];
        for (let i = 0; i < spikeCount; i++) {
            const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
            spike.rotation.z = Math.PI;
            spike.position.y = this.spikeOffsetY;
            this.group.add(spike);
            this.spikeMeshes.push(spike);
        }

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
        this.group.position.set(point.x, point.y, this.renderDepth);
        this.group.rotation.z = angle;

        const halfWidth = this.halfWidthAt(this.t);
        this.barMesh.scale.x = halfWidth * 2;

        for (let i = 0; i < this.spikeMeshes.length; i++) {
            const frac = (i + 0.5) / this.spikeMeshes.length * 2 - 1;
            this.spikeMeshes[i].position.x = frac * halfWidth;
        }
    }

    dispose(): void {
        this.scene.remove(this.group);
        this.barMesh.geometry.dispose();
        (this.barMesh.material as THREE.Material).dispose();
        if (this.spikeMeshes.length > 0) {
            this.spikeMeshes[0].geometry.dispose();
            (this.spikeMeshes[0].material as THREE.Material).dispose();
        }
    }
}
