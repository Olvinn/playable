import * as THREE from 'three';
import { PhysicsBox } from './physics/PhysicsBox';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { NeckPath } from './NeckPath';

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
    /**
     * World-units/second² applied along the tube's tangent every frame, standing in for how hard
     * the character can actually push with their own body weight — see pushTowardDoor(). Expressed
     * as an acceleration (not a force) so it's independent of whatever mass value the platform
     * ends up with: applyAcceleration() converts it to `mass * this` internally, so "push with 0.4g
     * of your own weight" means the same thing whether the platform itself is light or heavy.
     */
    pushAcceleration?: number;
    platformColor?: number;
    characterColor?: number;
    renderDepth?: number;
}

/**
 * The rescue objective: a physicalized platform riding on top of the marble
 * pile, with a character box sitting rigidly on it. Both the platform and
 * the character have their own collider — a marble can't tell the
 * difference, but visually the character floats above the thin platform
 * slab, and without its own collider marbles piling up beside the platform
 * (now narrower than the tube — see main.ts) would render right through it.
 *
 * The character's collider tracks the platform by matching its velocity
 * every frame, *not* by being teleported to a computed offset position each
 * frame. Teleporting was the first approach tried and it made things worse:
 * a hard position snap can land the body deep inside marbles it wasn't
 * touching a moment ago, and Matter has to resolve that huge, sudden
 * overlap in one step — repeated every single frame, that reads as
 * violent, disruptive corrections rippling through the pile, and it
 * stalled the whole assembly solid right at the densest starting point
 * (verified: reproducibly stuck a few percent into the path, every run,
 * until switched to velocity-matching). Giving it the same velocity as the
 * platform instead lets Matter's own solver negotiate its motion smoothly
 * against whatever it's touching, the same well-behaved way the platform's
 * own drive already works — it may drift a little from the platform's
 * exact offset under resistance, which is fine for a small decorative
 * marker whose only job is "don't let anything occupy this space."
 *
 * pushTowardDoor() is what makes it actively push rather than just fall.
 * It drives the platform with a genuine, bounded force now — applyAcceleration()
 * every frame, standing in for the character pushing with their own body
 * weight — not the kinematic constant-speed drive this used to be. That
 * kinematic version reached its own intended speed every frame regardless
 * of what it was pushing against, which is exactly what read as "pushing
 * too hard": a real person can't just declare a walking speed and have it
 * happen no matter how packed the pile ahead is, their forward speed is
 * whatever their own push force can actually achieve against the
 * resistance in front of them. Driving it as a force instead means Matter's
 * own solver decides how much of that force turns into motion — on a
 * vertical stretch gravity adds to it (falling, not just walking), on a
 * horizontal one the push is genuinely all there is, and if the pile ahead
 * is packed hard enough, it can legitimately slow to a crawl the way
 * pushing something heavy in real life would, rather than plowing through
 * at a fixed speed regardless.
 *
 * (An earlier, much cruder attempt at force-based driving — before this
 * project moved to Matter.js at all — is why the kinematic version existed
 * in the first place: the hand-rolled collision solver of the time treated
 * a sustained push exactly like a ball bouncing off a wall, reflecting the
 * approach-velocity component to zero the instant there was a contact, so
 * a continuous push against a packed pile got cancelled to a permanent
 * standstill every single frame no matter how much force was behind it.
 * Matter's real sequential-impulse solver doesn't have that failure mode,
 * which is what makes going back to a genuine force now actually work.)
 *
 * The tangent (not a fixed world axis) still matters for the same reason as
 * before: on a horizontal run, "push down" points into the tube's own floor
 * wall, not toward the door.
 *
 * The physics body also rotates now, gradually, to actually track the
 * tube's local direction — not a fixed-orientation box anymore. That matters
 * for width: a box that never rotates can't go around *any* curve without a
 * corner catching the wall the instant the corridor's direction rotates away
 * from its fixed edges, however gentle the curve — which is what forced this
 * platform to stay narrower than the tube. Two earlier attempts at rotation
 * both failed for the same underlying reason (an instant, discontinuous
 * change to a body already in dense contact, which forces Matter to resolve
 * a brand-new overlap configuration in one step): letting collision torque
 * spin it freely span it thousands of radians in seconds, and snapping its
 * angle straight to the target every frame stalled it solid at the densest
 * point of the pile. setAngularVelocity(), capped, is the same fix already
 * proven for the character's own position tracking below — Matter's solver
 * negotiates a bounded, gradual rotation smoothly instead of fighting a
 * sudden one.
 */
export class PlatformCharacter {
    readonly box: PhysicsBox;
    private characterBox: PhysicsBox;
    private characterOffset: number;
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private group: THREE.Group;
    private platformMesh: THREE.Mesh;
    private characterMesh: THREE.Mesh;
    private pushAcceleration: number;
    private hasArrived = false;
    // Radians/second cap on how fast the platform's physics body can rotate to track the tube's
    // curve — bounded so a sharp turn corrects gradually instead of snapping (see the class doc).
    private static readonly MAX_ANGULAR_SPEED = 3;
    private static readonly ANGULAR_GAIN = 5;
    // Safety ceiling only — force-driven motion can otherwise accelerate indefinitely through any
    // stretch with little resistance, which would look like the platform suddenly bolting forward.
    // Real contact resistance from the pile is what normally keeps speed well under this.
    private static readonly MAX_SPEED = 1.5;
    // Bounds how fast the character marker's own position error can be corrected — independent of
    // the platform's now-variable speed (see pushTowardDoor), so the correction stays gentle even
    // when the platform itself is briefly moving fast.
    private static readonly MAX_CHARACTER_CORRECTION_SPEED = 1;

    constructor(options: PlatformCharacterOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.pushAcceleration = options.pushAcceleration ?? 0;

        this.box = new PhysicsBox({
            position: options.position,
            halfExtents: new THREE.Vector2(options.platformHalfWidth, options.platformHalfThickness),
            mass: options.mass ?? 8,
            restitution: options.restitution ?? 0.05,
        });
        this.world.addBox(this.box);

        // Matches characterMesh's local offset below — kept as one field so the physics body and
        // the visual can never drift apart.
        this.characterOffset = options.platformHalfThickness + options.characterSize / 2;
        this.characterBox = new PhysicsBox({
            position: options.position.clone().add(new THREE.Vector2(0, this.characterOffset)),
            halfExtents: new THREE.Vector2(options.characterSize / 2, options.characterSize / 2),
            // Lighter than the platform (100) but not token-light either: at mass 5 it mostly
            // yielded to marbles pressing against it rather than holding its own space, leaving a
            // visible, persistent overlap. 15 was enough for that overlap to settle to a small,
            // stable ~0.09 (comparable to the platform's own residual penetration under similar
            // load, see PhysicsBox — some give under heavy compression is inherent to the solver,
            // not something either body fully escapes).
            mass: 15,
            restitution: options.restitution ?? 0.05,
        });
        this.world.addBox(this.characterBox);

        const depth = options.renderDepth ?? 0.5;

        const platformGeometry = new THREE.BoxGeometry(options.platformHalfWidth * 2, options.platformHalfThickness * 2, depth);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: options.platformColor ?? 0x8899aa });
        this.platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);

        const characterGeometry = new THREE.BoxGeometry(options.characterSize, options.characterSize, depth);
        const characterMaterial = new THREE.MeshStandardMaterial({ color: options.characterColor ?? 0xff4477 });
        this.characterMesh = new THREE.Mesh(characterGeometry, characterMaterial);
        this.characterMesh.position.y = this.characterOffset;

        this.group = new THREE.Group();
        this.group.add(this.platformMesh, this.characterMesh);
        this.scene.add(this.group);

        this.sync();
    }

    /**
     * Accelerates the platform along the tube's own direction of travel at its current position,
     * and records the orientation angle sync() applies to the visual — both derived from the same
     * closest-point-on-path lookup so they never disagree. Call once per frame, before
     * physicsWorld.step().
     */
    pushTowardDoor(path: NeckPath, _deltaSeconds: number): void {
        if (this.hasArrived) return;

        const t = path.findClosestT(this.box.collider.center);

        // The box was only ever held up by whatever marble happened to be directly beneath it —
        // it has no collider interaction with the grid tiles or any floor at all. That's fine
        // while there's a reliable pile under it, but the pile is *supposed* to drain to nothing,
        // and the box has no support once it does. Freezing it here, the moment it reaches the
        // door, is what actually fixes that: locking the body static stops gravity from ever
        // being integrated for it again, so there's nothing left to fall through.
        if (t >= 1) {
            this.hasArrived = true;
            this.box.freeze();
            this.characterBox.freeze();
            return;
        }

        const tangent = path.getTangent(t); // points toward increasing t, i.e. toward the door at t=1

        // Target orientation: face across the tube (perpendicular to travel), the same "normal"
        // convention TubeView/SphereSpawner use for their own sideways offset. Rotating a local +Y
        // point by this angle lands at -tangent, not normal (checked directly: e.g. tangent=(1,0)
        // gives normal=(0,1), target=90°, and rotating local (0, y) by 90° lands at (-y, 0) =
        // -tangent * y) — that's why the character offset below uses the box's actual rotation
        // rather than re-deriving a direction from tangent/normal each time.
        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        const targetAngle = Math.atan2(normal.y, normal.x);

        if (this.pushAcceleration > 0) {
            // A genuine, bounded force along the tube's tangent — not a speed the box teleports
            // to. Matter's own solver decides how much of it actually becomes motion against
            // whatever's in the way; on a vertical stretch gravity (applied separately, to every
            // body, by PhysicsWorld) adds to this along the same direction, on a horizontal one
            // this push is genuinely the only forward force there is. See the class doc for why
            // this replaced a kinematic constant-speed drive.
            this.box.applyAcceleration(tangent.clone().multiplyScalar(this.pushAcceleration));

            // Safety ceiling, not the drive itself — see MAX_SPEED's own comment. Re-clamping
            // velocity after it's already been integrated is a coarser tool than the force above,
            // but it only ever engages when something would otherwise look unrealistically fast,
            // e.g. a stretch of tube with little to push against.
            if (this.box.collider.velocity.length() > PlatformCharacter.MAX_SPEED) {
                const clamped = this.box.collider.velocity.clone().setLength(PlatformCharacter.MAX_SPEED);
                this.box.setVelocity(clamped);
            }

            // Shortest signed angular distance to the target, wrapped into [-pi, pi] — without the
            // wrap, e.g. going from 179° to -179° would compute a ~358° turn instead of the actual
            // 2° one.
            let angleError = targetAngle - this.box.collider.rotation;
            angleError = Math.atan2(Math.sin(angleError), Math.cos(angleError));
            const angularVelocity = THREE.MathUtils.clamp(
                angleError * PlatformCharacter.ANGULAR_GAIN,
                -PlatformCharacter.MAX_ANGULAR_SPEED,
                PlatformCharacter.MAX_ANGULAR_SPEED
            );
            this.box.setAngularVelocity(angularVelocity);
        }

        // The character's velocity is the platform's *actual current* velocity (not a fixed drive
        // speed — the platform no longer has one, see above) plus a gentle pull back toward its
        // ideal offset. Matching velocity alone keeps it smooth but lets it drift out of position
        // under resistance and stay drifted (verified: a persistent, not just momentary, visual
        // overlap with nearby marbles resulted). Capping the correction is what keeps this from
        // becoming the same hard-snap problem a direct position teleport caused.
        //
        // The offset itself is derived from the box's *actual* current rotation (not the target
        // angle, and not tangent/normal directly) so it always matches exactly what sync() below
        // will render this frame, even while the rotation is still catching up to the target.
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

    dispose(): void {
        this.world.removeBox(this.box);
        this.world.removeBox(this.characterBox);
        this.scene.remove(this.group);
        this.platformMesh.geometry.dispose();
        (this.platformMesh.material as THREE.Material).dispose();
        this.characterMesh.geometry.dispose();
        (this.characterMesh.material as THREE.Material).dispose();
    }
}
