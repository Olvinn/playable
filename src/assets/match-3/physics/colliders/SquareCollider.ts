import * as THREE from 'three';

export class SquareCollider {
    center: THREE.Vector2;
    halfExtents: THREE.Vector2;
    cellId: string;

    constructor(center: THREE.Vector2, halfExtents: THREE.Vector2, cellId: string) {
        this.center = center;
        this.halfExtents = halfExtents;
        this.cellId = cellId;
    }

    closestPointTo(point: THREE.Vector2, out: THREE.Vector2): THREE.Vector2 {
        out.x = THREE.MathUtils.clamp(point.x, this.center.x - this.halfExtents.x, this.center.x + this.halfExtents.x);
        out.y = THREE.MathUtils.clamp(point.y, this.center.y - this.halfExtents.y, this.center.y + this.halfExtents.y);
        return out;
    }
}