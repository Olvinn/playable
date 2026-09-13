import * as THREE from 'three';

export interface NeckProfileOptions {
    neckHalfWidth: number;
    mouthHalfWidth: number;
    /** Arc-length fraction (0-1) up to which the tube stays at neckHalfWidth before easing out to mouthHalfWidth. */
    neckFraction: number;
}

/**
 * Half-width of the tube at arc-length fraction t. Shared by TubeView (for
 * wall geometry) and SphereSpawner (for packing) so spheres are never
 * placed outside the walls they're drawn and collided against — one
 * profile, two consumers, instead of two copies that could drift apart.
 */
export function createNeckProfile(options: NeckProfileOptions): (t: number) => number {
    const { neckHalfWidth, mouthHalfWidth, neckFraction } = options;
    return (t: number): number => {
        if (t <= neckFraction) return neckHalfWidth;
        const eased = (t - neckFraction) / (1 - neckFraction);
        const smoothed = eased * eased * (3 - 2 * eased);
        return THREE.MathUtils.lerp(neckHalfWidth, mouthHalfWidth, smoothed);
    };
}