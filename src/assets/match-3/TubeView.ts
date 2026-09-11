import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';

export interface TubeOptions {
    scene: THREE.Scene;
    centerX?: number;
    /** Top of the narrow neck — this is the "path" opening the doors guard. */
    neckTopY: number;
    /** Bottom of the wide mouth — sits just above the grid. */
    mouthBottomY: number;
    neckWidth: number;
    mouthWidth: number;
    /** Fraction of total tube height that is the straight neck at the TOP. */
    neckHeightFraction?: number;
    /** Segments used to approximate the curved shoulder — more = smoother bottle silhouette. */
    shoulderSegments?: number;
    wallThickness?: number;
    color?: number;
    renderDepth?: number;
}

/**
 * An upright glass-bottle shape: a narrow neck at the top (the exit path),
 * widening through a curved shoulder into a wide mouth at the bottom that
 * sits above the grid and holds the spawned spheres. Wall geometry and
 * collision segments are built from the same polyline, so what's drawn is
 * exactly what spheres bounce off.
 */
export class TubeView {
    readonly colliders: SegmentCollider[];
    private walls: THREE.Mesh[] = [];
    private scene: THREE.Scene;

    constructor(options: TubeOptions) {
        this.scene = options.scene;
        const centerX = options.centerX ?? 0;
        const neckHeightFraction = options.neckHeightFraction ?? 0.25;
        const shoulderSegments = options.shoulderSegments ?? 6;
        const thickness = options.wallThickness ?? 0.05;
        const depth = options.renderDepth ?? 0.4;
        const color = options.color ?? 0x335577;

        const rightProfile = this.buildHalfWidthProfile(
            options.neckTopY, options.mouthBottomY,
            options.neckWidth / 2, options.mouthWidth / 2,
            neckHeightFraction, shoulderSegments
        ).map(p => new THREE.Vector2(centerX + p.x, p.y));

        const leftProfile = rightProfile.map(p => new THREE.Vector2(2 * centerX - p.x, p.y));

        this.colliders = [
            ...this.buildSegmentChain(rightProfile),
            ...this.buildSegmentChain(leftProfile),
        ];

        const rightMaterial = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const leftMaterial = rightMaterial.clone();
        this.walls.push(this.buildWallMesh(rightProfile, thickness, depth, rightMaterial));
        this.walls.push(this.buildWallMesh(leftProfile, thickness, depth, leftMaterial));
        this.walls.forEach(wall => this.scene.add(wall));
    }

    dispose(): void {
        for (const wall of this.walls) {
            this.scene.remove(wall);
            wall.geometry.dispose();
            (wall.material as THREE.Material).dispose();
        }
    }

    /** Half-width (x) at each height (y), from the neck's top down to the mouth's bottom, in local offsets from center. */
    private buildHalfWidthProfile(
        neckTopY: number, mouthBottomY: number,
        neckHalfWidth: number, mouthHalfWidth: number,
        neckHeightFraction: number, shoulderSegments: number
    ): THREE.Vector2[] {
        const totalHeight = neckTopY - mouthBottomY;
        const neckHeight = totalHeight * neckHeightFraction;
        const shoulderHeight = totalHeight - neckHeight;
        const shoulderTopY = neckTopY - neckHeight; // bottom of the straight neck / top of the shoulder curve

        const points: THREE.Vector2[] = [
            new THREE.Vector2(neckHalfWidth, neckTopY),     // very top of the neck
            new THREE.Vector2(neckHalfWidth, shoulderTopY), // bottom of the straight neck
        ];

        for (let i = 1; i <= shoulderSegments; i++) {
            const t = i / shoulderSegments;
            const eased = t * t * (3 - 2 * t); // smoothstep
            const y = shoulderTopY - shoulderHeight * t;
            const halfWidth = THREE.MathUtils.lerp(neckHalfWidth, mouthHalfWidth, eased);
            points.push(new THREE.Vector2(halfWidth, y));
        }
        return points; // last point lands exactly at (mouthHalfWidth, mouthBottomY)
    }

    private buildSegmentChain(points: THREE.Vector2[]): SegmentCollider[] {
        const segments: SegmentCollider[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            segments.push(new SegmentCollider(points[i].clone(), points[i + 1].clone()));
        }
        return segments;
    }

    private buildWallMesh(points: THREE.Vector2[], thickness: number, depth: number, material: THREE.Material): THREE.Mesh {
        const outer: THREE.Vector2[] = [];
        const inner: THREE.Vector2[] = [];

        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(i - 1, 0)];
            const next = points[Math.min(i + 1, points.length - 1)];
            const tangent = next.clone().sub(prev).normalize();
            const normal = new THREE.Vector2(-tangent.y, tangent.x);
            outer.push(points[i].clone().addScaledVector(normal, thickness / 2));
            inner.push(points[i].clone().addScaledVector(normal, -thickness / 2));
        }

        const shape = new THREE.Shape();
        shape.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
        for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].y);
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        geometry.translate(0, 0, -depth / 2);
        return new THREE.Mesh(geometry, material);
    }
}