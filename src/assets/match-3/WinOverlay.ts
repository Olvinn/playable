/** Full-screen "You Win!" banner, hidden until show() is called. */
export class WinOverlay {
    private element: HTMLDivElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.style.cssText = [
            'position:fixed', 'inset:0', 'display:none', 'align-items:center', 'justify-content:center',
            'background:rgba(10,10,20,0.7)', 'z-index:10', 'font-family:sans-serif', 'pointer-events:none',
        ].join(';');

        const label = document.createElement('div');
        label.textContent = 'You Win!';
        label.style.cssText = [
            'color:#ffdd55', 'font-size:min(12vw,64px)', 'font-weight:700',
            'text-shadow:0 2px 10px rgba(0,0,0,0.8)',
        ].join(';');
        this.element.appendChild(label);

        document.body.appendChild(this.element);
    }

    show(): void {
        this.element.style.display = 'flex';
    }

    dispose(): void {
        this.element.remove();
    }
}
