import * as THREE from 'three';
import { NeckPath } from './NeckPath';

export interface ChaserPlatformOptions {
    scene: THREE.Scene;
    path: NeckPath;
    /** Half-width of the tube at each arc-length fraction — see NeckProfile.ts. Sizes the visual to the tube it's currently in, same as TubeView/SphereSpawner. */
    halfWidthAt: (t: number) => number;
    /** Constant arc-length fraction covered per second. NeckPath is arc-length parameterized (see its own doc comment), so a constant rate here is a genuinely constant world-space speed, not just a constant parameter step. */
    speedTPerSecond: number;
    startT?: number;
    thickness?: number;
    color?: number;
    renderDepth?: number;
}

/**
 * The lose condition, replacing a plain countdown: an unstoppable wall that crawls down the tube
 * behind the player at a fixed rate — reaching the player's platform is what loses the game,
 * instead of a numeric timer hitting zero. Deliberately has no physics body of its own and never
 * touches the marble pile: PlatformCharacter's own history (see its class doc) already found that
 * snapping a solid collider's position directly, every frame, into a dense pile forces Matter to
 * resolve a huge new overlap in one step and reads as violent, disruptive corrections — exactly
 * what a hard position-driven kinematic body would do here, every single frame, for the pile it's
 * crawling through. Since "catches the player" only ever needs to compare two arc-length
 * positions, there's no actual need for it to be a real rigid body at all.
 */
export class ChaserPlatform {
    private scene: THREE.Scene;
    private path: NeckPath;
    private halfWidthAt: (t: number) => number;
    private speedTPerSecond: number;
    private mesh: THREE.Mesh;
    private renderDepth: number;
    t: number;

    constructor(options: ChaserPlatformOptions) {
        this.scene = options.scene;
        this.path = options.path;
        this.halfWidthAt = options.halfWidthAt;
        this.speedTPerSecond = options.speedTPerSecond;
        this.t = options.startT ?? 0;
        this.renderDepth = options.renderDepth ?? 0.45;

        const thickness = options.thickness ?? 0.18;
        // Unit width — real width varies with the tube's own profile, applied per-frame via
        // mesh.scale.x in sync() rather than rebuilding geometry every frame.
        const geometry = new THREE.PlaneGeometry(1, thickness * 2);
        const material = new THREE.MeshStandardMaterial({ color: options.color ?? 0xaa2222 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        this.sync();
    }

    /** Advances at the fixed rate regardless of anything else in the scene — call once per frame. */
    update(deltaSeconds: number): void {
        this.t = Math.min(this.t + this.speedTPerSecond * deltaSeconds, 1);
        this.sync();
    }

    private sync(): void {
        const point = this.path.getPoint(this.t);
        const tangent = this.path.getTangent(this.t);
        // Same convention as PlatformCharacter's targetAngle: rotating local +X by this angle lands
        // it on (-tangent.y, tangent.x), i.e. across the tube — which is the direction mesh.scale.x
        // (the plane's width) should end up pointing.
        const angle = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
        this.mesh.position.set(point.x, point.y, this.renderDepth);
        this.mesh.rotation.z = angle;
        this.mesh.scale.x = this.halfWidthAt(this.t) * 2;
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
