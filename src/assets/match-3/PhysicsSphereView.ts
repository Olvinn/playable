import * as THREE from 'three';
import { PhysicsSphere } from './physics/PhysicsSphere';

export interface PhysicsSphereViewOptions {
    color?: number;
    renderDepth?: number;
    segments?: number;
}

export class PhysicsSphereView {
    readonly mesh: THREE.Mesh;
    private sphere: PhysicsSphere;
    private renderDepth: number;

    constructor(sphere: PhysicsSphere, options: PhysicsSphereViewOptions = {}) {
        this.sphere = sphere;
        this.renderDepth = options.renderDepth ?? 0.5;

        const segments = options.segments ?? 16;
        const geometry = new THREE.SphereGeometry(sphere.collider.radius, segments, segments);
        const color = options.color ?? 0xffffff;
        const material = new THREE.MeshPhysicalMaterial({
            color,
            attenuationColor: color,
            // Shorter than the sphere's own diameter so light passing through picks up a strong,
            // saturated tint instead of reading as barely-tinted clear glass.
            attenuationDistance: sphere.collider.radius * 0.8,
            emissive: color,
            emissiveIntensity: 0.25,
            roughness: 0.05,
            metalness: 0,
            transmission: 0.95,
            ior: 1.5,
            thickness: sphere.collider.radius * 2,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.6,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.sync();
    }

    sync(): void {
        this.mesh.position.set(this.sphere.collider.center.x, this.sphere.collider.center.y, this.renderDepth);
    }

    /** Adjust this sphere's render depth after the fact — for placing it more pleasantly relative to other layers. */
    setRenderDepth(depth: number): void {
        this.renderDepth = depth;
        this.sync();
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