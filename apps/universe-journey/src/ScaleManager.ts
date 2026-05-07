import * as THREE from 'three';
import { EventBus } from './EventBus';

export interface IScale {
  init(container: HTMLElement, renderer: THREE.WebGLRenderer): void;
  dispose(): void;
  update(dt: number): void;
  onResize(w: number, h: number): void;
  readonly name: string;
  readonly scaleLabel: string;
}

export class ScaleManager {
  current = 0;
  completed: Set<number> = new Set();

  private readonly fadeOverlay: HTMLDivElement;
  private transitioning = false;

  constructor(
    private readonly scales: IScale[],
    private readonly container: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.id = 'scale-fade';
    document.body.appendChild(this.fadeOverlay);
    EventBus.on('scale:complete', ({ scale }) => {
      this.onComplete(scale);
    });
  }

  get currentScale(): IScale {
    return this.scales[this.current];
  }

  start(): void {
    this.currentScale.init(this.container, this.renderer);
    this.currentScale.onResize(window.innerWidth, window.innerHeight);
    EventBus.emit('scale:change', { scale: this.current });
  }

  async goto(n: number): Promise<void> {
    if (this.transitioning || n < 0 || n >= this.scales.length || n === this.current) {
      return;
    }
    this.transitioning = true;
    await this.fadeTo(1);
    this.currentScale.dispose();
    this.current = n;
    this.currentScale.init(this.container, this.renderer);
    this.currentScale.onResize(window.innerWidth, window.innerHeight);
    EventBus.emit('scale:change', { scale: this.current });
    await this.fadeTo(0);
    this.transitioning = false;
  }

  next(): void {
    if (this.current < this.scales.length - 1) {
      void this.goto(this.current + 1);
    }
  }

  skip(): void {
    this.next();
  }

  onComplete(n: number): void {
    if (n !== this.current || this.completed.has(n)) {
      return;
    }
    this.completed.add(n);
    const scale = this.scales[n];
    EventBus.emit('toast', {
      title: `${scale.name} complete`,
      body: n < this.scales.length - 1 ? 'Advancing to the next scale of the universe journey…' : 'You reached the end of the journey.',
    });
    if (n < this.scales.length - 1) {
      window.setTimeout(() => {
        void this.goto(n + 1);
      }, 2000);
    }
    EventBus.emit('scale:change', { scale: this.current });
  }

  private async fadeTo(value: number): Promise<void> {
    this.fadeOverlay.style.opacity = `${value}`;
    await new Promise((resolve) => {
      window.setTimeout(resolve, 380);
    });
  }
}
