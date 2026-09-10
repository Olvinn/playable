import * as THREE from 'three';
import { PhysicsSphere } from './physics/PhysicsSphere';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PhysicsSphereView } from './PhysicsSphereView';

export interface SphereSpawnerOptions {
    scene: THREE.Scene;
    world: PhysicsWorld;
    spawnMinX: number;
    spawnMaxX: number;
    spawnY: number;
    /** Once a sphere's y drops below this, it's removed (fell through the grid, or the loss condition, depending on your design). */
    despawnY: number;
    radius: number;
    colors?: number[];
    spawnIntervalSeconds?: number;
    mass?: number;
    restitution?: number;
    renderDepth?: number;
}

/**
 * Periodically spawns PhysicsSphere + PhysicsSphereView pairs at the top of
 * the tube and removes them once they cross despawnY. Doesn't decide what
 * crossing despawnY *means* for the game (win/lose) — see onDespawn.
 */
export class SphereSpawner {
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private spawnMinX: number;
    private spawnMaxX: number;
    private spawnY: number;
    private despawnY: number;
    private radius: number;
    private colors: number[];
    private spawnIntervalSeconds: number;
    private mass: number;
    private restitution: number;
    private renderDepth: number;

    private nextId = 0;
    private timeSinceLastSpawn = 0;
    private active: Map<number, { sphere: PhysicsSphere; view: PhysicsSphereView }> = new Map();
    private onDespawnCb: ((sphere: PhysicsSphere) => void) | null = null;

    constructor(options: SphereSpawnerOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.spawnMinX = options.spawnMinX;
        this.spawnMaxX = options.spawnMaxX;
        this.spawnY = options.spawnY;
        this.despawnY = options.despawnY;
        this.radius = options.radius;
        this.colors = options.colors ?? [0xffffff];
        this.spawnIntervalSeconds = options.spawnIntervalSeconds ?? 0.6;
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
        this.renderDepth = options.renderDepth ?? 0.5;
    }

    /** Fires right before a sphere that crossed despawnY is removed. */
    onDespawn(cb: (sphere: PhysicsSphere) => void): void {
        this.onDespawnCb = cb;
    }

    update(deltaSeconds: number): void {
        this.timeSinceLastSpawn += deltaSeconds;
        if (this.timeSinceLastSpawn >= this.spawnIntervalSeconds) {
            this.timeSinceLastSpawn = 0;
            this.spawnOne();
        }

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

    private spawnOne(): void {
        const x = THREE.MathUtils.randFloat(this.spawnMinX, this.spawnMaxX);
        const position = new THREE.Vector2(x, this.spawnY);

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