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
        this.curve = new THREE.CatmullRomCurve3(points3D, false, 'catmullrom', 0.5);
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
}