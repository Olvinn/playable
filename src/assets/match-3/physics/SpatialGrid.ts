export interface SpatialGridOptions {
    cellSize: number;
}

export class SpatialGrid<T> {
    private cellSize: number;
    private buckets: Map<string, T[]> = new Map();

    constructor(options: SpatialGridOptions) {
        this.cellSize = options.cellSize;
    }

    private keyFor(x: number, y: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    clear(): void {
        this.buckets.clear();
    }

    insert(x: number, y: number, item: T): void {
        const key = this.keyFor(x, y);
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        bucket.push(item);
    }

    /** Items in the 3x3 block of cells centered on (x, y) — enough to catch anything within one cell's radius. */
    queryNeighbors(x: number, y: number): T[] {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const result: T[] = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const bucket = this.buckets.get(`${cx + dx},${cy + dy}`);
                if (bucket) result.push(...bucket);
            }
        }
        return result;
    }
}