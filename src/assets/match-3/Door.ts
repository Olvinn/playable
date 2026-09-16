import * as THREE from 'three';

export interface DoorOptions {
    scene: THREE.Scene;
    center: THREE.Vector2;
    halfWidth: number;
    height?: number;
    color?: number;
    renderDepth?: number;
    textureUrl?: string;
}

export class Door {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh;

    constructor(options: DoorOptions) {
        this.scene = options.scene;
        const height = options.height ?? 0.8;
        const color = options.color ?? 0xd9a441;
        const depth = options.renderDepth ?? -0.2;

        const geometry = new THREE.PlaneGeometry(options.halfWidth * 2, height);
        const material = options.textureUrl
            ? new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5 })
            : new THREE.MeshBasicMaterial({ color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(options.center.x, options.center.y, depth);
        this.scene.add(this.mesh);

        if (options.textureUrl) {
            const loader = new THREE.TextureLoader();
            loader.load(options.textureUrl, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                (material as THREE.MeshBasicMaterial).map = texture;
                (material as THREE.MeshBasicMaterial).needsUpdate = true;

                const aspect = texture.image.width / texture.image.height;
                geometry.dispose();
                this.mesh.geometry = new THREE.PlaneGeometry(height * aspect, height);
            });
        }
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
