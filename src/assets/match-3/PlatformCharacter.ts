import * as THREE from 'three';
import { PhysicsBox } from './physics/PhysicsBox';
import { PhysicsWorld } from './physics/PhysicsWorld';

export interface PlatformCharacterOptions {
    scene: THREE.Scene;
    world: PhysicsWorld;
    /** Starting center of the platform's own collider — put it just above the topmost marble layer. */
    position: THREE.Vector2;
    platformHalfWidth: number;
    platformHalfThickness: number;
    characterSize: number;
    mass?: number;
    restitution?: number;
    platformColor?: number;
    characterColor?: number;
    renderDepth?: number;
}

/**
 * The rescue objective: a physicalized platform riding on top of the marble
 * pile, with a character box sitting rigidly on it. Only the platform has a
 * collider — the character is purely visual since it never leaves the
 * platform. Gravity plus contact against the spheres below is what makes
 * the whole thing sink as marbles drain out from underneath.
 */
export class PlatformCharacter {
    readonly box: PhysicsBox;
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private group: THREE.Group;
    private platformMesh: THREE.Mesh;
    private characterMesh: THREE.Mesh;

    constructor(options: PlatformCharacterOptions) {
        this.scene = options.scene;
        this.world = options.world;

        this.box = new PhysicsBox({
            position: options.position,
            halfExtents: new THREE.Vector2(options.platformHalfWidth, options.platformHalfThickness),
            mass: options.mass ?? 8,
            restitution: options.restitution ?? 0.05,
        });
        this.world.addBox(this.box);

        const depth = options.renderDepth ?? 0.5;

        const platformGeometry = new THREE.BoxGeometry(options.platformHalfWidth * 2, options.platformHalfThickness * 2, depth);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: options.platformColor ?? 0x8899aa });
        this.platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);

        const characterGeometry = new THREE.BoxGeometry(options.characterSize, options.characterSize, depth);
        const characterMaterial = new THREE.MeshStandardMaterial({ color: options.characterColor ?? 0xff4477 });
        this.characterMesh = new THREE.Mesh(characterGeometry, characterMaterial);
        this.characterMesh.position.y = options.platformHalfThickness + options.characterSize / 2;

        this.group = new THREE.Group();
        this.group.add(this.platformMesh, this.characterMesh);
        this.scene.add(this.group);

        this.sync();
    }

    sync(): void {
        this.group.position.set(this.box.collider.center.x, this.box.collider.center.y, 0);
    }

    dispose(): void {
        this.world.removeBox(this.box);
        this.scene.remove(this.group);
        this.platformMesh.geometry.dispose();
        (this.platformMesh.material as THREE.Material).dispose();
        this.characterMesh.geometry.dispose();
        (this.characterMesh.material as THREE.Material).dispose();
    }
}
