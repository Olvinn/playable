import * as THREE from 'three';
import { NeckPath } from './NeckPath';

export interface TubeBackdropOptions {
    scene: THREE.Scene;
    path: NeckPath;
    halfWidthAt: (t: number) => number;
    segments?: number;
    color?: number;
    opacity?: number;
    renderDepth?: number;
}

export class TubeBackdrop {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh;

    constructor(options: TubeBackdropOptions) {
        this.scene = options.scene;
        const segments = options.segments ?? 24;
        const depth = options.renderDepth ?? -0.3;
        const color = options.color ?? 0x000000;
        const opacity = options.opacity ?? 0.45;

        const left: THREE.Vector2[] = [];
        const right: THREE.Vector2[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = options.path.getPoint(t);
            const tangent = options.path.getTangent(t);
            const normal = new THREE.Vector2(-tangent.y, tangent.x);
            const halfWidth = options.halfWidthAt(t);
            left.push(point.clone().addScaledVector(normal, halfWidth));
            right.push(point.clone().addScaledVector(normal, -halfWidth));
        }

        const shape = new THREE.Shape();
        shape.moveTo(left[0].x, left[0].y);
        for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y);
        for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.z = depth;
        this.scene.add(this.mesh);
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
