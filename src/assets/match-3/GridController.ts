import { CellCoord, GridModel } from './GridModel';
import type { IGridView } from './IGridView';

export interface GridControllerOptions {
    /** Called once a swap's matches/clears/collapses have fully settled — the right time to resync anything that should only happen once per swap (e.g. the match-3/tube link). Not called on an invalid (reverted) swap, since the board didn't change. */
    onBoardChanged?: () => void;
    /**
     * Called right as each round of matched cells finishes its clear animation and is actually
     * destroyed — one or more times per swap, once per cascade round, strictly before
     * onBoardChanged. Physics colliders need this: rebuilding them only in onBoardChanged left a
     * gap for the whole cascade's duration where a cell's box was already gone visually but its
     * collider was still solid, so marbles rested on thin air until everything settled.
     */
    onCellsCleared?: () => void;
}

export class GridController {
    private selected: CellCoord | null = null;
    private pointerDownCell: CellCoord | null = null;
    private isBusy = false;
    private model: GridModel;
    private view: IGridView;
    private onBoardChanged: (() => void) | null;
    private onCellsCleared: (() => void) | null;

    constructor(model: GridModel, view: IGridView, options: GridControllerOptions = {}) {
        this.model = model;
        this.view = view;
        this.onBoardChanged = options.onBoardChanged ?? null;
        this.onCellsCleared = options.onCellsCleared ?? null;
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
        this.onBoardChanged?.();
    }

    private async resolveMatches(matches: CellCoord[][]): Promise<void> {
        let current: CellCoord[][] | null = matches;
        while (current) {
            const cleared = this.model.clearMatches(current);
            await this.view.animateMatched(cleared);
            this.onCellsCleared?.();

            const moves = this.model.collapse();
            await this.view.animateCollapse(moves);

            const next = this.model.findMatches();
            current = next.length > 0 ? next : null;
        }
    }
}