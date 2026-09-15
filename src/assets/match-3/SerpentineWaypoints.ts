import * as THREE from 'three';

/** Fractions along each straight run to place waypoints at — denser near both ends, sparser in the middle. */
const RUN_POINT_FRACTIONS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1];

export interface SerpentineOptions {
    /** Start point (top, arc-length t=0). */
    top: THREE.Vector2;
    /** End point (bottom, arc-length t=1) — the path always finishes here, however many runs there are. */
    bottom: THREE.Vector2;
    /** Number of straight horizontal runs between top and bottom. */
    runs: number;
    /** Half-length of each straight run — a run spans top.x ± this. */
    runHalfLength: number;
    /** How far each hairpin bulges outward past the run's end. Must clear the tube's own half-width, or the inner wall of the turn pinches shut. */
    bendRadius: number;
    /** Waypoints used to approximate each hairpin's half-ellipse — higher is smoother. */
    bendSamples?: number;
    /** Fraction of the final level's drop spent easing back to center (bottom.x) before the last straight vertical approach. */
    mergeFraction?: number;
    /**
     * Fraction of one level's drop spent sloping down *within* each straight run, rather than all
     * of it happening in the bend between runs. A perfectly horizontal run gives gravity zero
     * pull along the direction of travel there, so anything resting on it — marbles or the
     * platform — has no help at all sliding forward; the only force available is whatever's
     * pushing it directly, which reads as needing to "break free" rather than settling and
     * sliding. A gentle continuous slope means gravity always has some tangential component,
     * everywhere on the path, not just in the bends. 0 = perfectly horizontal runs (the original
     * behavior).
     */
    runSlopeFraction?: number;
}

export interface SerpentineResult {
    waypoints: THREE.Vector2[];
    /** Where the path becomes straight (vertically, centered on bottom.x) for good — the only place it's safe to widen the tube without the offset walls self-intersecting through a curve. */
    straightApproachStart: THREE.Vector2;
}

/**
 * Waypoints for a serpentine pipe: straight horizontal runs connected by
 * tight U-turn hairpins, dropping one level per run — the "pipe fittings"
 * shape (think Royal Match's tube), as opposed to NeckWaypoints' smooth
 * sine-wave S-curve. Each hairpin is a half-ellipse: it enters and exits at
 * the same x (a true U-turn, not a diagonal cut) and bulges outward by
 * bendRadius at its midpoint.
 *
 * After the last run there's one extra hairpin (identical to the ones
 * between runs) before easing into the straight vertical approach to
 * `bottom`. That's not decorative — the last run always ends on the side
 * *away* from center, so its exit tangent points away from bottom.x. A
 * curve can't reach bottom.x while leaving in that direction without
 * looping back on itself first (which is exactly what a plain
 * run-then-merge does: Catmull-Rom overshoots past the join and loops,
 * regardless of tube width or how densely that join is sampled — verified
 * by direct curve sampling, not just visually). The extra hairpin reverses
 * the tangent to point back toward center *before* the merge, so the merge
 * only ever has to do a plain quarter-turn.
 */
export function buildSerpentineWaypoints(options: SerpentineOptions): SerpentineResult {
    const { top, bottom, runs, runHalfLength, bendRadius } = options;
    const bendSamples = options.bendSamples ?? 10;
    const mergeFraction = options.mergeFraction ?? 0.5;
    const runSlopeFraction = options.runSlopeFraction ?? 0;
    const points: THREE.Vector2[] = [];

    // `runs` levels between the runs, plus one more for the extra recentering hairpin.
    const totalDrop = top.y - bottom.y;
    const levelStep = totalDrop / (runs + 1);
    const runSlope = levelStep * runSlopeFraction;

    const pushBend = (endX: number, direction: number, bendStartY: number, bendEndY: number): void => {
        const midY = (bendStartY + bendEndY) / 2;
        const halfDrop = (bendStartY - bendEndY) / 2;
        for (let s = 1; s < bendSamples; s++) {
            const theta = Math.PI / 2 - (s / bendSamples) * Math.PI; // sweeps 90deg -> -90deg, through the outward bulge at 0deg
            const x = endX + direction * bendRadius * Math.cos(theta);
            const y = midY + halfDrop * Math.sin(theta);
            points.push(new THREE.Vector2(x, y));
        }
    };

    let lastEndX = top.x;
    let lastLevelY = top.y;

    for (let i = 0; i < runs; i++) {
        const levelY = top.y - i * levelStep;
        const direction = i % 2 === 0 ? 1 : -1; // alternate which side each run swings toward
        const startX = top.x - direction * runHalfLength;
        const endX = top.x + direction * runHalfLength;
        const runEndY = levelY - runSlope; // where the run actually ends, after sloping down across its own length

        // Colinear-in-spirit points along the run (now sloped, so not literally colinear with a
        // horizontal line) — denser near both ends than in the middle, which keeps Catmull-Rom's
        // local tangent estimate stable across the join with the tightly-packed hairpin points on
        // either side.
        for (const f of RUN_POINT_FRACTIONS) {
            points.push(new THREE.Vector2(THREE.MathUtils.lerp(startX, endX, f), THREE.MathUtils.lerp(levelY, runEndY, f)));
        }

        const nextLevelY = top.y - (i + 1) * levelStep;
        pushBend(endX, direction, runEndY, nextLevelY);

        lastEndX = endX;
        lastLevelY = nextLevelY;
    }

    // Ease from the recentering hairpin's exit (tangent already pointing toward bottom.x) into the
    // straight vertical approach. A plain quarter-ellipse: entry horizontal, exit vertical.
    const mergeEndY = lastLevelY - levelStep * mergeFraction;
    const mergeRadiusX = bottom.x - lastEndX;
    const mergeRadiusY = lastLevelY - mergeEndY;
    const mergeSamples = 8;
    for (let s = 1; s < mergeSamples; s++) {
        const theta = (Math.PI / 2) * (1 - s / mergeSamples); // 90deg (horizontal entry) -> 0deg (vertical exit)
        const x = lastEndX + mergeRadiusX * Math.cos(theta);
        const y = mergeEndY + mergeRadiusY * Math.sin(theta);
        points.push(new THREE.Vector2(x, y));
    }

    // Straight vertical home stretch, centered on bottom.x — guaranteed curvature-free.
    const straightApproachStart = new THREE.Vector2(bottom.x, mergeEndY);
    points.push(straightApproachStart.clone());
    points.push(new THREE.Vector2(bottom.x, (mergeEndY + bottom.y) / 2));
    points.push(new THREE.Vector2(bottom.x, bottom.y));

    return { waypoints: points, straightApproachStart };
}
