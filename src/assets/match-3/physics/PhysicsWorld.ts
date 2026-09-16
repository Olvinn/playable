import Matter from 'matter-js';
import { PhysicsSphere } from './PhysicsSphere';
import { PhysicsBox } from './PhysicsBox';
import { SquareCollider } from './colliders/SquareCollider';
import { SegmentCollider } from './colliders/SegmentCollider';
import { MATTER_SCALE, PHYSICS_FIXED_DT_MS } from './MatterScale';

export interface PhysicsWorldOptions {
    gravity?: number;
}

export class PhysicsWorld {
    private engine: Matter.Engine;
    private spheres: PhysicsSphere[] = [];
    private boxes: PhysicsBox[] = [];
    private wallBodies: Matter.Body[] = [];
    private gridBodiesById: Map<string, Matter.Body> = new Map();

    constructor(options: PhysicsWorldOptions = {}) {
        this.engine = Matter.Engine.create();
        this.engine.gravity.x = 0;
        this.engine.gravity.y = -1;
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

    addStaticBoxes(colliders: SquareCollider[]): void {
        const bodies = colliders.map(collider => Matter.Bodies.rectangle(
            collider.center.x * MATTER_SCALE,
            collider.center.y * MATTER_SCALE,
            collider.halfExtents.x * 2 * MATTER_SCALE,
            collider.halfExtents.y * 2 * MATTER_SCALE,
            { isStatic: true, friction: 0.05, restitution: 0.1 }
        ));
        Matter.Composite.add(this.engine.world, bodies);
    }

    setGridColliders(colliders: SquareCollider[]): void {
        const nextIds = new Set(colliders.map(c => c.cellId));

        for (const [id, body] of this.gridBodiesById) {
            if (nextIds.has(id)) continue;
            Matter.Composite.remove(this.engine.world, body);
            this.gridBodiesById.delete(id);
        }

        const added: Matter.Body[] = [];
        for (const collider of colliders) {
            if (this.gridBodiesById.has(collider.cellId)) continue;
            const body = Matter.Bodies.rectangle(
                collider.center.x * MATTER_SCALE,
                collider.center.y * MATTER_SCALE,
                collider.halfExtents.x * 2 * MATTER_SCALE,
                collider.halfExtents.y * 2 * MATTER_SCALE,
                { isStatic: true, friction: 0.05, restitution: 0.1 }
            );
            this.gridBodiesById.set(collider.cellId, body);
            added.push(body);
        }
        if (added.length > 0) Matter.Composite.add(this.engine.world, added);
    }

    step(_deltaSeconds: number): void {
        Matter.Engine.update(this.engine, PHYSICS_FIXED_DT_MS);

        for (const sphere of this.spheres) sphere.syncFromBody();
        for (const box of this.boxes) box.syncFromBody();
    }
}
