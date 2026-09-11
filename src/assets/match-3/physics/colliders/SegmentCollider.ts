import * as THREE from 'three';

/** A bounded line segment, unlike LineCollider which is an infinite line. */
export class SegmentCollider {
    a: THREE.Vector2;
    b: THREE.Vector2;

    constructor(a: THREE.Vector2, b: THREE.Vector2) {
        this.a = a;
        this.b = b;
    }

    closestPointTo(point: THREE.Vector2, out: THREE.Vector2): THREE.Vector2 {
        const ab = this.b.clone().sub(this.a);
        const lengthSq = ab.lengthSq();
        if (lengthSq < 1e-9) {
            out.copy(this.a);
            return out;
        }
        const t = THREE.MathUtils.clamp(point.clone().sub(this.a).dot(ab) / lengthSq, 0, 1);
        out.copy(this.a).addScaledVector(ab, t);
        return out;
    }
}