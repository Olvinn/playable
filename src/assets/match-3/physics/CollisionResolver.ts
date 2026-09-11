import * as THREE from 'three';
import { PhysicsSphere } from './PhysicsSphere';
import { SquareCollider } from './colliders/SquareCollider.ts';
import { LineCollider } from './colliders/LineCollider.ts';
import { SegmentCollider } from './colliders/SegmentCollider.ts';
import { SpatialGrid } from './SpatialGrid';

export interface CollisionResolverOptions {
    cellSize: number;
}

export class CollisionResolver {
    private sphereGrid: SpatialGrid<PhysicsSphere>;
    private boxGrid: SpatialGrid<SquareCollider>;
    private planes: LineCollider[] = [];
    private segments: SegmentCollider[] = [];

    private readonly closestPointScratch = new THREE.Vector2();
    private readonly segmentClosestScratch = new THREE.Vector2();
    private readonly deltaScratch = new THREE.Vector2();

    constructor(options: CollisionResolverOptions) {
        this.sphereGrid = new SpatialGrid<PhysicsSphere>({ cellSize: options.cellSize });
        this.boxGrid = new SpatialGrid<SquareCollider>({ cellSize: options.cellSize });
    }

    setPlanes(planes: LineCollider[]): void {
        this.planes = planes;
    }

    /** Bounded wall segments (e.g. the tube's bottle-shaped walls). Small, fixed count — resolved by brute force, no spatial bucketing needed. */
    setSegments(segments: SegmentCollider[]): void {
        this.segments = segments;
    }

    /** Call whenever the match-3 grid's occupied cells change (after a collapse settles). */
    setBoxColliders(boxes: SquareCollider[]): void {
        this.boxGrid.clear();
        for (const box of boxes) {
            this.boxGrid.insert(box.center.x, box.center.y, box);
        }
    }

    resolve(spheres: PhysicsSphere[]): void {
        this.sphereGrid.clear();
        for (const sphere of spheres) {
            this.sphereGrid.insert(sphere.collider.center.x, sphere.collider.center.y, sphere);
        }

        for (const sphere of spheres) {
            this.resolveAgainstPlanes(sphere);
            this.resolveAgainstSegments(sphere);
            this.resolveAgainstBoxes(sphere);
            this.resolveAgainstNeighborSpheres(sphere);
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

    private resolveAgainstBoxes(sphere: PhysicsSphere): void {
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

    private reflectVelocity(sphere: PhysicsSphere, normal: THREE.Vector2): void {
        const speedAlongNormal = sphere.velocity.dot(normal);
        if (speedAlongNormal >= 0) return;

        sphere.velocity.addScaledVector(normal, -speedAlongNormal * (1 + sphere.restitution));
    }
}