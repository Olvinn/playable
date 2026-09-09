import * as THREE from 'three';
import { CellCoord, type CellValue } from './GridModel';
import type { IGridView } from './IGridView';
import { GridBox } from './GridBox';

export interface ThreeGridViewOptions {
    rows: number;
    cols: number;
    renderer: THREE.WebGLRenderer;
    colors?: number[];
    highlightColor?: number;
    depthRatio?: number;
    cameraFov?: number;
    cameraTiltDeg?: number;
    /** Fraction of screen width reserved as empty space on the left. */
    marginLeft?: number;
    /** Fraction of screen width reserved as empty space on the right. */
    marginRight?: number;
    /** Fraction of screen height reserved as empty space below the grid. */
    marginBottom?: number;
    /** Ratio of gap to cell size, e.g. 0.15 = gap is 15% of a cell's size. */
    gapRatio?: number;
    minCellSize?: number;
    maxCellSize?: number;
    swapDurationMs?: number;
    matchDurationMs?: number;
    collapseDurationMs?: number;
}

export class ThreeGridView implements IGridView {
    private rows: number;
    private cols: number;
    private colors: number[];
    private highlightColor: number;
    private depthRatio: number;
    private cameraFov: number;
    private cameraTiltDeg: number;
    private marginLeft: number;
    private marginRight: number;
    private marginBottom: number;
    private gapRatio: number;
    private minCellSize?: number;
    private maxCellSize?: number;
    private swapDurationMs: number;
    private matchDurationMs: number;
    private collapseDurationMs: number;

    /**
     * Fixed arbitrary depth used only as a computation basis for the
     * FOV/distance -> visible-size formulas below. Its literal value doesn't
     * affect what's rendered: cellSize and camera position are both derived
     * from it and scale together, so any positive number here is equivalent.
     */
    private readonly cameraDistance = 10;

    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();

    private cellSize = 0;
    private gap = 0;
    private offsetX = 0;
    private boxes: (GridBox | null)[][] = [];
    private highlighted: GridBox | null = null;
    private pointerDownCb: ((cell: CellCoord) => void) | null = null;
    private pointerUpCb: ((cell: CellCoord) => void) | null = null;

    constructor(options: ThreeGridViewOptions) {
        this.rows = options.rows;
        this.cols = options.cols;
        this.renderer = options.renderer;
        this.colors = options.colors ?? [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55, 0xcc66ff];
        this.highlightColor = options.highlightColor ?? 0xffffff;
        this.depthRatio = options.depthRatio ?? 0.3;
        this.cameraFov = options.cameraFov ?? 45;
        this.cameraTiltDeg = options.cameraTiltDeg ?? 18;
        this.marginLeft = options.marginLeft ?? 0.05;
        this.marginRight = options.marginRight ?? 0.05;
        this.marginBottom = options.marginBottom ?? 0.05;
        this.gapRatio = options.gapRatio ?? 0.15;
        this.minCellSize = options.minCellSize;
        this.maxCellSize = options.maxCellSize;
        this.swapDurationMs = options.swapDurationMs ?? 180;
        this.matchDurationMs = options.matchDurationMs ?? 200;
        this.collapseDurationMs = options.collapseDurationMs ?? 220;

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(this.cameraFov, aspect, 0.1, 100);

        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
        dirLight.position.set(0, 3, 4);
        this.scene.add(dirLight);

        this.applyLayout();
        this.setupInput();
    }

    renderInitial(grid: CellValue[][]): void {
        for (let r = 0; r < this.rows; r++) {
            this.boxes.push([]);
            for (let c = 0; c < this.cols; c++) {
                const box = new GridBox(grid[r][c], {
                    size: this.cellSize,
                    colors: this.colors,
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

    render(): void {
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
        this.renderer.autoClear = true;
    }

    handleResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.applyLayout();
    }

    dispose(): void {
        for (const row of this.boxes) {
            for (const box of row) box?.destroy(this.scene);
        }
    }

    /**
     * Recomputes cell size, horizontal centering offset, and camera framing
     * from the current screen size and margins, then repositions every box.
     * Single code path used by both the constructor and handleResize.
     */
    private applyLayout(): void {
        const aspect = window.innerWidth / window.innerHeight;
        const fovRad = THREE.MathUtils.degToRad(this.cameraFov);
        const visibleHeight = 2 * Math.tan(fovRad / 2) * this.cameraDistance;
        const visibleWidth = visibleHeight * aspect;

        const widthFraction = 1 - this.marginLeft - this.marginRight;
        const targetWidth = visibleWidth * widthFraction;
        let size = targetWidth / (this.cols + (this.cols - 1) * this.gapRatio);
        if (this.minCellSize !== undefined) size = Math.max(size, this.minCellSize);
        if (this.maxCellSize !== undefined) size = Math.min(size, this.maxCellSize);

        this.cellSize = size;
        this.gap = size * this.gapRatio;
        this.offsetX = visibleWidth * (this.marginLeft - this.marginRight) / 2;

        this.positionCamera(visibleHeight);

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const box = this.boxes[r]?.[c];
                if (!box) continue;
                box.setSize(this.cellSize);
                box.moveTo(this.cellWorldPos(r, c));
            }
        }
    }

    /**
     * Points the camera at a spot below the grid's true vertical center so
     * marginBottom of the visible frustum falls below the grid's bottom row
     * (which is anchored at world Y = 0). This replaces the old "always
     * look at the grid's center" behavior, which made vertical position
     * uncontrollable.
     */
    private positionCamera(visibleHeight: number): void {
        const lookAtY = visibleHeight * (0.5 - this.marginBottom);
        const tilt = THREE.MathUtils.degToRad(this.cameraTiltDeg);

        this.camera.position.set(
            0,
            lookAtY + Math.sin(tilt) * this.cameraDistance,
            Math.cos(tilt) * this.cameraDistance
        );
        this.camera.lookAt(0, lookAtY, 0);
    }

    /** Bottom row is anchored at world Y = 0; rows stack upward from there. */
    private cellWorldPos(row: number, col: number): THREE.Vector3 {
        const step = this.cellSize + this.gap;
        const totalWidth = (this.cols - 1) * step;
        const x = col * step - totalWidth / 2 + this.offsetX;
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