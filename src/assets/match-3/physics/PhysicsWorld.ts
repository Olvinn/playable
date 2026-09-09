import { PhysicsSphere } from './PhysicsSphere';
import { CollisionResolver } from './CollisionResolver';

export interface PhysicsWorldOptions {
    gravity?: number;
    maxSpeed?: number;
}

export class PhysicsWorld {
    private gravity: number;
    private maxSpeed: number;
    private resolver: CollisionResolver;
    private spheres: PhysicsSphere[] = [];

    constructor(resolver: CollisionResolver, options: PhysicsWorldOptions = {}) {
        this.resolver = resolver;
        this.gravity = options.gravity ?? 9.8;
        this.maxSpeed = options.maxSpeed ?? 20;
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

    step(deltaSeconds: number): void {
        for (const sphere of this.spheres) {
            sphere.velocity.y -= this.gravity * deltaSeconds;
            if (sphere.velocity.length() > this.maxSpeed) {
                sphere.velocity.setLength(this.maxSpeed);
            }
            sphere.collider.center.addScaledVector(sphere.velocity, deltaSeconds);
        }

        this.resolver.resolve(this.spheres);
    }
}