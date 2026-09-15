import * as THREE from 'three';
import Matter from 'matter-js';
import { MATTER_SCALE } from './MatterScale';

export interface PhysicsSphereOptions {
    id: number;
    position: THREE.Vector2;
    radius: number;
    mass?: number;
    restitution?: number;
}

/**
 * A dynamic circle body, backed by a real Matter.js rigid body instead of the earlier hand-rolled
 * solver. collider.center/radius stay in the game's native (unscaled) world units regardless of
 * Matter's own internal scale — see MatterScale.ts — so everything outside physics/ (spawning,
 * rendering, despawn checks) reads exactly the same way it always did.
 */
export class PhysicsSphere {
    readonly id: number;
    readonly body: Matter.Body;
    readonly collider: { center: THREE.Vector2; radius: number };

    constructor(options: PhysicsSphereOptions) {
        this.id = options.id;
        this.collider = { center: options.position.clone(), radius: options.radius };

        this.body = Matter.Bodies.circle(
            options.position.x * MATTER_SCALE,
            options.position.y * MATTER_SCALE,
            options.radius * MATTER_SCALE,
            {
                restitution: options.restitution ?? 0.2,
                friction: 0.05,
                frictionStatic: 0.3,
                frictionAir: 0.01,
            }
        );
        if (options.mass !== undefined) {
            Matter.Body.setMass(this.body, options.mass);
        }
    }

    /** Pulls collider.center back from Matter's internal (scaled) body state. Called by PhysicsWorld after each step. */
    syncFromBody(): void {
        this.collider.center.set(this.body.position.x / MATTER_SCALE, this.body.position.y / MATTER_SCALE);
    }
}
