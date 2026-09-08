import { CellCoord, GridModel } from './GridModel';
import { type IGridView } from './IGridView';

export class GridController {
    private selected: CellCoord | null = null;
    private pointerDownCell: CellCoord | null = null;
    private isAnimating = false;
    private model : GridModel;
    private view : IGridView;

    constructor(model: GridModel, view: IGridView) {
        this.view = view;
        this.model = model;
        this.view.renderInitial(model.serialize());
        this.model.on((event, payload) => this.handleModelEvent(event, payload));
        this.view.onCellPointerDown((cell) => this.handlePointerDown(cell));
        this.view.onCellPointerUp((cell) => this.handlePointerUp(cell));
    }

    private handlePointerDown(cell: CellCoord) {
        if (this.isAnimating) return;
        this.pointerDownCell = cell;

        if (this.selected && this.model.areAdjacent(this.selected, cell)) {
            this.attemptSwap(this.selected, cell); // two-click swap
            this.selected = null;
            this.view.clearHighlight();
        } else {
            this.selected = cell;
            this.view.highlightCell(cell);
        }
    }

    private handlePointerUp(cell: CellCoord) {
        if (this.isAnimating || !this.pointerDownCell) return;
        const down = this.pointerDownCell;
        this.pointerDownCell = null;

        const moved = down.row !== cell.row || down.col !== cell.col;
        if (moved && this.model.areAdjacent(down, cell)) {
            this.attemptSwap(down, cell); // drag swap
            this.selected = null;
            this.view.clearHighlight();
        }
    }

    private attemptSwap(a: CellCoord, b: CellCoord) {
        this.isAnimating = true;
        this.model.trySwap(a, b);
    }

    private async handleModelEvent(event: string, payload: any) {
        switch (event) {
            case 'swap': await this.view.animateSwap(payload.a, payload.b); break;
            case 'invalidSwap': await this.view.animateInvalidSwap(payload.a, payload.b); this.isAnimating = false; break;
            case 'matched': await this.view.animateMatched(payload.cells); break;
            case 'collapse': await this.view.animateCollapse(payload.moves, payload.spawns); break;
            case 'settled': this.isAnimating = false; break;
        }
    }
}