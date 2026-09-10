import * as THREE from 'three';

export interface GridBoxOptions {
    size: number;
    colors: number[];
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

    constructor(colorIndex: number, options: GridBoxOptions) {
        this.colorIndex = colorIndex;
        this.depthRatio = options.depthRatio ?? 0.3;
        this.highlightColor = new THREE.Color(options.highlightColor ?? 0xffffff);
        this.currentSize = options.size;

        const geometry = new THREE.BoxGeometry(1, 1, 5);
        const material = new THREE.MeshStandardMaterial({ color: options.colors[colorIndex] });
        this.mesh = new THREE.Mesh(geometry, material);
        this.setSize(options.size);
    }

    spawn(scene: THREE.Scene, position: THREE.Vector3): void {
        this.mesh.position.copy(position);
        scene.add(this.mesh);
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }

    moveTo(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
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