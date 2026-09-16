import * as THREE from 'three';
import { NeckPath } from './NeckPath';
import { PusherCollider } from './physics/colliders/PusherCollider';

export interface MarblePusherOptions {
    scene: THREE.Scene;
    path: NeckPath;
    startT: number;
    maxT: number;
    advanceSpeed: number;
    halfWidth: number;
    thickness: number;
    color?: number;
    renderDepth?: number;
}

export class MarblePusher {
    private path: NeckPath;
    private t: number;
    private maxT: number;
    private advanceSpeed: number;

    private collider: PusherCollider;
    private mesh: THREE.Mesh;
    private scene: THREE.Scene;
    private previousCenter: THREE.Vector2;

    constructor(options: MarblePusherOptions) {
        this.scene = options.scene;
        this.path = options.path;
        this.t = options.startT;
        this.maxT = options.maxT;
        this.advanceSpeed = options.advanceSpeed;

        const depth = options.renderDepth ?? 0.42;
        const geometry = new THREE.BoxGeometry(options.halfWidth * 2, options.thickness, depth);
        const material = new THREE.MeshStandardMaterial({ color: options.color ?? 0xdd8844 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        const startCenter = this.path.getPoint(this.t);
        this.collider = new PusherCollider({
            center: startCenter.clone(),
            halfExtents: new THREE.Vector2(options.halfWidth, options.thickness / 2),
        });
        this.previousCenter = startCenter.clone();
        this.syncMesh(startCenter, this.path.getTangent(this.t));
    }

    update(deltaSeconds: number): void {
        this.t = Math.min(this.t + this.advanceSpeed * deltaSeconds, this.maxT);
        const center = this.path.getPoint(this.t);
        const tangent = this.path.getTangent(this.t);

        this.collider.velocity.copy(center).sub(this.previousCenter).divideScalar(Math.max(deltaSeconds, 1e-6));
        this.collider.center.copy(center);
        this.previousCenter.copy(center);

        this.syncMesh(center, tangent);
    }

    getCollider(): PusherCollider {
        return this.collider;
    }

    hasReachedLimit(): boolean {
        return this.t >= this.maxT - 1e-6;
    }

    private syncMesh(center: THREE.Vector2, tangent: THREE.Vector2): void {
        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        this.mesh.position.set(center.x, center.y, 0);
        this.mesh.rotation.z = Math.atan2(normal.y, normal.x);
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}