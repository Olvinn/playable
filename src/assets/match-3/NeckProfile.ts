import * as THREE from 'three';

export interface NeckProfileOptions {
    neckHalfWidth: number;
    mouthHalfWidth: number;
    neckFraction: number;
}

export function createNeckProfile(options: NeckProfileOptions): (t: number) => number {
    const { neckHalfWidth, mouthHalfWidth, neckFraction } = options;
    return (t: number): number => {
        if (t <= neckFraction) return neckHalfWidth;
        const eased = (t - neckFraction) / (1 - neckFraction);
        const smoothed = eased * eased * (3 - 2 * eased);
        return THREE.MathUtils.lerp(neckHalfWidth, mouthHalfWidth, smoothed);
    };
}