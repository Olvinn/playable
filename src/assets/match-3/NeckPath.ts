import * as THREE from 'three';

export interface NeckPathOptions {
    waypoints: THREE.Vector2[];
}

export class NeckPath {
    private curve: THREE.CatmullRomCurve3;
    readonly length: number;

    constructor(options: NeckPathOptions) {
        const points3D = options.waypoints.map(p => new THREE.Vector3(p.x, p.y, 0));
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