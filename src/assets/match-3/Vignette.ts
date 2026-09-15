export interface VignetteOptions {
    /** How dark the corners get, 0-1. */
    strength?: number;
    /** Percent of the way to the edge where darkening starts. */
    innerRadiusPercent?: number;
}

/** A static full-screen radial darkening overlay — purely cosmetic, sits above the canvas. */
export class Vignette {
    private element: HTMLDivElement;

    constructor(options: VignetteOptions = {}) {
        const strength = options.strength ?? 0.65;
        const innerRadiusPercent = options.innerRadiusPercent ?? 55;

        this.element = document.createElement('div');
        this.element.style.cssText = [
            'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:5',
            `background:radial-gradient(ellipse at center, rgba(0,0,0,0) ${innerRadiusPercent}%, rgba(0,0,0,${strength}) 100%)`,
        ].join(';');
        document.body.appendChild(this.element);
    }

    dispose(): void {
        this.element.remove();
    }
}
