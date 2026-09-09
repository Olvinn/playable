import * as THREE from 'three';
import { CircleCollider } from './colliders/CircleCollider.ts';

export interface PhysicsSphereOptions {
    id: number;
    position: THREE.Vector2;
    radius: number;
    mass?: number;
    restitution?: number;
}

export class PhysicsSphere {
    id: number;
    collider: CircleCollider;
    velocity: THREE.Vector2;
    mass: number;
    restitution: number;

    constructor(options: PhysicsSphereOptions) {
        this.id = options.id;
        this.collider = new CircleCollider(options.position.clone(), options.radius);
        this.velocity = new THREE.Vector2();
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
    }
}