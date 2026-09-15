import * as THREE from 'three';
import { PhysicsSphere } from './physics/PhysicsSphere';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PhysicsSphereView } from './PhysicsSphereView';
import { NeckPath } from './NeckPath';

export type SpawnRegion =
    | { kind: 'path'; path: NeckPath; halfWidthAt: (t: number) => number; startT?: number; endT?: number }
    | { kind: 'box'; minX: number; maxX: number; minY: number; maxY: number };

export interface SphereSpawnerOptions {
    scene: THREE.Scene;
    world: PhysicsWorld;
    /** Total number of spheres to spawn once, up front, across all fill regions combined. */
    totalSpheres: number;
    /** Once a sphere's y drops below this, it's removed (fell through the grid, or the loss condition, depending on your design). */
    despawnY: number;
    radius: number;
    colors?: number[];
    /** Spacing between packed sphere centers, as a multiple of radius*2. >1 leaves a starting gap so spheres don't spawn touching. */
    packingFactor?: number;
    /** Random jitter applied to each packed position, as a fraction of the spacing. 0 = perfectly uniform. */
    jitter?: number;
    mass?: number;
    restitution?: number;
    /** Base z-depth spheres render at. */
    renderDepth?: number;
    /** Random +/- range applied on top of renderDepth per sphere, for a layered look instead of every sphere at exactly the same depth. */
    renderDepthJitter?: number;
}

/**
 * Spawns the full complement of spheres once, packed across one or more
 * fill regions (a curved NeckPath section and/or a straight box area) so
 * they start with minimal overlap. No spheres are created after this —
 * update() only handles despawning ones that fall below despawnY.
 */
export class SphereSpawner {
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private totalSpheres: number;
    private despawnY: number;
    private radius: number;
    private colors: number[];
    private packingFactor: number;
    private jitter: number;
    private mass: number;
    private restitution: number;
    private renderDepth: number;
    private renderDepthJitter: number;

    private nextId = 0;
    private active: Map<number, { sphere: PhysicsSphere; view: PhysicsSphereView }> = new Map();
    private onDespawnCb: ((sphere: PhysicsSphere) => void) | null = null;

    constructor(options: SphereSpawnerOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.totalSpheres = options.totalSpheres;
        this.despawnY = options.despawnY;
        this.radius = options.radius;
        this.colors = options.colors ?? [0xffffff];
        this.packingFactor = options.packingFactor ?? 1.15;
        this.jitter = options.jitter ?? 0.15;
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
        this.renderDepth = options.renderDepth ?? 0.5;
        this.renderDepthJitter = options.renderDepthJitter ?? 0;
    }

    /** Fires right before a sphere that crossed despawnY is removed. */
    onDespawn(cb: (sphere: PhysicsSphere) => void): void {
        this.onDespawnCb = cb;
    }

    /** Fills the given regions in order until totalSpheres is reached or every region is exhausted. */
    spawnAll(regions: SpawnRegion[]): void {
        let spawned = 0;
        for (const region of regions) {
            if (spawned >= this.totalSpheres) break;
            const remaining = this.totalSpheres - spawned;
            spawned += region.kind === 'path'
                ? this.spawnAlongPath(region, remaining)
                : this.spawnInBox(region, remaining);
        }
    }

    /** Handles despawning of spheres that fell below despawnY. No new spheres are created here. */
    update(): void {
        for (const [id, entry] of this.active) {
            entry.view.sync();
            if (entry.sphere.collider.center.y < this.despawnY) {
                this.onDespawnCb?.(entry.sphere);
                this.world.removeSphere(entry.sphere);
                entry.view.destroy(this.scene);
                this.active.delete(id);
            }
        }
    }

    getActiveCount(): number {
        return this.active.size;
    }

    /**
     * Removes up to `maxCount` of the active spheres whose arc-length position along `path` falls
     * within [minT, maxT), closest to minT first — this is the actual link between playing the
     * match-3 board and the platform being able to move at all. Without something like this, the
     * platform's own push force is the *only* thing that determines whether/when it reaches the
     * door, which makes the win condition entirely independent of anything the player does — not a
     * design tradeoff, a broken game. Each successful match should call this to clear real space
     * immediately ahead of the platform.
     *
     * Filtering by each sphere's own path position (not "nearest in world space" to a point) is
     * deliberate: the serpentine tube folds back on itself, so a straight-line-nearest search could
     * easily grab spheres from an adjacent run that's physically close by but arc-lengths away —
     * wrong marbles entirely. Sampling findClosestT per sphere is only done here, on a match (rare,
     * player-paced), not per frame, so the cost is a non-issue.
     */
    removeAheadOfPath(path: NeckPath, minT: number, maxT: number, maxCount: number): number {
        const candidates: { id: number; t: number }[] = [];
        for (const [id, entry] of this.active) {
            const t = path.findClosestT(entry.sphere.collider.center);
            if (t >= minT && t < maxT) candidates.push({ id, t });
        }
        candidates.sort((a, b) => a.t - b.t);

        let removed = 0;
        for (const { id } of candidates) {
            if (removed >= maxCount) break;
            const entry = this.active.get(id);
            if (!entry) continue;
            this.onDespawnCb?.(entry.sphere);
            this.world.removeSphere(entry.sphere);
            entry.view.destroy(this.scene);
            this.active.delete(id);
            removed++;
        }
        return removed;
    }

    private spawnAlongPath(region: Extract<SpawnRegion, { kind: 'path' }>, maxCount: number): number {
        const spacing = this.radius * 2 * this.packingFactor;
        const startT = region.startT ?? 0;
        const endT = region.endT ?? 1;
        const pathLength = region.path.length * (endT - startT);
        const steps = Math.max(1, Math.floor(pathLength / spacing));

        let spawned = 0;
        for (let i = 0; i <= steps && spawned < maxCount; i++) {
            const t = startT + (endT - startT) * (i / steps);
            const point = region.path.getPoint(t);
            const tangent = region.path.getTangent(t);
            const normal = new THREE.Vector2(-tangent.y, tangent.x);
            const halfWidth = region.halfWidthAt(t);
            const lanes = Math.max(1, Math.floor((halfWidth * 2) / spacing));
            const laneOffset = (i % 2 === 0) ? 0 : spacing / 2; // brick-like offset so lanes nest instead of stacking in straight columns

            for (let lane = 0; lane < lanes && spawned < maxCount; lane++) {
                const across = -halfWidth + this.radius + lane * spacing + laneOffset;
                if (across > halfWidth - this.radius) continue;

                const jitterAcross = (Math.random() * 2 - 1) * spacing * this.jitter;
                const position = point.clone().addScaledVector(normal, across + jitterAcross);
                this.spawnOne(position);
                spawned++;
            }
        }
        return spawned;
    }

    private spawnInBox(region: Extract<SpawnRegion, { kind: 'box' }>, maxCount: number): number {
        const spacing = this.radius * 2 * this.packingFactor;
        const usableWidth = region.maxX - region.minX;
        const columns = Math.max(1, Math.floor(usableWidth / spacing) + 1);

        let spawned = 0;
        let row = 0;
        while (spawned < maxCount) {
            const y = region.minY + row * spacing;
            if (y > region.maxY) break;

            const rowOffset = (row % 2 === 0) ? 0 : spacing / 2;
            for (let col = 0; col < columns && spawned < maxCount; col++) {
                const baseX = region.minX + col * spacing + rowOffset;
                if (baseX > region.maxX) continue;

                const jitterX = (Math.random() * 2 - 1) * spacing * this.jitter;
                const jitterY = (Math.random() * 2 - 1) * spacing * this.jitter;
                this.spawnOne(new THREE.Vector2(baseX + jitterX, y + jitterY));
                spawned++;
            }
            row++;
        }
        return spawned;
    }

    private spawnOne(position: THREE.Vector2): void {
        const sphere = new PhysicsSphere({
            id: this.nextId++,
            position,
            radius: this.radius,
            mass: this.mass,
            restitution: this.restitution,
        }); 

        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const depth = this.renderDepth + (Math.random() * 2 - 1) * this.renderDepthJitter;
        const view = new PhysicsSphereView(sphere, { color, renderDepth: depth });

        this.world.addSphere(sphere);
        view.spawn(this.scene);
        this.active.set(sphere.id, { sphere, view });
    }

    dispose(): void {
        for (const [, entry] of this.active) {
            this.world.removeSphere(entry.sphere);
            entry.view.destroy(this.scene);
        }
        this.active.clear();
    }
}