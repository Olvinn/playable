export type CellValue = number; // color index, -1 = empty

export class CellCoord { 
    row: number; 
    col: number;
    
    constructor(row: number, col: number) {
        this.row = row;
        this.col = col;
    }
}
export interface Match { cells: CellCoord[]; }

type Listener = (event: string, payload?: any) => void;

export class GridModel {
    readonly rows: number;
    readonly cols: number;
    readonly colorCount: number;
    private grid: CellValue[][];
    private listeners: Listener[] = [];

    constructor(rows: number, cols: number, colorCount: number) {
        this.rows = rows;
        this.cols = cols;
        this.colorCount = colorCount;
        this.grid = this.generateInitialGrid();
    }

    on(listener: Listener) { this.listeners.push(listener); }
    private emit(event: string, payload?: any) { this.listeners.forEach(l => l(event, payload)); }

    getCell(row: number, col: number): CellValue { return this.grid[row][col]; }
    serialize(): CellValue[][] { return this.grid.map(row => [...row]); }

    private generateInitialGrid(): CellValue[][] {
        const grid: CellValue[][] = [];
        for (let r = 0; r < this.rows; r++) {
            grid.push([]);
            for (let c = 0; c < this.cols; c++) {
                let color: number;
                do { color = Math.floor(Math.random() * this.colorCount); }
                while (this.wouldMatch(grid, r, c, color));
                grid[r].push(color);
            }
        }
        return grid;
    }

    private wouldMatch(grid: CellValue[][], row: number, col: number, color: number): boolean {
        if (col >= 2 && grid[row][col - 1] === color && grid[row][col - 2] === color) return true;
        if (row >= 2 && grid[row - 1][col] === color && grid[row - 2][col] === color) return true;
        return false;
    }

    areAdjacent(a: CellCoord, b: CellCoord): boolean {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    }

    trySwap(a: CellCoord, b: CellCoord): boolean {
        if (!this.areAdjacent(a, b)) return false;

        this.swapCells(a, b);
        const matches = this.findMatches();

        if (matches.length === 0) {
            this.swapCells(a, b); // revert
            this.emit('invalidSwap', { a, b });
            return false;
        }

        this.emit('swap', { a, b });
        this.resolveMatches(matches);
        return true;
    }

    private swapCells(a: CellCoord, b: CellCoord) {
        const tmp = this.grid[a.row][a.col];
        this.grid[a.row][a.col] = this.grid[b.row][b.col];
        this.grid[b.row][b.col] = tmp;
    }

    findMatches(): Match[] {
        const matches: Match[] = [];

        for (let r = 0; r < this.rows; r++) {
            let runStart = 0;
            for (let c = 1; c <= this.cols; c++) {
                const same = c < this.cols && this.grid[r][c] === this.grid[r][runStart] && this.grid[r][runStart] !== -1;
                if (!same) {
                    if (c - runStart >= 3) {
                        matches.push({ cells: Array.from({ length: c - runStart }, (_, i) => ({ row: r, col: runStart + i })) });
                    }
                    runStart = c;
                }
            }
        }

        for (let c = 0; c < this.cols; c++) {
            let runStart = 0;
            for (let r = 1; r <= this.rows; r++) {
                const same = r < this.rows && this.grid[r][c] === this.grid[runStart][c] && this.grid[runStart][c] !== -1;
                if (!same) {
                    if (r - runStart >= 3) {
                        matches.push({ cells: Array.from({ length: r - runStart }, (_, i) => ({ row: runStart + i, col: c })) });
                    }
                    runStart = r;
                }
            }
        }

        return matches;
    }

    private resolveMatches(matches: Match[]) {
        const cellsToClear = new Map<string, CellCoord>();
        matches.forEach(m => m.cells.forEach(c => cellsToClear.set(`${c.row},${c.col}`, c)));

        cellsToClear.forEach(({ row, col }) => { this.grid[row][col] = -1; });
        this.emit('matched', { cells: [...cellsToClear.values()] });
        this.collapseAndRefill();
    }

    private collapseAndRefill() {
        const moves: { from: CellCoord; to: CellCoord }[] = [];
        const spawns: { row: number; col: number; value: CellValue }[] = [];

        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== -1) {
                    if (writeRow !== r) {
                        this.grid[writeRow][c] = this.grid[r][c];
                        this.grid[r][c] = -1;
                        moves.push({ from: { row: r, col: c }, to: { row: writeRow, col: c } });
                    }
                    writeRow--;
                }
            }
            for (let r = writeRow; r >= 0; r--) {
                const value = Math.floor(Math.random() * this.colorCount);
                this.grid[r][c] = value;
                spawns.push({ row: r, col: c, value });
            }
        }

        this.emit('collapse', { moves, spawns });

        const cascadeMatches = this.findMatches();
        if (cascadeMatches.length > 0) this.resolveMatches(cascadeMatches);
        else this.emit('settled', {});
    }
}