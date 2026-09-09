import * as THREE from 'three';

export class LineCollider {
    point: THREE.Vector2;
    normal: THREE.Vector2;

    constructor(point: THREE.Vector2, normal: THREE.Vector2) {
        this.point = point;
        this.normal = normal.clone().normalize();
    }

    signedDistanceTo(point: THREE.Vector2): number {
        return point.clone().sub(this.point).dot(this.normal);
    }
}