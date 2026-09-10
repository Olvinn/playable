import * as THREE from 'three';
import { GridModel } from './GridModel';
import { ThreeGridView } from './ThreeGridView';
import { SquareCollider } from './physics/colliders/SquareCollider';

export function buildGridColliders(model: GridModel, view: ThreeGridView): SquareCollider[] {
    const colliders: SquareCollider[] = [];
    const halfSize = view.getCellSize() / 2;

    for (let r = 0; r < model.rows; r++) {
        for (let c = 0; c < model.cols; c++) {
            if (model.getCell(r, c) === -1) continue;
            const center = view.getCellCenter2D(r, c);
            colliders.push(new SquareCollider(center, new THREE.Vector2(halfSize, halfSize), `${r},${c}`));
        }
    }
    return colliders;
}