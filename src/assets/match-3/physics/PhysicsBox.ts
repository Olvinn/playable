import * as THREE from 'three';
import { SquareCollider } from './colliders/SquareCollider.ts';

export interface PhysicsBoxOptions {
    position: THREE.Vector2;
    halfExtents: THREE.Vector2;
    mass?: number;
    restitution?: number;
}

/** A dynamic AABB body — same role as PhysicsSphere but box-shaped, for the rescue platform. */
export class PhysicsBox {
    collider: SquareCollider;
    velocity: THREE.Vector2;
    mass: number;
    restitution: number;

    constructor(options: PhysicsBoxOptions) {
        this.collider = new SquareCollider(options.position.clone(), options.halfExtents.clone(), 'dynamic');
        this.velocity = new THREE.Vector2();
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
    }
}
