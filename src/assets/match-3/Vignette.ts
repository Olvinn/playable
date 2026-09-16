export interface VignetteOptions {
    strength?: number;
    innerRadiusPercent?: number;
}

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
