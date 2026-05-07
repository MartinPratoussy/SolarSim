import { EventBus } from './EventBus';
import { ScaleManager } from './ScaleManager';

export class HUD {
  private readonly dots = Array.from(document.querySelectorAll<HTMLSpanElement>('#scale-dots .dot'));
  private readonly label = document.getElementById('scale-label') as HTMLDivElement;

  constructor(private readonly manager: ScaleManager) {
    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const scale = Number(dot.dataset.scale ?? '0');
        void this.manager.goto(scale);
      });
    });
    EventBus.on('scale:change', () => {
      this.render();
    });
    this.render();
  }

  private render(): void {
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.manager.current);
      dot.classList.toggle('done', this.manager.completed.has(index));
    });
    const scale = this.manager.currentScale;
    this.label.textContent = `${scale.name} (${scale.scaleLabel})`;
  }
}
