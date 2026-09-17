import * as THREE from 'three';
import { PhysicsBox } from './physics/PhysicsBox';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { NeckPath } from './NeckPath';

export interface PlatformCharacterOptions {
    scene: THREE.Scene;
    world: PhysicsWorld;
    position: THREE.Vector2;
    initialTangent?: THREE.Vector2;
    platformHalfWidth: number;
    platformHalfThickness: number;
    characterSize: number;
    characterModel: THREE.Object3D;
    mass?: number;
    restitution?: number;
    pushAcceleration?: number;
    arrivalT?: number;
    onArrive?: () => void;
    platformColor?: number;
    renderDepth?: number;
}

export class PlatformCharacter {
    readonly box: PhysicsBox;
    private characterBox: PhysicsBox;
    private characterOffset: number;
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private group: THREE.Group;
    private platformMesh: THREE.Mesh;
    private characterMesh: THREE.Object3D;
    private pushAcceleration: number;
    private arrivalT: number;
    private onArrive: (() => void) | undefined;
    private hasArrived = false;
    private static readonly MAX_ANGULAR_SPEED = 3;
    private static readonly ANGULAR_GAIN = 5;
    private static readonly MAX_SPEED = 0.6;
    private static readonly MAX_CHARACTER_CORRECTION_SPEED = 1;

    constructor(options: PlatformCharacterOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.pushAcceleration = options.pushAcceleration ?? 0;
        this.arrivalT = options.arrivalT ?? 1;
        this.onArrive = options.onArrive;

        const initialTangent = options.initialTangent ?? new THREE.Vector2(1, 0);
        const initialNormal = new THREE.Vector2(-initialTangent.y, initialTangent.x);
        const initialAngle = Math.atan2(initialNormal.y, initialNormal.x);
        const initialCharacterDirection = new THREE.Vector2(-Math.sin(initialAngle), Math.cos(initialAngle));

        this.box = new PhysicsBox({
            position: options.position,
            halfExtents: new THREE.Vector2(options.platformHalfWidth, options.platformHalfThickness),
            rotation: initialAngle,
            mass: options.mass ?? 8,
            restitution: options.restitution ?? 0.05,
        });
        this.world.addBox(this.box);

        this.characterOffset = options.platformHalfThickness + options.characterSize / 2;
        this.characterBox = new PhysicsBox({
            position: options.position.clone().addScaledVector(initialCharacterDirection, this.characterOffset),
            halfExtents: new THREE.Vector2(options.characterSize / 2, options.characterSize / 2),
            mass: 15,
            restitution: options.restitution ?? 0.05,
        });
        this.world.addBox(this.characterBox);

        const depth = options.renderDepth ?? 0.5;

        const platformGeometry = new THREE.BoxGeometry(options.platformHalfWidth * 2, options.platformHalfThickness * 2, depth);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: options.platformColor ?? 0x8899aa });
        this.platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);

        this.characterMesh = options.characterModel;
        this.characterMesh.position.y += options.platformHalfThickness;

        this.group = new THREE.Group();
        this.group.add(this.platformMesh, this.characterMesh);
        this.scene.add(this.group);

        this.sync();
    }

    pushTowardDoor(path: NeckPath, _deltaSeconds: number): void {
        if (this.hasArrived) return;

        const t = path.findClosestT(this.box.collider.center);

        if (t >= this.arrivalT) {
            this.hasArrived = true;
            this.box.freeze();
            this.characterBox.freeze();
            this.onArrive?.();
            return;
        }

        const tangent = path.getTangent(t);

        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        const targetAngle = Math.atan2(normal.y, normal.x);

        if (this.pushAcceleration > 0) {
            this.box.applyAcceleration(tangent.clone().multiplyScalar(this.pushAcceleration));

            let angleError = targetAngle - this.box.collider.rotation;
            angleError = Math.atan2(Math.sin(angleError), Math.cos(angleError));
            const angularVelocity = THREE.MathUtils.clamp(
                angleError * PlatformCharacter.ANGULAR_GAIN,
                -PlatformCharacter.MAX_ANGULAR_SPEED,
                PlatformCharacter.MAX_ANGULAR_SPEED
            );
            this.box.setAngularVelocity(angularVelocity);
        }

        const rotation = this.box.collider.rotation;
        const characterDirection = new THREE.Vector2(-Math.sin(rotation), Math.cos(rotation));
        const idealPosition = this.box.collider.center.clone().addScaledVector(characterDirection, this.characterOffset);
        const positionError = idealPosition.sub(this.characterBox.collider.center);
        if (positionError.length() > PlatformCharacter.MAX_CHARACTER_CORRECTION_SPEED) {
            positionError.setLength(PlatformCharacter.MAX_CHARACTER_CORRECTION_SPEED);
        }
        this.characterBox.setVelocity(this.box.collider.velocity.clone().add(positionError));
    }

    sync(): void {
        this.group.position.set(this.box.collider.center.x, this.box.collider.center.y, 0);
        this.group.rotation.z = this.box.collider.rotation;
    }

    clampSpeed(): void {
        if (this.box.collider.velocity.length() > PlatformCharacter.MAX_SPEED) {
            this.box.setVelocity(this.box.collider.velocity.clone().setLength(PlatformCharacter.MAX_SPEED));
        }
    }

    dispose(): void {
        this.world.removeBox(this.box);
        this.world.removeBox(this.characterBox);
        this.scene.remove(this.group);
        this.platformMesh.geometry.dispose();
        (this.platformMesh.material as THREE.Material).dispose();
        this.characterMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });
    }
}
