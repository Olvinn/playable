import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';
import { NeckPath } from './NeckPath';

export interface TubeViewOptions {
    scene: THREE.Scene;
    /** Curve running from the narrow top entrance (t=0) to the wide bottom mouth (t=1). */
    path: NeckPath;
    /** Half-width of the tube at each arc-length fraction — see NeckProfile.ts. */
    halfWidthAt: (t: number) => number;
    /** Number of straight segments used to approximate the curve — higher is smoother. */
    segments?: number;
    wallThickness?: number;
    color?: number;
    renderDepth?: number;
    /** Same ground texture used for the outer background, so the tube reads as carved from it. */
    textureUrl?: string;
    /** World units spanned by a single texture tile — matches GroundPlane's tiling scale. */
    tileWorldSize?: number;
}

/**
 * A tube whose walls follow an arbitrary curved path and whose half-width
 * varies along it (see NeckProfile). This is what lets the neck curve
 * while staying filled end-to-end with spheres, and it's what unifies the
 * old separate "neck" and "mouth" shapes into one continuous tube.
 *
 * Wall geometry and collision segments are built from the same offset
 * paths, so what's drawn is exactly what spheres bounce off.
 */
export class TubeView {
    readonly leftColliders: SegmentCollider[];
    readonly rightColliders: SegmentCollider[];
    private walls: THREE.Mesh[] = [];
    private scene: THREE.Scene;

    constructor(options: TubeViewOptions) {
        this.scene = options.scene;
        const segments = options.segments ?? 24;
        const thickness = options.wallThickness ?? 0.05;
        const depth = options.renderDepth ?? 0.4;
        const color = options.color ?? 0x335577;

        const { left, right } = this.buildOffsetPaths(options.path, options.halfWidthAt, segments, thickness);

        this.leftColliders = this.buildSegmentChain(left);
        this.rightColliders = this.buildSegmentChain(right);

        const leftMaterial = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const rightMaterial = leftMaterial.clone();
        const leftMesh = this.buildWallMesh(left, thickness, depth, leftMaterial);
        const rightMesh = this.buildWallMesh(right, thickness, depth, rightMaterial);
        this.walls.push(leftMesh, rightMesh);
        this.walls.forEach(wall => this.scene.add(wall));

        if (options.textureUrl) {
            const tileWorldSize = options.tileWorldSize ?? 2;
            const loader = new THREE.TextureLoader();
            for (const mesh of [leftMesh, rightMesh]) {
                const material = mesh.material as THREE.MeshStandardMaterial;
                mesh.geometry.computeBoundingBox();
                const box = mesh.geometry.boundingBox!;
                const repeatX = Math.max(1, (box.max.x - box.min.x) / tileWorldSize);
                const repeatY = Math.max(1, (box.max.y - box.min.y) / tileWorldSize);

                const map = loader.load(options.textureUrl);
                map.colorSpace = THREE.SRGBColorSpace;
                map.wrapS = THREE.RepeatWrapping;
                map.wrapT = THREE.RepeatWrapping;
                map.repeat.set(repeatX, repeatY);

                material.map = map;
                // Darkens the shared ground texture below the outer background's brightness — the
                // tube reads as the same rock, just in its own shadow — while staying lighter than
                // TubeBackdrop's near-black fill so the wall itself doesn't disappear into "inside".
                material.color.setHex(0x8c8c8c);
                material.opacity = 0.92;
                material.needsUpdate = true;
            }
        }
    }

    get colliders(): SegmentCollider[] {
        return [...this.leftColliders, ...this.rightColliders];
    }

    dispose(): void {
        for (const wall of this.walls) {
            this.scene.remove(wall);
            wall.geometry.dispose();
            (wall.material as THREE.Material).dispose();
        }
    }

    private buildOffsetPaths(
        path: NeckPath, halfWidthAt: (t: number) => number, segments: number, thickness: number
    ): { left: THREE.Vector2[]; right: THREE.Vector2[] } {
        const left: THREE.Vector2[] = [];
        const right: THREE.Vector2[] = [];

        // The wall itself extends thickness/2 further inward from this centerline (see
        // buildWallMesh, and the physics wall bodies built from these same points) — so placing
        // the centerline exactly at halfWidthAt(t) would leave the wall's actual inner face
        // thickness/2 *inside* the width everything else (SphereSpawner, the neck profile) treats
        // as the clear passable boundary. Marbles can legitimately be packed right up to that
        // boundary, so without this correction they'd spawn already overlapping the wall's physical
        // thickness — a standing overlap the solver has to keep fighting, which is exactly the kind
        // of localized, hard-to-diagnose jam this was causing. Pushing the centerline outward by
        // thickness/2 puts the wall's real inner face exactly at halfWidthAt(t), matching what
        // every consumer of that function already assumes.
        const halfThickness = thickness / 2;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = path.getPoint(t);
            const tangent = path.getTangent(t);
            const normal = new THREE.Vector2(-tangent.y, tangent.x);
            const halfWidth = halfWidthAt(t) + halfThickness;

            left.push(point.clone().addScaledVector(normal, halfWidth));
            right.push(point.clone().addScaledVector(normal, -halfWidth));
        }
        return { left, right };
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