import * as THREE from 'three';

export interface AdaptiveCameraOptions {
    camera: THREE.PerspectiveCamera;
    contentWidth: number;
    widthFraction?: number;
    baseFov?: number;
    minFov?: number;
    maxFov?: number;
    minDistance?: number;
    maxDistance?: number;
    tiltDeg?: number;
    marginBottom?: number;
}

/**
 * Owns fov/distance/position for a single shared PerspectiveCamera.
 * Distance is fully solved from contentWidth/widthFraction/baseFov — it's
 * not a separate input, only the min/max clamp is configurable.
 */
export class AdaptiveCamera {
    private camera: THREE.PerspectiveCamera;
    private contentWidth: number;
    private widthFraction: number;
    private baseFov: number;
    private minFov: number;
    private maxFov: number;
    private minDistance: number;
    private maxDistance: number;
    private tiltDeg: number;
    private marginBottom: number;
    private distance = 0;
    private lastWidth = -1;

    constructor(options: AdaptiveCameraOptions) {
        this.camera = options.camera;
        this.contentWidth = options.contentWidth;
        this.widthFraction = options.widthFraction ?? 0.9;
        this.baseFov = options.baseFov ?? 45;
        this.minFov = options.minFov ?? 20;
        this.maxFov = options.maxFov ?? 70;
        this.minDistance = options.minDistance ?? 4;
        this.maxDistance = options.maxDistance ?? 20;
        this.tiltDeg = options.tiltDeg ?? 18;
        this.marginBottom = options.marginBottom ?? 0.05;

        this.refit();
    }

    handleResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;

        if (window.innerWidth !== this.lastWidth) {
            this.refit();
        } else {
            this.positionCamera();
            this.camera.updateProjectionMatrix();
        }
    }

    private refit(): void {
        this.lastWidth = window.innerWidth;

        const aspect = window.innerWidth / window.innerHeight;
        const targetVisibleWidth = this.contentWidth / this.widthFraction;

        let fov = this.baseFov;
        let distance = this.solveDistance(targetVisibleWidth, fov, aspect);

        if (distance < this.minDistance || distance > this.maxDistance) {
            distance = THREE.MathUtils.clamp(distance, this.minDistance, this.maxDistance);
            fov = THREE.MathUtils.clamp(this.solveFov(targetVisibleWidth, distance, aspect), this.minFov, this.maxFov);
        }

        this.camera.fov = fov;
        this.camera.aspect = aspect;
        this.distance = distance;
        this.positionCamera();
        this.camera.updateProjectionMatrix();
    }

    private solveDistance(targetVisibleWidth: number, fov: number, aspect: number): number {
        const fovRad = THREE.MathUtils.degToRad(fov);
        return targetVisibleWidth / (2 * Math.tan(fovRad / 2) * aspect);
    }

    private solveFov(targetVisibleWidth: number, distance: number, aspect: number): number {
        const halfWidth = targetVisibleWidth / 2;
        const fovRad = 2 * Math.atan(halfWidth / (distance * aspect));
        return THREE.MathUtils.radToDeg(fovRad);
    }

    private positionCamera(): void {
        const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
        const visibleHeight = 2 * Math.tan(fovRad / 2) * this.distance;
        const lookAtY = visibleHeight * (0.5 - this.marginBottom);
        const tilt = THREE.MathUtils.degToRad(this.tiltDeg);

        this.camera.position.set(
            0,
            lookAtY + Math.sin(tilt) * this.distance,
            Math.cos(tilt) * this.distance
        );
        this.camera.lookAt(0, lookAtY, 0);
    }
}