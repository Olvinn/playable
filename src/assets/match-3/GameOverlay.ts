export interface GameOverlayOptions {
    onRestart: () => void;
}

export class GameOverlay {
    private winPanel: HTMLDivElement;
    private losePanel: HTMLDivElement;

    constructor(options: GameOverlayOptions) {
        this.winPanel = this.buildPanel('You Win!', '#ffdd55', options.onRestart);
        this.losePanel = this.buildPanel('Caught!', '#ff6b6b', options.onRestart);
    }

    private buildPanel(message: string, color: string, onRestart: () => void): HTMLDivElement {
        const panel = document.createElement('div');
        panel.style.cssText = [
            'position:fixed', 'inset:0', 'display:none', 'flex-direction:column', 'gap:24px',
            'align-items:center', 'justify-content:center',
            'background:rgba(10,10,20,0.75)', 'z-index:10', 'font-family:sans-serif',
        ].join(';');

        const label = document.createElement('div');
        label.textContent = message;
        label.style.cssText = [
            `color:${color}`, 'font-size:min(12vw,64px)', 'font-weight:700',
            'text-shadow:0 2px 10px rgba(0,0,0,0.8)',
        ].join(';');
        panel.appendChild(label);

        const button = document.createElement('button');
        button.textContent = 'Try Again';
        button.style.cssText = [
            'padding:14px 36px', 'font-size:20px', 'font-weight:700', 'font-family:sans-serif',
            'color:#1a1a2e', `background:${color}`, 'border:none', 'border-radius:999px',
            'cursor:pointer', 'pointer-events:auto', 'box-shadow:0 4px 14px rgba(0,0,0,0.4)',
        ].join(';');
        button.addEventListener('click', onRestart);
        panel.appendChild(button);

        document.body.appendChild(panel);
        return panel;
    }

    showWin(): void {
        this.winPanel.style.display = 'flex';
    }

    showLose(): void {
        this.losePanel.style.display = 'flex';
    }

    dispose(): void {
        this.winPanel.remove();
        this.losePanel.remove();
    }
}
