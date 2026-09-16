import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';
import { NeckPath } from './NeckPath';

export interface NeckGateOptions {
    scene: THREE.Scene;
    path: NeckPath;
    t: number;
    halfWidth: number;
    thickness?: number;
    color?: number;
    renderDepth?: number;
}

export class NeckGate {
    private scene: THREE.Scene;
    private hingeA: THREE.Vector2;
    private hingeB: THREE.Vector2;
    private leafLength: number;
    private angleClosedA: number;
    private angleClosedB: number;
    private angleOpen: number;

    private leafGroupA: THREE.Group;
    private leafGroupB: THREE.Group;
    private leafMeshA: THREE.Mesh;
    private leafMeshB: THREE.Mesh;

    private openAmount = 0;

    constructor(options: NeckGateOptions) {
        this.scene = options.scene;
        const center = options.path.getPoint(options.t);
        const tangent = options.path.getTangent(options.t);
        const normal = new THREE.Vector2(-tangent.y, tangent.x);

        this.leafLength = options.halfWidth;
        this.hingeA = center.clone().addScaledVector(normal, options.halfWidth);
        this.hingeB = center.clone().addScaledVector(normal, -options.halfWidth);

        const dirClosedA = normal.clone().negate();
        const dirClosedB = normal.clone();
        this.angleClosedA = Math.atan2(dirClosedA.y, dirClosedA.x);
        this.angleClosedB = Math.atan2(dirClosedB.y, dirClosedB.x);

        const openDir = tangent.clone().negate();
        this.angleOpen = Math.atan2(openDir.y, openDir.x);

        const thickness = options.thickness ?? 0.06;
        const depth = options.renderDepth ?? 0.42;
        const color = options.color ?? 0xd9a441;

        const geometry = new THREE.BoxGeometry(this.leafLength, thickness, depth);
        geometry.translate(this.leafLength / 2, 0, 0);

        const materialA = new THREE.MeshStandardMaterial({ color });
        const materialB = materialA.clone();

        this.leafMeshA = new THREE.Mesh(geometry, materialA);
        this.leafMeshB = new THREE.Mesh(geometry.clone(), materialB);

        this.leafGroupA = new THREE.Group();
        this.leafGroupA.position.set(this.hingeA.x, this.hingeA.y, depth / 2);
        this.leafGroupA.add(this.leafMeshA);
        this.scene.add(this.leafGroupA);

        this.leafGroupB = new THREE.Group();
        this.leafGroupB.position.set(this.hingeB.x, this.hingeB.y, depth / 2);
        this.leafGroupB.add(this.leafMeshB);
        this.scene.add(this.leafGroupB);

        this.applyOpenAmount();
    }

    setOpenAmount(amount: number): void {
        this.openAmount = THREE.MathUtils.clamp(amount, 0, 1);
        this.applyOpenAmount();
    }

    getOpenAmount(): number {
        return this.openAmount;
    }

    isFullyOpen(): boolean {
        return this.openAmount >= 0.999;
    }

    getColliders(): SegmentCollider[] {
        const angleA = this.lerpAngle(this.angleClosedA, this.angleOpen, this.openAmount);
        const angleB = this.lerpAngle(this.angleClosedB, this.angleOpen, this.openAmount);

        const tipA = this.hingeA.clone().addScaledVector(new THREE.Vector2(Math.cos(angleA), Math.sin(angleA)), this.leafLength);
        const tipB = this.hingeB.clone().addScaledVector(new THREE.Vector2(Math.cos(angleB), Math.sin(angleB)), this.leafLength);

        return [
            new SegmentCollider(this.hingeA.clone(), tipA),
            new SegmentCollider(this.hingeB.clone(), tipB),
        ];
    }

    private applyOpenAmount(): void {
        this.leafGroupA.rotation.z = this.lerpAngle(this.angleClosedA, this.angleOpen, this.openAmount);
        this.leafGroupB.rotation.z = this.lerpAngle(this.angleClosedB, this.angleOpen, this.openAmount);
    }

    private lerpAngle(a: number, b: number, t: number): number {
        let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return a + diff * t;
    }

    dispose(): void {
        this.scene.remove(this.leafGroupA);
        this.scene.remove(this.leafGroupB);
        this.leafMeshA.geometry.dispose();
        (this.leafMeshA.material as THREE.Material).dispose();
        this.leafMeshB.geometry.dispose();
        (this.leafMeshB.material as THREE.Material).dispose();
    }
}