import * as THREE from 'three';
import Matter from 'matter-js';
import { MATTER_SCALE, PHYSICS_FIXED_DT_MS } from './MatterScale';

export interface PhysicsBoxOptions {
    position: THREE.Vector2;
    halfExtents: THREE.Vector2;
    mass?: number;
    restitution?: number;
}

/**
 * A dynamic rectangle body — same role as PhysicsSphere but box-shaped, for the rescue platform.
 * Backed by a real Matter.js body, so pushing it into a pile of PhysicsSpheres gets Matter's own
 * narrow-phase + sequential-impulse resolution instead of the earlier hand-rolled one — see
 * PlatformCharacter for how applyAcceleration() drives it realistically each frame (force-based,
 * not the kinematic setVelocity() this class used to be driven by exclusively).
 */
export class PhysicsBox {
    readonly body: Matter.Body;
    readonly collider: { center: THREE.Vector2; halfExtents: THREE.Vector2; rotation: number; velocity: THREE.Vector2 };

    constructor(options: PhysicsBoxOptions) {
        this.collider = { center: options.position.clone(), halfExtents: options.halfExtents.clone(), rotation: 0, velocity: new THREE.Vector2() };

        this.body = Matter.Bodies.rectangle(
            options.position.x * MATTER_SCALE,
            options.position.y * MATTER_SCALE,
            options.halfExtents.x * 2 * MATTER_SCALE,
            options.halfExtents.y * 2 * MATTER_SCALE,
            {
                restitution: options.restitution ?? 0.2,
                // Low for the same reason as PhysicsSphere's — a high-friction platform surface
                // compounds with high-friction marbles to make a small, steady push feel like it
                // needs to "break free" with a sudden burst rather than sliding smoothly.
                friction: 0.02,
                frictionStatic: 0.05,
                frictionAir: 0.01,
            }
        );
        if (options.mass !== undefined) {
            Matter.Body.setMass(this.body, options.mass);
        }
        // Locks out *uncontrolled* angular response — asymmetric contact from a pile of marbles
        // would otherwise torque the body into tipping/spinning inside the tube (confirmed: an
        // earlier attempt at letting torque drive rotation directly span the platform thousands of
        // radians in a few seconds). This does NOT block setAngularVelocity()/setAngle() below —
        // those are kinematic, the same way setVelocity()/setPosition() bypass mass/force entirely
        // (checked directly against Matter's own source: all four just rewrite the body's
        // previous-position/-angle bookkeeping, not integrate a force through inertia). So a caller
        // can still deliberately, gradually rotate this body — just never a marble.
        Matter.Body.setInertia(this.body, Infinity);
    }

    /**
     * Sets the body's velocity directly, in world-units/second — the platform's kinematic
     * "walking" drive (see PlatformCharacter.pushTowardDoor). Matter's own velocity is
     * "displacement per fixed step," not per second, hence the PHYSICS_FIXED_DT_MS conversion —
     * see MatterScale.ts for why the engine is always stepped at that fixed rate.
     */
    setVelocity(worldUnitsPerSecond: THREE.Vector2): void {
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        Matter.Body.setVelocity(this.body, {
            x: worldUnitsPerSecond.x * MATTER_SCALE * perStep,
            y: worldUnitsPerSecond.y * MATTER_SCALE * perStep,
        });
    }

    /**
     * Sets the body's angular velocity directly, in radians/second — same kinematic pattern as
     * setVelocity, and same PHYSICS_FIXED_DT_MS reasoning for the conversion. Unlike setVelocity,
     * a caller should normally pass something *bounded* here rather than jumping straight to the
     * target angle each frame: this body is usually deep in contact with several other bodies, and
     * an instant reorientation creates a brand new overlap configuration for the solver to resolve
     * in one step, every step — verified directly to stall a body solid at the densest point of a
     * pile (the same failure mode setPosition's own doc comment describes for hard position snaps).
     * A capped rate lets Matter's solver negotiate the rotation smoothly instead.
     */
    setAngularVelocity(radiansPerSecond: number): void {
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        Matter.Body.setAngularVelocity(this.body, radiansPerSecond * perStep);
    }

    /**
     * Applies a world-space acceleration (world-units/second²) to the body for this step only —
     * Matter clears accumulated force after every Engine.update (checked in its own source), so
     * this must be called every frame to produce a sustained push, exactly like gravity itself is
     * reapplied every step. This is what makes the resulting motion a genuine force integrated
     * against real mass and real contact resistance (Matter's own solver decides how much of it
     * actually turns into motion), instead of a kinematic speed that ignores resistance entirely —
     * see PlatformCharacter for why that distinction is the whole point of this method existing.
     *
     * The conversion mirrors PhysicsWorld's own gravity.scale derivation exactly (same source,
     * same reasoning): Matter's Body.update integrates `force/mass` scaled by 1,000,000 (via
     * deltaTimeSquared in milliseconds) into a steady world-space acceleration, so solving that
     * relationship for `force` gives `mass * acceleration * MATTER_SCALE / 1,000,000`.
     */
    applyAcceleration(worldAcceleration: THREE.Vector2): void {
        const factor = (this.body.mass * MATTER_SCALE) / 1_000_000;
        Matter.Body.applyForce(this.body, this.body.position, {
            x: worldAcceleration.x * factor,
            y: worldAcceleration.y * factor,
        });
    }

    /** Locks the body permanently in place — once the platform reaches the door, it's done (see PlatformCharacter.hasArrived). */
    freeze(): void {
        Matter.Body.setStatic(this.body, true);
    }

    /**
     * Teleports the body to an exact world position every frame — used to kinematically attach
     * one body to another's motion (see PlatformCharacter's characterBox, which rides at a fixed
     * offset from the platform). Unlike setVelocity, this doesn't try to look like a physically
     * driven motion; it's a hard positional lock, appropriate for something that has no physics
     * identity of its own and just needs to occupy real space so marbles can't pass through it.
     */
    setPosition(worldPosition: THREE.Vector2): void {
        Matter.Body.setPosition(this.body, {
            x: worldPosition.x * MATTER_SCALE,
            y: worldPosition.y * MATTER_SCALE,
        });
    }

    /** Pulls collider.center/rotation/velocity back from Matter's internal (scaled) body state. Called by PhysicsWorld after each step. */
    syncFromBody(): void {
        this.collider.center.set(this.body.position.x / MATTER_SCALE, this.body.position.y / MATTER_SCALE);
        this.collider.rotation = this.body.angle;
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        this.collider.velocity.set(this.body.velocity.x / MATTER_SCALE / perStep, this.body.velocity.y / MATTER_SCALE / perStep);
    }
}
