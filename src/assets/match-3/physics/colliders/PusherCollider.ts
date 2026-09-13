import * as THREE from 'three';

export interface PusherColliderOptions {
    center: THREE.Vector2;
    halfExtents: THREE.Vector2;
}

/**
 * A box collider whose center moves every frame (unlike SquareCollider,
 * which represents static grid cells). When a sphere overlaps it, the
 * resolver imparts this collider's velocity onto the sphere in addition to
 * the usual position correction — that's what makes it "push" rather than
 * just "block".
 */
export class PusherCollider {
    center: THREE.Vector2;
    halfExtents: THREE.Vector2;
    /** Set every frame by whoever drives this pusher, based on how far its center moved this step. */
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