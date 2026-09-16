import * as THREE from 'three';
import { SegmentCollider } from './physics/colliders/SegmentCollider';
import { NeckPath } from './NeckPath';

export interface TubeViewOptions {
    scene: THREE.Scene;
    path: NeckPath;
    halfWidthAt: (t: number) => number;
    segments?: number;
    wallThickness?: number;
    color?: number;
    renderDepth?: number;
    textureUrl?: string;
    tileWorldSize?: number;
}

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