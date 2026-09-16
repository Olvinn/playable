import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';

export interface DoorPairOptions {
    scene: THREE.Scene;
    centerX?: number;
    doorY: number;
    openingWidth: number;
    thickness?: number;
    color?: number;
    renderDepth?: number;
}

export class DoorPair {
    private scene: THREE.Scene;
    private hingeLeft: THREE.Vector2;
    private hingeRight: THREE.Vector2;
    private leafLength: number;

    private leftGroup: THREE.Group;
    private rightGroup: THREE.Group;
    private leftMesh: THREE.Mesh;
    private rightMesh: THREE.Mesh;

    private openAmount = 0;

    constructor(options: DoorPairOptions) {
        this.scene = options.scene;
        const centerX = options.centerX ?? 0;
        this.leafLength = options.openingWidth / 2;
        const thickness = options.thickness ?? 0.05;
        const depth = options.renderDepth ?? 0.4;
        const color = options.color ?? 0xd9a441;

        this.hingeLeft = new THREE.Vector2(centerX - this.leafLength, options.doorY);
        this.hingeRight = new THREE.Vector2(centerX + this.leafLength, options.doorY);

        const geometry = new THREE.BoxGeometry(this.leafLength, thickness, depth);
        geometry.translate(this.leafLength / 2, 0, 0);

        const leftMaterial = new THREE.MeshStandardMaterial({ color });
        const rightMaterial = leftMaterial.clone();

        this.leftMesh = new THREE.Mesh(geometry, leftMaterial);
        this.rightMesh = new THREE.Mesh(geometry.clone(), rightMaterial);

        this.leftGroup = new THREE.Group();
        this.leftGroup.position.set(this.hingeLeft.x, this.hingeLeft.y, depth / 2);
        this.leftGroup.add(this.leftMesh);
        this.scene.add(this.leftGroup);

        this.rightGroup = new THREE.Group();
        this.rightGroup.position.set(this.hingeRight.x, this.hingeRight.y, depth / 2);
        this.rightGroup.add(this.rightMesh);
        this.scene.add(this.rightGroup);

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
        const angle = this.openAmount * (Math.PI / 2);

        const leftTip = this.hingeLeft.clone().add(
            new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(this.leafLength)
        );
        const rightTip = this.hingeRight.clone().add(
            new THREE.Vector2(-Math.cos(angle), Math.sin(angle)).multiplyScalar(this.leafLength)
        );

        return [
            new SegmentCollider(this.hingeLeft.clone(), leftTip),
            new SegmentCollider(this.hingeRight.clone(), rightTip),
        ];
    }

    private applyOpenAmount(): void {
        const angle = this.openAmount * (Math.PI / 2);
        this.leftGroup.rotation.z = angle;
        this.rightGroup.rotation.z = Math.PI - angle;
    }

    dispose(): void {
        this.scene.remove(this.leftGroup);
        this.scene.remove(this.rightGroup);
        this.leftMesh.geometry.dispose();
        (this.leftMesh.material as THREE.Material).dispose();
        this.rightMesh.geometry.dispose();
        (this.rightMesh.material as THREE.Material).dispose();
    }
}