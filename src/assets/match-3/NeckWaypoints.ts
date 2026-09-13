import * as THREE from 'three';

export interface SCurveOptions {
    top: THREE.Vector2;
    bottom: THREE.Vector2;
    /** How far the curve swings horizontally as it descends. */
    swing: number;
    /** Number of left-right oscillations between top and bottom. */
    waves: number;
    samples?: number;
}

/** Waypoints for a gentle winding S-curve between two points — gives the bottleneck a curved, snake-like path instead of a straight line. */
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