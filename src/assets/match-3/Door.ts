import * as THREE from 'three';

export interface DoorOptions {
    scene: THREE.Scene;
    /** World position of the door's center. */
    center: THREE.Vector2;
    halfWidth: number;
    height?: number;
    color?: number;
    renderDepth?: number;
    /** Path to a texture (e.g. a door illustration with transparency) to use instead of a flat color. */
    textureUrl?: string;
}

/**
 * Purely a visual marker for where the rescue platform is headed — a flat
 * panel with no collider, sitting behind the marbles in the tube's backdrop
 * layer (in front of TubeBackdrop's dark fill, behind the marbles
 * themselves). It doesn't stop anything physically: the marbles piled in
 * front of it are what obstruct the platform, and once they're gone this
 * becomes visible. See main.ts for the actual win check (marble count hits
 * zero).
 */
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

                // Re-fit the plane to the texture's own aspect ratio (anchored on height) so the
                // door art isn't stretched to match the tube's neck width — the image is square
                // with transparent padding around the door shape, not a tight halfWidth-sized crop.
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
