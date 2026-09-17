import * as THREE from 'three';
import Matter from 'matter-js';
import { PhysicsWorld } from './physics/PhysicsWorld';

export interface GridBoxOptions {
    size: number;
    colors: number[];
    geometry: THREE.BufferGeometry;
    physicsWorld: PhysicsWorld;
    colliderHalfSize: number;
    highlightColor?: number;
    depthRatio?: number;
}

export class GridBox {
    readonly mesh: THREE.Mesh;
    readonly colorIndex: number;

    private readonly depthRatio: number;
    private readonly highlightColor: THREE.Color;
    private readonly noHighlight = new THREE.Color(0x000000);
    private clickCallback: (() => void) | null = null;
    private currentSize: number;
    private physicsWorld: PhysicsWorld;
    private colliderHalfSize: number;
    private colliderBody: Matter.Body | null = null;

    constructor(colorIndex: number, options: GridBoxOptions) {
        this.colorIndex = colorIndex;
        this.depthRatio = options.depthRatio ?? 0.3;
        this.highlightColor = new THREE.Color(options.highlightColor ?? 0xffffff);
        this.currentSize = options.size;
        this.physicsWorld = options.physicsWorld;
        this.colliderHalfSize = options.colliderHalfSize;

        const color = new THREE.Color(options.colors[colorIndex]).multiplyScalar(0.75);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.3 });
        this.mesh = new THREE.Mesh(options.geometry, material);
        this.setSize(options.size);
    }

    spawn(scene: THREE.Scene, position: THREE.Vector3): void {
        this.mesh.position.copy(position);
        scene.add(this.mesh);
        this.colliderBody = this.physicsWorld.addGridCollider(
            new THREE.Vector2(position.x, position.y),
            new THREE.Vector2(this.colliderHalfSize, this.colliderHalfSize)
        );
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        (this.mesh.material as THREE.Material).dispose();
        if (this.colliderBody) {
            this.physicsWorld.removeGridCollider(this.colliderBody);
            this.colliderBody = null;
        }
    }

    moveTo(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
        if (this.colliderBody) {
            this.physicsWorld.setGridColliderPosition(this.colliderBody, new THREE.Vector2(position.x, position.y));
        }
    }

    setSize(size: number): void {
        this.currentSize = size;
        this.mesh.scale.set(size, size, size * this.depthRatio);
    }

    setScale(factor: number): void {
        this.mesh.scale.set(
            this.currentSize * factor,
            this.currentSize * factor,
            this.currentSize * this.depthRatio * factor
        );
    }

    setHighlighted(highlighted: boolean): void {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.emissive = highlighted ? this.highlightColor : this.noHighlight;
        material.emissiveIntensity = highlighted ? 0.6 : 0;
    }

    onClick(cb: () => void): void {
        this.clickCallback = cb;
    }

    handleClick(): void {
        this.clickCallback?.();
    }
}