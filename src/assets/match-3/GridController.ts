import { CellCoord, GridModel } from './GridModel';
import type { IGridView } from './IGridView';

export class GridController {
    private selected: CellCoord | null = null;
    private pointerDownCell: CellCoord | null = null;
    private isBusy = false;
    private model: GridModel;
    private view: IGridView;

    constructor(model: GridModel, view: IGridView) {
        this.model = model;
        this.view = view;
        this.view.renderInitial(model.serialize());
        this.view.onCellPointerDown(cell => this.handlePointerDown(cell));
        this.view.onCellPointerUp(cell => this.handlePointerUp(cell));
    }

    private handlePointerDown(cell: CellCoord): void {
        if (this.isBusy) return;
        this.pointerDownCell = cell;

        if (this.selected && this.model.areAdjacent(this.selected, cell)) {
            const a = this.selected;
            this.selected = null;
            this.view.clearHighlight();
            void this.swap(a, cell);
        } else {
            this.selected = cell;
            this.view.highlightCell(cell);
        }
    }

    private handlePointerUp(cell: CellCoord): void {
        if (this.isBusy || !this.pointerDownCell) return;
        const down = this.pointerDownCell;
        this.pointerDownCell = null;

        const moved = down.row !== cell.row || down.col !== cell.col;
        if (moved && this.model.areAdjacent(down, cell)) {
            this.selected = null;
            this.view.clearHighlight();
            void this.swap(down, cell);
        }
    }

    private async swap(a: CellCoord, b: CellCoord): Promise<void> {
        this.isBusy = true;
        const matches = this.model.trySwap(a, b);

        if (!matches) {
            await this.view.animateInvalidSwap(a, b);
            this.isBusy = false;
            return;
        }

        await this.view.animateSwap(a, b);
        await this.resolveMatches(matches);
        this.isBusy = false;
    }

    private async resolveMatches(matches: CellCoord[][]): Promise<void> {
        let current: CellCoord[][] | null = matches;
        while (current) {
            const cleared = this.model.clearMatches(current);
            await this.view.animateMatched(cleared);

            const moves = this.model.collapse();
            await this.view.animateCollapse(moves);

            const next = this.model.findMatches();
            current = next.length > 0 ? next : null;
        }
    }
}