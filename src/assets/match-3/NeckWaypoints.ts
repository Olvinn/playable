import * as THREE from 'three';

export interface SCurveOptions {
    top: THREE.Vector2;
    bottom: THREE.Vector2;
    swing: number;
    waves: number;
    samples?: number;
}

export function buildSCurveWaypoints(options: SCurveOptions): THREE.Vector2[] {
    const samples = options.samples ?? 8;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const y = THREE.MathUtils.lerp(options.top.y, options.bottom.y, t);
        const x = THREE.MathUtils.lerp(options.top.x, options.bottom.x, t) + Math.sin(t * Math.PI * options.waves) * options.swing;
        points.push(new THREE.Vector2(x, y));
    }
    return points;
}