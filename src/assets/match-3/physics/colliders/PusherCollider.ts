import * as THREE from 'three';

export interface PusherColliderOptions {
    center: THREE.Vector2;
    halfExtents: THREE.Vector2;
}

export class PusherCollider {
    center: THREE.Vector2;
    halfExtents: THREE.Vector2;
    velocity: THREE.Vector2 = new THREE.Vector2();

    constructor(options: PusherColliderOptions) {
        this.center = options.center;
        this.halfExtents = options.halfExtents;
    }

    closestPointTo(point: THREE.Vector2, out: THREE.Vector2): THREE.Vector2 {
        out.x = THREE.MathUtils.clamp(point.x, this.center.x - this.halfExtents.x, this.center.x + this.halfExtents.x);
        out.y = THREE.MathUtils.clamp(point.y, this.center.y - this.halfExtents.y, this.center.y + this.halfExtents.y);
        return out;
    }
}