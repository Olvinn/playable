import * as THREE from 'three';
import { PhysicsSphere } from './PhysicsSphere';
import { PhysicsBox } from './PhysicsBox';
import { SquareCollider } from './colliders/SquareCollider.ts';
import { LineCollider } from './colliders/LineCollider.ts';
import { SegmentCollider } from './colliders/SegmentCollider.ts';
import { PusherCollider } from './colliders/PusherCollider.ts';
import { SpatialGrid } from './SpatialGrid';

export interface CollisionResolverOptions {
    cellSize: number;
}

export class CollisionResolver {
    private sphereGrid: SpatialGrid<PhysicsSphere>;
    private boxGrid: SpatialGrid<SquareCollider>;
    private planes: LineCollider[] = [];
    private segments: SegmentCollider[] = [];
    private pushers: PusherCollider[] = [];

    private readonly closestPointScratch = new THREE.Vector2();
    private readonly segmentClosestScratch = new THREE.Vector2();
    private readonly pusherClosestScratch = new THREE.Vector2();
    private readonly deltaScratch = new THREE.Vector2();

    constructor(options: CollisionResolverOptions) {
        this.sphereGrid = new SpatialGrid<PhysicsSphere>({ cellSize: options.cellSize });
        this.boxGrid = new SpatialGrid<SquareCollider>({ cellSize: options.cellSize });
    }

    setPlanes(planes: LineCollider[]): void {
        this.planes = planes;
    }

    /** Bounded wall segments (e.g. the tube's curved walls, the doors). Small, fixed count — resolved by brute force, no spatial bucketing needed. */
    setSegments(segments: SegmentCollider[]): void {
        this.segments = segments;
    }

    /** Moving paddle colliders (e.g. MarblePusher while extending). Pass [] when nothing should currently push. */
    setPushers(pushers: PusherCollider[]): void {
        this.pushers = pushers;
    }

    /** Call whenever the match-3 grid's occupied cells change (after a collapse settles). */
    setBoxColliders(boxes: SquareCollider[]): void {
        this.boxGrid.clear();
        for (const box of boxes) {
            this.boxGrid.insert(box.center.x, box.center.y, box);
        }
    }

    resolve(spheres: PhysicsSphere[], boxes: PhysicsBox[] = []): void {
        this.sphereGrid.clear();
        for (const sphere of spheres) {
            this.sphereGrid.insert(sphere.collider.center.x, sphere.collider.center.y, sphere);
        }

        for (const sphere of spheres) {
            this.resolveAgainstPlanes(sphere);
            this.resolveAgainstSegments(sphere);
            this.resolveAgainstGridBoxes(sphere);
            this.resolveAgainstPushers(sphere);
            this.resolveAgainstNeighborSpheres(sphere);
        }

        for (const box of boxes) {
            this.resolveDynamicBoxAgainstPlanes(box);
            this.resolveDynamicBoxAgainstSegments(box);
            this.resolveDynamicBoxAgainstSpheres(box);
        }
    }

    private resolveAgainstPlanes(sphere: PhysicsSphere): void {
        for (const plane of this.planes) {
            const distance = plane.signedDistanceTo(sphere.collider.center);
            const penetration = sphere.collider.radius - distance;
            if (penetration <= 0) continue;

            sphere.collider.center.addScaledVector(plane.normal, penetration);
            this.reflectVelocity(sphere, plane.normal);
        }
    }

    private resolveAgainstSegments(sphere: PhysicsSphere): void {
        for (const segment of this.segments) {
            const closest = segment.closestPointTo(sphere.collider.center, this.segmentClosestScratch);
            const delta = this.deltaScratch.subVectors(sphere.collider.center, closest);
            const distanceSq = delta.lengthSq();
            const radius = sphere.collider.radius;
            if (distanceSq >= radius * radius) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = distance > 1e-6
                ? delta.multiplyScalar(1 / distance)
                : new THREE.Vector2(0, 1);

            const penetration = radius - distance;
            sphere.collider.center.addScaledVector(normal, penetration);
            this.reflectVelocity(sphere, normal);
        }
    }

    private resolveAgainstGridBoxes(sphere: PhysicsSphere): void {
        const candidates = this.boxGrid.queryNeighbors(sphere.collider.center.x, sphere.collider.center.y);

        for (const box of candidates) {
            const closest = box.closestPointTo(sphere.collider.center, this.closestPointScratch);
            const delta = this.deltaScratch.subVectors(sphere.collider.center, closest);
            const distanceSq = delta.lengthSq();
            const radius = sphere.collider.radius;
            if (distanceSq >= radius * radius) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = distance > 1e-6
                ? delta.multiplyScalar(1 / distance)
                : new THREE.Vector2(0, 1);

            const penetration = radius - distance;
            sphere.collider.center.addScaledVector(normal, penetration);
            this.reflectVelocity(sphere, normal);
        }
    }

    private resolveAgainstPushers(sphere: PhysicsSphere): void {
        for (const pusher of this.pushers) {
            const closest = pusher.closestPointTo(sphere.collider.center, this.pusherClosestScratch);
            const delta = this.deltaScratch.subVectors(sphere.collider.center, closest);
            const distanceSq = delta.lengthSq();
            const radius = sphere.collider.radius;
            if (distanceSq >= radius * radius) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = distance > 1e-6
                ? delta.multiplyScalar(1 / distance)
                : new THREE.Vector2(0, 1);

            const penetration = radius - distance;
            sphere.collider.center.addScaledVector(normal, penetration);
            this.reflectVelocity(sphere, normal);
            sphere.velocity.add(pusher.velocity); // the pusher physically carries the sphere along with it
        }
    }

    private resolveAgainstNeighborSpheres(sphere: PhysicsSphere): void {
        const candidates = this.sphereGrid.queryNeighbors(sphere.collider.center.x, sphere.collider.center.y);

        for (const other of candidates) {
            if (other.id <= sphere.id) continue;

            const delta = this.deltaScratch.subVectors(sphere.collider.center, other.collider.center);
            const distanceSq = delta.lengthSq();
            const combinedRadius = sphere.collider.radius + other.collider.radius;
            if (distanceSq >= combinedRadius * combinedRadius || distanceSq < 1e-9) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = delta.multiplyScalar(1 / distance);
            const penetration = combinedRadius - distance;

            const totalMass = sphere.mass + other.mass;
            const sphereShare = other.mass / totalMass;
            const otherShare = sphere.mass / totalMass;

            sphere.collider.center.addScaledVector(normal, penetration * sphereShare);
            other.collider.center.addScaledVector(normal, -penetration * otherShare);

            this.reflectVelocity(sphere, normal);
            this.reflectVelocity(other, normal.clone().negate());
        }
    }

    /** Box vs walls/planes use a bounding-circle radius — a deliberate simplification, fine for a platform sliding along an axis-aligned tube. */
    private resolveDynamicBoxAgainstPlanes(box: PhysicsBox): void {
        const radius = this.boundingRadius(box);
        for (const plane of this.planes) {
            const distance = plane.signedDistanceTo(box.collider.center);
            const penetration = radius - distance;
            if (penetration <= 0) continue;

            box.collider.center.addScaledVector(plane.normal, penetration);
            this.reflectVelocity(box, plane.normal);
        }
    }

    private resolveDynamicBoxAgainstSegments(box: PhysicsBox): void {
        const radius = this.boundingRadius(box);
        for (const segment of this.segments) {
            const closest = segment.closestPointTo(box.collider.center, this.segmentClosestScratch);
            const delta = this.deltaScratch.subVectors(box.collider.center, closest);
            const distanceSq = delta.lengthSq();
            if (distanceSq >= radius * radius) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = distance > 1e-6
                ? delta.multiplyScalar(1 / distance)
                : new THREE.Vector2(0, 1);

            const penetration = radius - distance;
            box.collider.center.addScaledVector(normal, penetration);
            this.reflectVelocity(box, normal);
        }
    }

    /** Exact AABB-vs-circle contact, bidirectional — this is what lets the box rest on top of the marble pile and sink as it drains. */
    private resolveDynamicBoxAgainstSpheres(box: PhysicsBox): void {
        const candidates = this.sphereGrid.queryNeighbors(box.collider.center.x, box.collider.center.y);

        for (const sphere of candidates) {
            const closest = box.collider.closestPointTo(sphere.collider.center, this.closestPointScratch);
            const delta = this.deltaScratch.subVectors(sphere.collider.center, closest);
            const distanceSq = delta.lengthSq();
            const radius = sphere.collider.radius;
            if (distanceSq >= radius * radius) continue;

            const distance = Math.sqrt(distanceSq);
            const normal = distance > 1e-6
                ? delta.multiplyScalar(1 / distance)
                : new THREE.Vector2(0, 1);

            const penetration = radius - distance;
            const totalMass = box.mass + sphere.mass;
            const boxShare = sphere.mass / totalMass;
            const sphereShare = box.mass / totalMass;

            box.collider.center.addScaledVector(normal, -penetration * boxShare);
            sphere.collider.center.addScaledVector(normal, penetration * sphereShare);

            this.reflectVelocity(box, normal.clone().negate());
            this.reflectVelocity(sphere, normal);
        }
    }

    private boundingRadius(box: PhysicsBox): number {
        return Math.hypot(box.collider.halfExtents.x, box.collider.halfExtents.y);
    }

    private reflectVelocity(body: { velocity: THREE.Vector2; restitution: number }, normal: THREE.Vector2): void {
        const speedAlongNormal = body.velocity.dot(normal);
        if (speedAlongNormal >= 0) return;

        body.velocity.addScaledVector(normal, -speedAlongNormal * (1 + body.restitution));
    }
}