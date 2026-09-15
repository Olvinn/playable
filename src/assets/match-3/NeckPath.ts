import * as THREE from 'three';

export interface NeckPathOptions {
    /** Ordered waypoints from the tube's narrow top entrance (t=0) to its wide bottom mouth (t=1). */
    waypoints: THREE.Vector2[];
}

/**
 * A smooth 2D curve (Catmull-Rom through the given waypoints), arc-length
 * parameterized so points spaced along it are evenly spaced in world
 * distance, not just in the raw spline parameter. Used both to lay out the
 * bottleneck's curved walls and to pack spheres along its length.
 */
export class NeckPath {
    private curve: THREE.CatmullRomCurve3;
    readonly length: number;

    constructor(options: NeckPathOptions) {
        const points3D = options.waypoints.map(p => new THREE.Vector3(p.x, p.y, 0));
        // 'centripetal' (not the default-sounding 'catmullrom', which is actually uniform parameterization) —
        // uniform parameterization produces loops/cusps when waypoint spacing varies a lot, which it does here
        // (hairpin bends pack many close waypoints; straight runs use few, widely spaced ones).
        this.curve = new THREE.CatmullRomCurve3(points3D, false, 'centripetal');
        this.length = this.curve.getLength();
    }

    getPoint(t: number): THREE.Vector2 {
        const p = this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
        return new THREE.Vector2(p.x, p.y);
    }

    getTangent(t: number): THREE.Vector2 {
        const tangent = this.curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1));
        return new THREE.Vector2(tangent.x, tangent.y).normalize();
    }

    /** Arc-length fraction (0-1) of the point on this path closest to `target` — e.g. for finding where a known world-space landmark falls along the curve. */
    findClosestT(target: THREE.Vector2, samples = 500): number {
        let bestT = 0;
        let bestDistSq = Infinity;
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const distSq = this.getPoint(t).distanceToSquared(target);
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestT = t;
            }
        }
        return bestT;
    }
}