import * as THREE from 'three';
import { CellCoord, type CellValue } from './GridModel';
import type { IGridView } from './IGridView';
import { GridBox } from './GridBox';
import { PhysicsWorld } from './physics/PhysicsWorld';

export interface ThreeGridViewOptions {
    rows: number;
    cols: number;
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    cellSize: number;
    gap: number;
    boxGeometry: THREE.BufferGeometry;
    physicsWorld: PhysicsWorld;
    centerX?: number;
    colors?: number[];
    highlightColor?: number;
    depthRatio?: number;
    swapDurationMs?: number;
    matchDurationMs?: number;
    collapseDurationMs?: number;
}

export class ThreeGridView implements IGridView {
    private rows: number;
    private cols: number;
    private cellSize: number;
    private gap: number;
    private boxGeometry: THREE.BufferGeometry;
    private physicsWorld: PhysicsWorld;
    private centerX: number;
    private colors: number[];
    private highlightColor: number;
    private depthRatio: number;
    private swapDurationMs: number;
    private matchDurationMs: number;
    private collapseDurationMs: number;

    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();

    private boxes: (GridBox | null)[][] = [];
    private highlighted: GridBox | null = null;
    private pointerDownCb: ((cell: CellCoord) => void) | null = null;
    private pointerUpCb: ((cell: CellCoord) => void) | null = null;

    constructor(options: ThreeGridViewOptions) {
        this.rows = options.rows;
        this.cols = options.cols;
        this.cellSize = options.cellSize;
        this.gap = options.gap;
        this.boxGeometry = options.boxGeometry;
        this.physicsWorld = options.physicsWorld;
        this.centerX = options.centerX ?? 0;
        this.scene = options.scene;
        this.camera = options.camera;
        this.renderer = options.renderer;
        this.colors = options.colors ?? [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55, 0xcc66ff];
        this.highlightColor = options.highlightColor ?? 0xffffff;
        this.depthRatio = options.depthRatio ?? 0.3;
        this.swapDurationMs = options.swapDurationMs ?? 180;
        this.matchDurationMs = options.matchDurationMs ?? 200;
        this.collapseDurationMs = options.collapseDurationMs ?? 220;

        this.setupInput();
    }

    renderInitial(grid: CellValue[][]): void {
        const colliderHalfSize = (this.cellSize + this.gap) / 2 + 0.01;
        for (let r = 0; r < this.rows; r++) {
            this.boxes.push([]);
            for (let c = 0; c < this.cols; c++) {
                const box = new GridBox(grid[r][c], {
                    size: this.cellSize,
                    colors: this.colors,
                    geometry: this.boxGeometry,
                    physicsWorld: this.physicsWorld,
                    colliderHalfSize,
                    highlightColor: this.highlightColor,
                    depthRatio: this.depthRatio,
                });
                box.spawn(this.scene, this.cellWorldPos(r, c));
                this.boxes[r].push(box);
            }
        }
    }

    onCellPointerDown(cb: (cell: CellCoord) => void): void { this.pointerDownCb = cb; }
    onCellPointerUp(cb: (cell: CellCoord) => void): void { this.pointerUpCb = cb; }

    highlightCell(cell: CellCoord): void {
        this.highlighted?.setHighlighted(false);
        this.highlighted = this.boxes[cell.row][cell.col];
        this.highlighted?.setHighlighted(true);
    }

    clearHighlight(): void {
        this.highlighted?.setHighlighted(false);
        this.highlighted = null;
    }

    async animateSwap(a: CellCoord, b: CellCoord): Promise<void> {
        const boxA = this.boxes[a.row][a.col]!;
        const boxB = this.boxes[b.row][b.col]!;
        await Promise.all([
            this.lerpPosition(boxA, this.cellWorldPos(b.row, b.col), this.swapDurationMs),
            this.lerpPosition(boxB, this.cellWorldPos(a.row, a.col), this.swapDurationMs),
        ]);
        this.boxes[a.row][a.col] = boxB;
        this.boxes[b.row][b.col] = boxA;
    }

    async animateInvalidSwap(a: CellCoord, b: CellCoord): Promise<void> {
        await this.animateSwap(a, b);
        await this.animateSwap(a, b);
    }

    async animateMatched(cells: CellCoord[]): Promise<void> {
        await Promise.all(cells.map(({ row, col }) => {
            const box = this.boxes[row][col];
            if (!box) return Promise.resolve();
            this.boxes[row][col] = null;

            const start = performance.now();
            return new Promise<void>((resolve) => {
                const step = (now: number) => {
                    const t = Math.min((now - start) / this.matchDurationMs, 1);
                    box.setScale(1 - t);
                    if (t < 1) requestAnimationFrame(step);
                    else { box.destroy(this.scene); resolve(); }
                };
                requestAnimationFrame(step);
            });
        }));
    }

    async animateCollapse(moves: { from: CellCoord; to: CellCoord }[]): Promise<void> {
        const animations = moves.map(({ from, to }) => {
            const box = this.boxes[from.row][from.col]!;
            this.boxes[from.row][from.col] = null;
            this.boxes[to.row][to.col] = box;
            return this.lerpPosition(box, this.cellWorldPos(to.row, to.col), this.collapseDurationMs);
        });
        await Promise.all(animations);
    }

    dispose(): void {
        for (const row of this.boxes) {
            for (const box of row) box?.destroy(this.scene);
        }
    }

    getCellSize(): number {
        return this.cellSize;
    }

    getGap(): number {
        return this.gap;
    }

    getCellCenter2D(row: number, col: number): THREE.Vector2 {
        const pos = this.cellWorldPos(row, col);
        return new THREE.Vector2(pos.x, pos.y);
    }

    private cellWorldPos(row: number, col: number): THREE.Vector3 {
        const step = this.cellSize + this.gap;
        const totalWidth = (this.cols - 1) * step;
        const x = col * step - totalWidth / 2 + this.centerX;
        const y = (this.rows - 1 - row) * step;
        return new THREE.Vector3(x, y, 0);
    }

    private lerpPosition(box: GridBox, to: THREE.Vector3, durationMs: number): Promise<void> {
        const from = box.mesh.position.clone();
        const start = performance.now();
        return new Promise((resolve) => {
            const step = (now: number) => {
                const t = Math.min((now - start) / durationMs, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                box.moveTo(from.clone().lerp(to, eased));
                if (t < 1) requestAnimationFrame(step); else resolve();
            };
            requestAnimationFrame(step);
        });
    }

    private setupInput(): void {
        const dom = this.renderer.domElement;

        const getCellAtPointer = (event: PointerEvent): CellCoord | null => {
            const rect = dom.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const targets = this.boxes.flat().filter((b): b is GridBox => b !== null).map(b => b.mesh);
            const hit = this.raycaster.intersectObjects(targets)[0]?.object as THREE.Mesh | undefined;
            if (!hit) return null;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.boxes[r][c]?.mesh === hit) {
                        this.boxes[r][c]!.handleClick();
                        return new CellCoord(r, c);
                    }
                }
            }
            return null;
        };

        dom.addEventListener('pointerdown', (e) => {
            const cell = getCellAtPointer(e);
            if (cell) this.pointerDownCb?.(cell);
        });
        dom.addEventListener('pointerup', (e) => {
            const cell = getCellAtPointer(e);
            if (cell) this.pointerUpCb?.(cell);
        });
    }
}