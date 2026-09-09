import type { CellValue } from './GridModel';

export interface GridGeneratorOptions {
    rows: number;
    cols: number;
    colorCount: number;
    maxAttempts?: number;
}

export class GridGenerator {
    readonly rows: number;
    readonly cols: number;
    readonly colorCount: number;
    private maxAttempts: number;

    constructor(options: GridGeneratorOptions) {
        this.rows = options.rows;
        this.cols = options.cols;
        this.colorCount = options.colorCount;
        this.maxAttempts = options.maxAttempts ?? 200;
    }

    generate(): CellValue[][] {
        let grid = this.generateWithoutMatches();
        for (let attempt = 1; attempt < this.maxAttempts && !this.hasValidMove(grid); attempt++) {
            grid = this.generateWithoutMatches();
        }
        return grid;
    }

    /** True if any adjacent swap on this grid would create a match. */
    hasValidMove(grid: CellValue[][]): boolean {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (c + 1 < this.cols && this.swapCreatesMatch(grid, r, c, r, c + 1)) return true;
                if (r + 1 < this.rows && this.swapCreatesMatch(grid, r, c, r + 1, c)) return true;
            }
        }
        return false;
    }

    private swapCreatesMatch(grid: CellValue[][], r1: number, c1: number, r2: number, c2: number): boolean {
        const tmp = grid[r1][c1];
        grid[r1][c1] = grid[r2][c2];
        grid[r2][c2] = tmp;

        const created = this.hasMatchAt(grid, r1, c1) || this.hasMatchAt(grid, r2, c2);

        grid[r2][c2] = grid[r1][c1];
        grid[r1][c1] = tmp;
        return created;
    }

    private hasMatchAt(grid: CellValue[][], row: number, col: number): boolean {
        const color = grid[row][col];
        if (color === -1) return false;

        let run = 1;
        for (let c = col - 1; c >= 0 && grid[row][c] === color; c--) run++;
        for (let c = col + 1; c < this.cols && grid[row][c] === color; c++) run++;
        if (run >= 3) return true;

        run = 1;
        for (let r = row - 1; r >= 0 && grid[r][col] === color; r--) run++;
        for (let r = row + 1; r < this.rows && grid[r][col] === color; r++) run++;
        return run >= 3;
    }

    private generateWithoutMatches(): CellValue[][] {
        const grid: CellValue[][] = [];
        for (let r = 0; r < this.rows; r++) {
            grid.push([]);
            for (let c = 0; c < this.cols; c++) {
                let color: number;
                do { color = Math.floor(Math.random() * this.colorCount); }
                while (this.wouldExtendRun(grid, r, c, color));
                grid[r].push(color);
            }
        }
        return grid;
    }

    private wouldExtendRun(grid: CellValue[][], row: number, col: number, color: number): boolean {
        if (col >= 2 && grid[row][col - 1] === color && grid[row][col - 2] === color) return true;
        if (row >= 2 && grid[row - 1][col] === color && grid[row - 2][col] === color) return true;
        return false;
    }
}