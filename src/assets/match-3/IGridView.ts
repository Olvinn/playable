import type { CellCoord, CellValue } from './GridModel';

export interface IGridView {
    renderInitial(grid: CellValue[][]): void;
    animateSwap(a: CellCoord, b: CellCoord): Promise<void>;
    animateInvalidSwap(a: CellCoord, b: CellCoord): Promise<void>;
    animateMatched(cells: CellCoord[]): Promise<void>;
    animateCollapse(moves: { from: CellCoord; to: CellCoord }[]): Promise<void>;
    onCellPointerDown(cb: (cell: CellCoord) => void): void;
    onCellPointerUp(cb: (cell: CellCoord) => void): void;
    highlightCell(cell: CellCoord): void;
    clearHighlight(): void;
    render(): void;
    handleResize(): void;
    dispose(): void;
}