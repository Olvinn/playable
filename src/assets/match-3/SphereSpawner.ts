import * as THREE from 'three';
import { PhysicsSphere } from './physics/PhysicsSphere';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PhysicsSphereView } from './PhysicsSphereView';

export interface SphereSpawnerOptions {
    scene: THREE.Scene;
    world: PhysicsWorld;
    /** Total number of spheres to spawn once, up front. */
    totalSpheres: number;
    spawnMinX: number;
    spawnMaxX: number;
    /** Bottom of the area spheres are packed into (closer to the tube's neck). */
    spawnMinY: number;
    /** Top of the area spheres are packed into (closer to the tube's mouth). */
    spawnMaxY: number;
    /** Once a sphere's y drops below this, it's removed (fell through the grid, or the loss condition, depending on your design). */
    despawnY: number;
    radius: number;
    colors?: number[];
    /** Spacing between packed sphere centers, as a multiple of radius*2. >1 leaves a starting gap so spheres don't spawn touching. */
    packingFactor?: number;
    /** Random jitter applied to each packed position, as a fraction of the spacing. 0 = perfectly uniform grid. */
    jitter?: number;
    mass?: number;
    restitution?: number;
    renderDepth?: number;
}

/**
 * Spawns the full complement of spheres once, packed in a grid across the
 * tube's mouth so they start with minimal overlap (physics untangles the
 * small starting gaps naturally rather than violently resolving heavy
 * overlap). No spheres are created after this — update() only handles
 * despawning ones that fall below despawnY.
 */
export class SphereSpawner {
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private totalSpheres: number;
    private spawnMinX: number;
    private spawnMaxX: number;
    private spawnMinY: number;
    private spawnMaxY: number;
    private despawnY: number;
    private radius: number;
    private colors: number[];
    private packingFactor: number;
    private jitter: number;
    private mass: number;
    private restitution: number;
    private renderDepth: number;

    private nextId = 0;
    private active: Map<number, { sphere: PhysicsSphere; view: PhysicsSphereView }> = new Map();
    private onDespawnCb: ((sphere: PhysicsSphere) => void) | null = null;

    constructor(options: SphereSpawnerOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.totalSpheres = options.totalSpheres;
        this.spawnMinX = options.spawnMinX;
        this.spawnMaxX = options.spawnMaxX;
        this.spawnMinY = options.spawnMinY;
        this.spawnMaxY = options.spawnMaxY;
        this.despawnY = options.despawnY;
        this.radius = options.radius;
        this.colors = options.colors ?? [0xffffff];
        this.packingFactor = options.packingFactor ?? 1.15;
        this.jitter = options.jitter ?? 0.15;
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
        this.renderDepth = options.renderDepth ?? 0.5;
    }

    /** Fires right before a sphere that crossed despawnY is removed. */
    onDespawn(cb: (sphere: PhysicsSphere) => void): void {
        this.onDespawnCb = cb;
    }

    /** Spawns totalSpheres in a packed grid. Call once, after the world and colliders are ready. */
    spawnAll(): void {
        const spacing = this.radius * 2 * this.packingFactor;
        const usableWidth = this.spawnMaxX - this.spawnMinX;
        const columns = Math.max(1, Math.floor(usableWidth / spacing) + 1);

        let spawned = 0;
        let row = 0;

        while (spawned < this.totalSpheres) {
            const y = this.spawnMinY + row * spacing;
            if (y > this.spawnMaxY) break; // ran out of vertical room for the configured area

            const rowOffset = (row % 2 === 0) ? 0 : spacing / 2; // brick-like offset so rows nest instead of stacking in straight columns
            for (let col = 0; col < columns && spawned < this.totalSpheres; col++) {
                const baseX = this.spawnMinX + col * spacing + rowOffset;
                if (baseX > this.spawnMaxX) continue;

                const jitterX = (Math.random() * 2 - 1) * spacing * this.jitter;
                const jitterY = (Math.random() * 2 - 1) * spacing * this.jitter;
                this.spawnOne(new THREE.Vector2(baseX + jitterX, y + jitterY));
                spawned++;
            }
            row++;
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

    private spawnOne(position: THREE.Vector2): void {
        const sphere = new PhysicsSphere({
            id: this.nextId++,
            position,
            radius: this.radius,
            mass: this.mass,
            restitution: this.restitution,
        });

        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const view = new PhysicsSphereView(sphere, { color, renderDepth: this.renderDepth });

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