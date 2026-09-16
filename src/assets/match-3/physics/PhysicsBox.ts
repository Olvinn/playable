import * as THREE from 'three';
import Matter from 'matter-js';
import { MATTER_SCALE, PHYSICS_FIXED_DT_MS } from './MatterScale';

export interface PhysicsBoxOptions {
    position: THREE.Vector2;
    halfExtents: THREE.Vector2;
    rotation?: number;
    mass?: number;
    restitution?: number;
}

export class PhysicsBox {
    readonly body: Matter.Body;
    readonly collider: { center: THREE.Vector2; halfExtents: THREE.Vector2; rotation: number; velocity: THREE.Vector2 };

    constructor(options: PhysicsBoxOptions) {
        const rotation = options.rotation ?? 0;
        this.collider = { center: options.position.clone(), halfExtents: options.halfExtents.clone(), rotation, velocity: new THREE.Vector2() };

        this.body = Matter.Bodies.rectangle(
            options.position.x * MATTER_SCALE,
            options.position.y * MATTER_SCALE,
            options.halfExtents.x * 2 * MATTER_SCALE,
            options.halfExtents.y * 2 * MATTER_SCALE,
            {
                angle: rotation,
                restitution: options.restitution ?? 0.2,
                friction: 0.02,
                frictionStatic: 0.05,
                frictionAir: 0.01,
            }
        );
        if (options.mass !== undefined) {
            Matter.Body.setMass(this.body, options.mass);
        }
        Matter.Body.setInertia(this.body, Infinity);
    }

    setVelocity(worldUnitsPerSecond: THREE.Vector2): void {
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        Matter.Body.setVelocity(this.body, {
            x: worldUnitsPerSecond.x * MATTER_SCALE * perStep,
            y: worldUnitsPerSecond.y * MATTER_SCALE * perStep,
        });
    }

    setAngularVelocity(radiansPerSecond: number): void {
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        Matter.Body.setAngularVelocity(this.body, radiansPerSecond * perStep);
    }

    applyAcceleration(worldAcceleration: THREE.Vector2): void {
        const factor = (this.body.mass * MATTER_SCALE) / 1_000_000;
        Matter.Body.applyForce(this.body, this.body.position, {
            x: worldAcceleration.x * factor,
            y: worldAcceleration.y * factor,
        });
    }

    freeze(): void {
        Matter.Body.setStatic(this.body, true);
    }

    setPosition(worldPosition: THREE.Vector2): void {
        Matter.Body.setPosition(this.body, {
            x: worldPosition.x * MATTER_SCALE,
            y: worldPosition.y * MATTER_SCALE,
        });
    }

    syncFromBody(): void {
        this.collider.center.set(this.body.position.x / MATTER_SCALE, this.body.position.y / MATTER_SCALE);
        this.collider.rotation = this.body.angle;
        const perStep = PHYSICS_FIXED_DT_MS / 1000;
        this.collider.velocity.set(this.body.velocity.x / MATTER_SCALE / perStep, this.body.velocity.y / MATTER_SCALE / perStep);
    }
}
