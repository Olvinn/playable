export type CellValue = number; // -1 = empty

export class CellCoord {
    row: number;
    col: number;

    constructor(row: number, col: number) {
        this.row = row;
        this.col = col;
    }
}

import type { GridGenerator } from './GridGenerator';

export class GridModel {
    readonly rows: number;
    readonly cols: number;
    readonly colorCount: number;
    private grid: CellValue[][];
    private generator: GridGenerator;

    constructor(generator: GridGenerator) {
        this.generator = generator;
        this.rows = generator.rows;
        this.cols = generator.cols;
        this.colorCount = generator.colorCount;
        this.grid = generator.generate();
    }

    getCell(row: number, col: number): CellValue {
        return this.grid[row][col];
    }

    serialize(): CellValue[][] {
        return this.grid.map(row => [...row]);
    }

    hasValidMove(): boolean {
        return this.generator.hasValidMove(this.grid);
    }

    areAdjacent(a: CellCoord, b: CellCoord): boolean {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    }

    trySwap(a: CellCoord, b: CellCoord): CellCoord[][] | null {
        if (!this.areAdjacent(a, b)) return null;

        this.swapCells(a, b);
        const matches = this.findMatches();

        if (matches.length === 0) {
            this.swapCells(a, b);
            return null;
        }
        return matches;
    }

    clearMatches(matches: CellCoord[][]): CellCoord[] {
        const cleared = new Map<string, CellCoord>();
        matches.forEach(group => group.forEach(c => cleared.set(`${c.row},${c.col}`, c)));
        cleared.forEach(c => { this.grid[c.row][c.col] = -1; });
        return [...cleared.values()];
    }

    collapse(): { from: CellCoord; to: CellCoord }[] {
        const moves: { from: CellCoord; to: CellCoord }[] = [];

        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] === -1) continue;
                if (writeRow !== r) {
                    this.grid[writeRow][c] = this.grid[r][c];
                    this.grid[r][c] = -1;
                    moves.push({ from: new CellCoord(r, c), to: new CellCoord(writeRow, c) });
                }
                writeRow--;
            }
        }
        return moves;
    }

    findMatches(): CellCoord[][] {
        const matches: CellCoord[][] = [];

        for (let r = 0; r < this.rows; r++) {
            let runStart = 0;
            for (let c = 1; c <= this.cols; c++) {
                const same = c < this.cols && this.grid[r][c] === this.grid[r][runStart] && this.grid[r][runStart] !== -1;
                if (!same) {
                    if (c - runStart >= 3) {
                        matches.push(Array.from({ length: c - runStart }, (_, i) => new CellCoord(r, runStart + i)));
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
                        matches.push(Array.from({ length: r - runStart }, (_, i) => new CellCoord(runStart + i, c)));
                    }
                    runStart = r;
                }
            }
        }
        return matches;
    }

    private swapCells(a: CellCoord, b: CellCoord): void {
        const tmp = this.grid[a.row][a.col];
        this.grid[a.row][a.col] = this.grid[b.row][b.col];
        this.grid[b.row][b.col] = tmp;
    }
}