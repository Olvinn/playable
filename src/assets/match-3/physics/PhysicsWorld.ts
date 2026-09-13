import { PhysicsSphere } from './PhysicsSphere';
import { PhysicsBox } from './PhysicsBox';
import { CollisionResolver } from './CollisionResolver';

export interface PhysicsWorldOptions {
    gravity?: number;
    maxSpeed?: number;
    /** Relaxation passes per step. A single pass only propagates a contact correction one hop per frame, so a deep resting stack (marbles piled on marbles, all the way down to the static grid floor) never fully settles — it just keeps creeping tighter forever. Multiple passes let the support force reach all the way through the stack within one frame. */
    solverIterations?: number;
}

export class PhysicsWorld {
    private gravity: number;
    private maxSpeed: number;
    private solverIterations: number;
    private resolver: CollisionResolver;
    private spheres: PhysicsSphere[] = [];
    private boxes: PhysicsBox[] = [];

    constructor(resolver: CollisionResolver, options: PhysicsWorldOptions = {}) {
        this.resolver = resolver;
        this.gravity = options.gravity ?? 9.8;
        this.maxSpeed = options.maxSpeed ?? 20;
        this.solverIterations = options.solverIterations ?? 8;
    }

    addSphere(sphere: PhysicsSphere): void {
        this.spheres.push(sphere);
    }

    removeSphere(sphere: PhysicsSphere): void {
        const index = this.spheres.indexOf(sphere);
        if (index !== -1) this.spheres.splice(index, 1);
    }

    getSpheres(): readonly PhysicsSphere[] {
        return this.spheres;
    }

    addBox(box: PhysicsBox): void {
        this.boxes.push(box);
    }

    removeBox(box: PhysicsBox): void {
        const index = this.boxes.indexOf(box);
        if (index !== -1) this.boxes.splice(index, 1);
    }

    step(deltaSeconds: number): void {
        for (const sphere of this.spheres) {
            sphere.velocity.y -= this.gravity * deltaSeconds;
            if (sphere.velocity.length() > this.maxSpeed) {
                sphere.velocity.setLength(this.maxSpeed);
            }
            sphere.collider.center.addScaledVector(sphere.velocity, deltaSeconds);
        }

        for (const box of this.boxes) {
            box.velocity.y -= this.gravity * deltaSeconds;
            if (box.velocity.length() > this.maxSpeed) {
                box.velocity.setLength(this.maxSpeed);
            }
            box.collider.center.addScaledVector(box.velocity, deltaSeconds);
        }

        for (let i = 0; i < this.solverIterations; i++) {
            this.resolver.resolve(this.spheres, this.boxes);
        }
    }
}