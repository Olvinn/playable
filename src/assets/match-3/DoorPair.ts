import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';

export interface DoorPairOptions {
    scene: THREE.Scene;
    centerX?: number;
    /** Height (world Y) the doors sit at — typically the neck's top opening. */
    doorY: number;
    /** Full width of the opening the two doors close across. Each leaf spans half this width. */
    openingWidth: number;
    thickness?: number;
    color?: number;
    renderDepth?: number;
}

/**
 * Two door leaves hinged at the outer edges of an opening, swinging from
 * horizontal (closed, meeting at the opening's center) to vertical (open,
 * flush against the opening's walls) as openAmount goes 0 -> 1.
 *
 * Physically represented as two SegmentColliders that rotate along with the
 * visual leaves — spheres actually bounce off closed doors, and the path
 * is genuinely clear once open, not just visually hidden.
 */
export class DoorPair {
    private scene: THREE.Scene;
    private hingeLeft: THREE.Vector2;
    private hingeRight: THREE.Vector2;
    private leafLength: number;

    private leftGroup: THREE.Group;
    private rightGroup: THREE.Group;
    private leftMesh: THREE.Mesh;
    private rightMesh: THREE.Mesh;

    private openAmount = 0; // 0 = closed, 1 = fully open

    constructor(options: DoorPairOptions) {
        this.scene = options.scene;
        const centerX = options.centerX ?? 0;
        this.leafLength = options.openingWidth / 2;
        const thickness = options.thickness ?? 0.05;
        const depth = options.renderDepth ?? 0.4;
        const color = options.color ?? 0xd9a441;

        this.hingeLeft = new THREE.Vector2(centerX - this.leafLength, options.doorY);
        this.hingeRight = new THREE.Vector2(centerX + this.leafLength, options.doorY);

        // Local origin sits at the hinge edge; the leaf extends along local +x.
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

    /** 0 = fully closed (leaves meet at the opening's center), 1 = fully open (leaves flush against the walls). */
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

    /** Current collider segments, reflecting the doors' present angle. Pass into CollisionResolver.setSegments() alongside any other wall segments, since setSegments replaces the whole list. */
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
        this.leftGroup.rotation.z = angle;        // sweeps local +x from pointing at center (closed) to pointing up (open)
        this.rightGroup.rotation.z = Math.PI - angle; // mirrored: pointing at center (closed) to pointing up (open)
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