import * as THREE from 'three';

export interface GroundPlaneOptions {
    scene: THREE.Scene;
    textureUrl: string;
    normalMapUrl: string;
    width: number;
    height: number;
    tileWorldSize: number;
    center: THREE.Vector2;
    renderDepth?: number;
    normalScale?: number;
}

export class GroundPlane {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh;

    constructor(options: GroundPlaneOptions) {
        this.scene = options.scene;
        const depth = options.renderDepth ?? -50;
        const repeat = new THREE.Vector2(options.width / options.tileWorldSize, options.height / options.tileWorldSize);

        const loader = new THREE.TextureLoader();

        const map = loader.load(options.textureUrl);
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.repeat.copy(repeat);

        const normalMap = loader.load(options.normalMapUrl);
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.copy(repeat);

        const geometry = new THREE.PlaneGeometry(options.width, options.height);
        const scale = options.normalScale ?? 1;
        const material = new THREE.MeshStandardMaterial({
            map,
            normalMap,
            normalScale: new THREE.Vector2(scale, scale),
            roughness: 0.9,
            metalness: 0,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(options.center.x, options.center.y, depth);
        this.scene.add(this.mesh);
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        material.map?.dispose();
        material.normalMap?.dispose();
        material.dispose();
    }
}
