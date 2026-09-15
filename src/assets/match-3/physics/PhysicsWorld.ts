import Matter from 'matter-js';
import { PhysicsSphere } from './PhysicsSphere';
import { PhysicsBox } from './PhysicsBox';
import { SquareCollider } from './colliders/SquareCollider';
import { SegmentCollider } from './colliders/SegmentCollider';
import { MATTER_SCALE, PHYSICS_FIXED_DT_MS } from './MatterScale';

export interface PhysicsWorldOptions {
    gravity?: number;
}

/**
 * Thin wrapper around a Matter.js Engine, replacing the earlier hand-rolled position-based
 * solver. That solver's simplistic per-contact velocity reflection could hold a sustained push to
 * a permanent, verified standstill against a packed pile of marbles (reflecting an added velocity
 * to zero every single frame once full contact held, no matter how much force was behind it) —
 * see PlatformCharacter for the history. Matter's real narrow-phase collision + sequential-impulse
 * solver, with actual friction and multiple correction passes per step, resolves the same
 * "platform pushing through a pile" scenario the way physics engines are actually built to.
 */
export class PhysicsWorld {
    private engine: Matter.Engine;
    private spheres: PhysicsSphere[] = [];
    private boxes: PhysicsBox[] = [];
    private wallBodies: Matter.Body[] = [];
    private gridBodies: Matter.Body[] = [];

    constructor(options: PhysicsWorldOptions = {}) {
        this.engine = Matter.Engine.create();
        this.engine.gravity.x = 0;
        this.engine.gravity.y = -1; // this game's world is Y-up; Matter's default gravity direction is Y-down
        // Derived from Matter's own source (Engine._bodiesApplyGravity + Body.update's Verlet
        // integration, both in node_modules/matter-js/src): with gravity.y=±1, the resulting
        // world-space acceleration works out to gravity.scale * 1,000,000 / MATTER_SCALE. Solving
        // that for the desired acceleration gives the formula below — not a guess, checked against
        // the library's actual integration math, since getting this wrong either way (too weak,
        // gravity barely acts; too strong, bodies tunnel through thin walls in one step) would be
        // easy to do blind.
        this.engine.gravity.scale = ((options.gravity ?? 9.8) * MATTER_SCALE) / 1_000_000;
    }

    addSphere(sphere: PhysicsSphere): void {
        this.spheres.push(sphere);
        Matter.Composite.add(this.engine.world, sphere.body);
    }

    removeSphere(sphere: PhysicsSphere): void {
        const index = this.spheres.indexOf(sphere);
        if (index !== -1) this.spheres.splice(index, 1);
        Matter.Composite.remove(this.engine.world, sphere.body);
    }

    getSpheres(): readonly PhysicsSphere[] {
        return this.spheres;
    }

    addBox(box: PhysicsBox): void {
        this.boxes.push(box);
        Matter.Composite.add(this.engine.world, box.body);
    }

    removeBox(box: PhysicsBox): void {
        const index = this.boxes.indexOf(box);
        if (index !== -1) this.boxes.splice(index, 1);
        Matter.Composite.remove(this.engine.world, box.body);
    }

    /**
     * Static walls (e.g. the tube's curved boundary), one chain of thin rectangle segments per
     * input polyline — replaces the whole set each call, since callers (main.ts) only ever set
     * this once with the tube's full left/right wall chains.
     *
     * Each polyline point becomes a circle, not a rectangle per segment between points. That
     * wasn't a style choice: an independent rectangle per segment has square-cut ends, and at any
     * joint where the curve bends — which is everywhere on this serpentine tube — the two
     * neighboring rectangles aren't mitered to match, so a small notch projects into the tube's
     * passable interior on the inside of every bend. The platform, being nearly as wide as the
     * tube itself, snagged on exactly that: caught in simultaneous contact with several of these
     * notches at once (verified directly — 4 active static-wall contacts at a single stall point,
     * on a section of tube with no marbles blocking it), which is what was actually holding it to
     * a standstill, not the marble pile. A circle has no corners for a joint to go wrong at — one
     * circle per waypoint, spaced closer together than the wall thickness so they overlap
     * continuously, forms a smooth boundary with no notches or gaps regardless of curvature.
     */
    setStaticWalls(chains: SegmentCollider[][], thickness: number): void {
        if (this.wallBodies.length > 0) {
            Matter.Composite.remove(this.engine.world, this.wallBodies);
            this.wallBodies = [];
        }

        for (const chain of chains) {
            if (chain.length === 0) continue;
            const points = [chain[0].a, ...chain.map(segment => segment.b)];

            for (const point of points) {
                const body = Matter.Bodies.circle(
                    point.x * MATTER_SCALE,
                    point.y * MATTER_SCALE,
                    (thickness / 2) * MATTER_SCALE,
                    { isStatic: true, friction: 0.05, restitution: 0.1 }
                );
                this.wallBodies.push(body);
            }
        }
        Matter.Composite.add(this.engine.world, this.wallBodies);
    }

    /**
     * Static bodies for the match-3 grid's currently-occupied cells — replaces the whole set each
     * call. Called every time the board changes (see main.ts's syncBoxColliders), so spheres
     * always rest on exactly the tiles still standing.
     */
    setGridColliders(colliders: SquareCollider[]): void {
        if (this.gridBodies.length > 0) {
            Matter.Composite.remove(this.engine.world, this.gridBodies);
            this.gridBodies = [];
        }

        for (const collider of colliders) {
            const body = Matter.Bodies.rectangle(
                collider.center.x * MATTER_SCALE,
                collider.center.y * MATTER_SCALE,
                collider.halfExtents.x * 2 * MATTER_SCALE,
                collider.halfExtents.y * 2 * MATTER_SCALE,
                { isStatic: true, friction: 0.05, restitution: 0.1 }
            );
            this.gridBodies.push(body);
        }
        Matter.Composite.add(this.engine.world, this.gridBodies);
    }

    step(_deltaSeconds: number): void {
        // Fixed step regardless of the actual frame delta — see MatterScale.ts for why.
        Matter.Engine.update(this.engine, PHYSICS_FIXED_DT_MS);

        for (const sphere of this.spheres) sphere.syncFromBody();
        for (const box of this.boxes) box.syncFromBody();
    }
}
