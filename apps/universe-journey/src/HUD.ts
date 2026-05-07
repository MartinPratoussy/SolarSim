import { EventBus } from './EventBus';
import { ScaleManager } from './ScaleManager';

export class HUD {
  private readonly dots = Array.from(document.querySelectorAll<HTMLSpanElement>('#scale-dots .dot'));
  private readonly label = document.getElementById('scale-label') as HTMLDivElement;
  private readonly continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;

  constructor(private readonly manager: ScaleManager) {
    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const scale = Number(dot.dataset.scale ?? '0');
        void this.manager.goto(scale);
      });
    });

    this.continueBtn.addEventListener('click', () => {
      this.continueBtn.style.display = 'none';
      this.manager.next();
    });

    EventBus.on('scale:change', () => {
      this.continueBtn.style.display = 'none';
      this.render();
    });

    EventBus.on('scale:ready', () => {
      this.continueBtn.style.display = 'inline-flex';
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
