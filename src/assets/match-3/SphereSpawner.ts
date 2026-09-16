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
    totalSpheres: number;
    despawnY: number;
    radius: number;
    radiusVariance?: number;
    colors?: number[];
    packingFactor?: number;
    jitter?: number;
    mass?: number;
    restitution?: number;
    renderDepth?: number;
    renderDepthJitter?: number;
    excludeNear?: { center: THREE.Vector2; radius: number };
}

export class SphereSpawner {
    private scene: THREE.Scene;
    private world: PhysicsWorld;
    private totalSpheres: number;
    private despawnY: number;
    private radius: number;
    private radiusVariance: number;
    private colors: number[];
    private packingFactor: number;
    private jitter: number;
    private mass: number;
    private restitution: number;
    private renderDepth: number;
    private renderDepthJitter: number;
    private excludeNear: { center: THREE.Vector2; radius: number } | null;

    private nextId = 0;
    private active: Map<number, { sphere: PhysicsSphere; view: PhysicsSphereView }> = new Map();
    private onDespawnCb: ((sphere: PhysicsSphere) => void) | null = null;

    constructor(options: SphereSpawnerOptions) {
        this.scene = options.scene;
        this.world = options.world;
        this.totalSpheres = options.totalSpheres;
        this.despawnY = options.despawnY;
        this.radius = options.radius;
        this.radiusVariance = options.radiusVariance ?? 0;
        this.colors = options.colors ?? [0xffffff];
        this.packingFactor = options.packingFactor ?? 1.15;
        this.jitter = options.jitter ?? 0.15;
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.2;
        this.renderDepth = options.renderDepth ?? 0.5;
        this.renderDepthJitter = options.renderDepthJitter ?? 0;
        this.excludeNear = options.excludeNear ?? null;
    }

    onDespawn(cb: (sphere: PhysicsSphere) => void): void {
        this.onDespawnCb = cb;
    }

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
            const laneOffset = (i % 2 === 0) ? 0 : spacing / 2;

            for (let lane = 0; lane < lanes && spawned < maxCount; lane++) {
                const across = -halfWidth + this.radius + lane * spacing + laneOffset;
                if (across > halfWidth - this.radius) continue;

                const jitterAcross = (Math.random() * 2 - 1) * spacing * this.jitter;
                const position = point.clone().addScaledVector(normal, across + jitterAcross);
                if (this.spawnOne(position)) spawned++;
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
                if (this.spawnOne(new THREE.Vector2(baseX + jitterX, y + jitterY))) spawned++;
            }
            row++;
        }
        return spawned;
    }

    private spawnOne(position: THREE.Vector2): boolean {
        const radius = this.radius * (1 + (Math.random() * 2 - 1) * this.radiusVariance);
        if (this.excludeNear && position.distanceTo(this.excludeNear.center) < this.excludeNear.radius + radius) return false;

        const sphere = new PhysicsSphere({
            id: this.nextId++,
            position,
            radius,
            mass: this.mass,
            restitution: this.restitution,
        });

        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const depth = this.renderDepth + (Math.random() * 2 - 1) * this.renderDepthJitter;
        const view = new PhysicsSphereView(sphere, { color, renderDepth: depth });

        this.world.addSphere(sphere);
        view.spawn(this.scene);
        this.active.set(sphere.id, { sphere, view });
        return true;
    }

    dispose(): void {
        for (const [, entry] of this.active) {
            this.world.removeSphere(entry.sphere);
            entry.view.destroy(this.scene);
        }
        this.active.clear();
    }
}