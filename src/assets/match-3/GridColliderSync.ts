import * as THREE from 'three';
import { GridModel } from './GridModel';
import { ThreeGridView } from './ThreeGridView';
import { SquareCollider } from './physics/colliders/SquareCollider';

export function buildGridColliders(model: GridModel, view: ThreeGridView): SquareCollider[] {
    const colliders: SquareCollider[] = [];

    // Sized to the full cell pitch (cell + visual gap), not just the visible tile, plus a small
    // extra overlap — so neighboring cells' colliders touch or slightly overlap instead of leaving
    // a gap matching the visual one. A physical gap that size is far too narrow for a marble to
    // actually pass through, but it's exactly wide enough to form a V-notch where two tile corners
    // meet: a sphere settling into that crevice gets pinned by both sides' contact normals at once
    // and can't resolve out in either direction — reads as a marble stuck fused into the grid. The
    // visual gap is untouched since it only ever came from ThreeGridView's own rendering.
    const halfSize = (view.getCellSize() + view.getGap()) / 2 + 0.01;

    for (let r = 0; r < model.rows; r++) {
        for (let c = 0; c < model.cols; c++) {
            if (model.getCell(r, c) === -1) continue;
            const center = view.getCellCenter2D(r, c);
            colliders.push(new SquareCollider(center, new THREE.Vector2(halfSize, halfSize), `${r},${c}`));
        }
    }
    return colliders;
}