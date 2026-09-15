export interface GameOverlayOptions {
    /** Called when the player clicks "Try Again" on either the win or lose panel. */
    onRestart: () => void;
}

/**
 * Everything drawn on top of the WebGL canvas for game state: a radial countdown ring (always
 * visible while playing), and the win/lose panels (hidden until the game ends). Plain DOM/SVG,
 * same approach as Vignette/WinOverlay before it — no need to route any of this through Three.js.
 */
export class GameOverlay {
    private timerRing: HTMLDivElement;
    private timerCircle: SVGCircleElement;
    private timerLabel: HTMLDivElement;
    private circumference: number;

    private winPanel: HTMLDivElement;
    private losePanel: HTMLDivElement;

    constructor(options: GameOverlayOptions) {
        const radius = 26;
        this.circumference = 2 * Math.PI * radius;

        this.timerRing = document.createElement('div');
        this.timerRing.style.cssText = [
            'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
            'width:64px', 'height:64px', 'z-index:8', 'pointer-events:none',
            'font-family:sans-serif',
        ].join(';');

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 64 64');
        svg.setAttribute('width', '64');
        svg.setAttribute('height', '64');
        svg.style.cssText = 'transform:rotate(-90deg)'; // so depletion sweeps from the top, clockwise

        const track = document.createElementNS(svgNS, 'circle');
        track.setAttribute('cx', '32');
        track.setAttribute('cy', '32');
        track.setAttribute('r', String(radius));
        track.setAttribute('fill', 'none');
        track.setAttribute('stroke', 'rgba(255,255,255,0.2)');
        track.setAttribute('stroke-width', '6');

        this.timerCircle = document.createElementNS(svgNS, 'circle');
        this.timerCircle.setAttribute('cx', '32');
        this.timerCircle.setAttribute('cy', '32');
        this.timerCircle.setAttribute('r', String(radius));
        this.timerCircle.setAttribute('fill', 'none');
        this.timerCircle.setAttribute('stroke', '#ffdd55');
        this.timerCircle.setAttribute('stroke-width', '6');
        this.timerCircle.setAttribute('stroke-linecap', 'round');
        this.timerCircle.setAttribute('stroke-dasharray', String(this.circumference));
        this.timerCircle.setAttribute('stroke-dashoffset', '0');

        svg.appendChild(track);
        svg.appendChild(this.timerCircle);
        this.timerRing.appendChild(svg);

        this.timerLabel = document.createElement('div');
        this.timerLabel.style.cssText = [
            'position:absolute', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
            'color:#fff', 'font-size:16px', 'font-weight:700', 'text-shadow:0 1px 4px rgba(0,0,0,0.6)',
        ].join(';');
        this.timerRing.appendChild(this.timerLabel);

        document.body.appendChild(this.timerRing);

        this.winPanel = this.buildPanel('You Win!', '#ffdd55', options.onRestart);
        this.losePanel = this.buildPanel("Time's Up!", '#ff6b6b', options.onRestart);
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

    /** 0 = full time remaining, 1 = time's up — the ring empties clockwise from full to nothing as this rises. */
    updateTimer(depletedFraction: number, secondsRemaining: number): void {
        const clamped = Math.max(0, Math.min(1, depletedFraction));
        this.timerCircle.setAttribute('stroke-dashoffset', String(this.circumference * clamped));
        this.timerLabel.textContent = String(Math.max(0, Math.ceil(secondsRemaining)));
    }

    showWin(): void {
        this.timerRing.style.display = 'none';
        this.winPanel.style.display = 'flex';
    }

    showLose(): void {
        this.timerRing.style.display = 'none';
        this.losePanel.style.display = 'flex';
    }

    dispose(): void {
        this.timerRing.remove();
        this.winPanel.remove();
        this.losePanel.remove();
    }
}
