import * as THREE from 'three';

const RUN_POINT_FRACTIONS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1];

export interface SerpentineOptions {
    top: THREE.Vector2;
    bottom: THREE.Vector2;
    runs: number;
    runHalfLength: number;
    bendRadius: number;
    bendSamples?: number;
    mergeFraction?: number;
    runSlopeFraction?: number;
}

export interface SerpentineResult {
    waypoints: THREE.Vector2[];
    straightApproachStart: THREE.Vector2;
}

export function buildSerpentineWaypoints(options: SerpentineOptions): SerpentineResult {
    const { top, bottom, runs, runHalfLength, bendRadius } = options;
    const bendSamples = options.bendSamples ?? 10;
    const mergeFraction = options.mergeFraction ?? 0.5;
    const runSlopeFraction = options.runSlopeFraction ?? 0;
    const points: THREE.Vector2[] = [];

    const totalDrop = top.y - bottom.y;
    const levelStep = totalDrop / (runs + 1);
    const runSlope = levelStep * runSlopeFraction;

    const pushBend = (endX: number, direction: number, bendStartY: number, bendEndY: number): void => {
        const midY = (bendStartY + bendEndY) / 2;
        const halfDrop = (bendStartY - bendEndY) / 2;
        for (let s = 1; s < bendSamples; s++) {
            const theta = Math.PI / 2 - (s / bendSamples) * Math.PI;
            const x = endX + direction * bendRadius * Math.cos(theta);
            const y = midY + halfDrop * Math.sin(theta);
            points.push(new THREE.Vector2(x, y));
        }
    };

    let lastEndX = top.x;
    let lastLevelY = top.y;

    for (let i = 0; i < runs; i++) {
        const levelY = top.y - i * levelStep;
        const direction = i % 2 === 0 ? 1 : -1;
        const startX = top.x - direction * runHalfLength;
        const endX = top.x + direction * runHalfLength;
        const runEndY = levelY - runSlope;

        for (const f of RUN_POINT_FRACTIONS) {
            points.push(new THREE.Vector2(THREE.MathUtils.lerp(startX, endX, f), THREE.MathUtils.lerp(levelY, runEndY, f)));
        }

        const nextLevelY = top.y - (i + 1) * levelStep;
        pushBend(endX, direction, runEndY, nextLevelY);

        lastEndX = endX;
        lastLevelY = nextLevelY;
    }

    const mergeEndY = lastLevelY - levelStep * mergeFraction;
    const mergeRadiusX = bottom.x - lastEndX;
    const mergeRadiusY = lastLevelY - mergeEndY;
    const mergeSamples = 8;
    for (let s = 1; s < mergeSamples; s++) {
        const theta = (Math.PI / 2) * (1 - s / mergeSamples);
        const x = lastEndX + mergeRadiusX * Math.cos(theta);
        const y = mergeEndY + mergeRadiusY * Math.sin(theta);
        points.push(new THREE.Vector2(x, y));
    }

    const straightApproachStart = new THREE.Vector2(bottom.x, mergeEndY);
    points.push(straightApproachStart.clone());
    points.push(new THREE.Vector2(bottom.x, (mergeEndY + bottom.y) / 2));
    points.push(new THREE.Vector2(bottom.x, bottom.y));

    return { waypoints: points, straightApproachStart };
}
