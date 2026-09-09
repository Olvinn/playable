import * as THREE from 'three';

export class CircleCollider {
    center: THREE.Vector2;
    radius: number;

    constructor(center: THREE.Vector2, radius: number) {
        this.center = center;
        this.radius = radius;
    }
}