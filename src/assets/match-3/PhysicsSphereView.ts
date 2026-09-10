import * as THREE from 'three';
import { PhysicsSphere } from './physics/PhysicsSphere';

export interface PhysicsSphereViewOptions {
    color?: number;
    /** Z-offset placing the sphere in front of the grid's extruded box faces. */
    renderDepth?: number;
    segments?: number;
}

/** Renders one PhysicsSphere. Physics only ever produces x/y — this is the one place a z gets attached. */
export class PhysicsSphereView {
    readonly mesh: THREE.Mesh;
    private sphere: PhysicsSphere;
    private renderDepth: number;

    constructor(sphere: PhysicsSphere, options: PhysicsSphereViewOptions = {}) {
        this.sphere = sphere;
        this.renderDepth = options.renderDepth ?? 0.5;

        const segments = options.segments ?? 16;
        const geometry = new THREE.SphereGeometry(sphere.collider.radius, segments, segments);
        const material = new THREE.MeshStandardMaterial({ color: options.color ?? 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.sync();
    }

    /** Copies the physics sphere's 2D position onto the mesh. Call once per frame. */
    sync(): void {
        this.mesh.position.set(this.sphere.collider.center.x, this.sphere.collider.center.y, this.renderDepth);
    }

    spawn(scene: THREE.Scene): void {
        scene.add(this.mesh);
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}