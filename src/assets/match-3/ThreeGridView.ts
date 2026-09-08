import * as THREE from 'three';
import { CellCoord, type CellValue } from './GridModel';
import { type IGridView } from './IGridView';

interface ThreeGridViewOptions {
    rows: number;
    cols: number;
    cellSize?: number;
    gap?: number;
    colors?: number[];
    anchorY?: number; // world-space Y of the grid's bottom row — tune to sit at screen bottom
    renderer: THREE.WebGLRenderer;
}

export class ThreeGridView implements IGridView {
    private scene = new THREE.Scene();
    private camera: THREE.OrthographicCamera;
    private meshes: (THREE.Mesh | null)[][] = [];
    private rows: number;
    private cols: number;
    private cellSize: number;
    private gap: number;
    private colors: number[];
    private renderer: THREE.WebGLRenderer;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private highlightMesh: THREE.Mesh;
    private pointerDownCb: ((cell: CellCoord) => void) | null = null;
    private pointerUpCb: ((cell: CellCoord) => void) | null = null;
    private options: ThreeGridViewOptions;

    constructor(options: ThreeGridViewOptions) {
        this.options = options;
        this.rows = options.rows;
        this.cols = options.cols;
        this.cellSize = options.cellSize ?? 0.45;
        this.gap = options.gap ?? 0.15;
        this.colors = options.colors ?? [0xff5555, 0x55ff88, 0x5599ff, 0xffdd55, 0xcc66ff];
        this.renderer = options.renderer;

        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = 5;
        this.camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 10);
        this.camera.position.z = 5;

        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6).translateZ(3));

        this.highlightMesh = new THREE.Mesh(
            new THREE.RingGeometry(this.cellSize * 0.55, this.cellSize * 0.62, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        this.scene.add(this.highlightMesh);

        this.setupInput();
    }

    private cellWorldPos(row: number, col: number): THREE.Vector3 {
        const step = this.cellSize + this.gap;
        const totalWidth = (this.cols - 1) * step;
        const x = col * step - totalWidth / 2;
        const anchorY = this.options.anchorY ?? -4;
        const y = anchorY + (this.rows - 1 - row) * step;
        return new THREE.Vector3(x, y, 0);
    }

    renderInitial(grid: CellValue[][]) {
        for (let r = 0; r < this.rows; r++) {
            this.meshes.push([]);
            for (let c = 0; c < this.cols; c++) {
                const mesh = this.createBoxMesh(grid[r][c]);
                mesh.position.copy(this.cellWorldPos(r, c));
                this.scene.add(mesh);
                this.meshes[r].push(mesh);
            }
        }
    }

    private createBoxMesh(colorIndex: CellValue): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(this.cellSize, this.cellSize, this.cellSize * 0.3);
        const material = new THREE.MeshStandardMaterial({ color: this.colors[colorIndex] ?? 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.colorIndex = colorIndex;
        return mesh;
    }

    private setupInput() {
        const dom = this.renderer.domElement;

        const getCellAtPointer = (event: PointerEvent): CellCoord | null => {
            const rect = dom.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const targets = this.meshes.flat().filter((m): m is THREE.Mesh => m !== null);
            const hit = this.raycaster.intersectObjects(targets)[0]?.object as THREE.Mesh | undefined;
            if (!hit) return null;
            for (let r = 0; r < this.rows; r++)
                for (let c = 0; c < this.cols; c++)
                    if (this.meshes[r][c] === hit) return { row: r, col: c };
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

    onCellPointerDown(cb: (cell: CellCoord) => void) { this.pointerDownCb = cb; }
    onCellPointerUp(cb: (cell: CellCoord) => void) { this.pointerUpCb = cb; }

    highlightCell(cell: CellCoord) {
        const pos = this.cellWorldPos(cell.row, cell.col);
        this.highlightMesh.position.set(pos.x, pos.y, 0.3);
        (this.highlightMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    }

    clearHighlight() {
        (this.highlightMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    private lerpPosition(mesh: THREE.Mesh, to: THREE.Vector3, duration: number): Promise<void> {
        const from = mesh.position.clone();
        const start = performance.now();
        return new Promise((resolve) => {
            const step = (now: number) => {
                const t = Math.min((now - start) / duration, 1);
                mesh.position.lerpVectors(from, to, 1 - Math.pow(1 - t, 3));
                if (t < 1) requestAnimationFrame(step); else resolve();
            };
            requestAnimationFrame(step);
        });
    }

    async animateSwap(a: CellCoord, b: CellCoord) {
        const meshA = this.meshes[a.row][a.col]!;
        const meshB = this.meshes[b.row][b.col]!;
        await Promise.all([
            this.lerpPosition(meshA, this.cellWorldPos(b.row, b.col), 180),
            this.lerpPosition(meshB, this.cellWorldPos(a.row, a.col), 180),
        ]);
        this.meshes[a.row][a.col] = meshB;
        this.meshes[b.row][b.col] = meshA;
    }

    async animateInvalidSwap(a: CellCoord, b: CellCoord) {
        await this.animateSwap(a, b);
        await this.animateSwap(a, b);
    }

    async animateMatched(cells: CellCoord[]) {
        await Promise.all(cells.map(({ row, col }) => {
            const mesh = this.meshes[row][col];
            if (!mesh) return Promise.resolve();
            const start = performance.now();
            return new Promise<void>((resolve) => {
                const step = (now: number) => {
                    const t = Math.min((now - start) / 200, 1);
                    mesh.scale.setScalar(1 - t);
                    if (t < 1) requestAnimationFrame(step);
                    else { this.scene.remove(mesh); this.meshes[row][col] = null; resolve(); }
                };
                requestAnimationFrame(step);
            });
        }));
    }

    async animateCollapse(
        moves: { from: CellCoord; to: CellCoord }[],
        spawns: { row: number; col: number; value: CellValue }[]
    ) {
        const moveAnims = moves.map(({ from, to }) => {
            const mesh = this.meshes[from.row][from.col]!;
            this.meshes[from.row][from.col] = null;
            this.meshes[to.row][to.col] = mesh;
            return this.lerpPosition(mesh, this.cellWorldPos(to.row, to.col), 220);
        });

        const spawnAnims = spawns.map(({ row, col, value }) => {
            const mesh = this.createBoxMesh(value);
            const target = this.cellWorldPos(row, col);
            mesh.position.set(target.x, target.y + this.cellSize * 3, target.z);
            this.scene.add(mesh);
            this.meshes[row][col] = mesh;
            return this.lerpPosition(mesh, target, 260);
        });

        await Promise.all([...moveAnims, ...spawnAnims]);
    }

    render() {
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
        this.renderer.autoClear = true;
    }

    handleResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = 5;
        this.camera.left = -viewSize * aspect;
        this.camera.right = viewSize * aspect;
        this.camera.top = viewSize;
        this.camera.bottom = -viewSize;
        this.camera.updateProjectionMatrix();
    }

    dispose() {
        this.meshes.flat().forEach(m => {
            if (!m) return;
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
    }
}