import { EventBus } from './EventBus';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export class EduPanel {
  private readonly title = document.getElementById('edu-title') as HTMLHeadingElement;
  private readonly body = document.getElementById('edu-body') as HTMLDivElement;
  private readonly equation = document.getElementById('edu-equation') as HTMLDivElement;
  private readonly hint = document.getElementById('edu-hint') as HTMLDivElement;
  private readonly events = document.getElementById('edu-events') as HTMLDivElement;
  private readonly toast = document.getElementById('toast') as HTMLDivElement;
  private readonly progressContainer = document.getElementById('progress-bar-container') as HTMLDivElement;
  private readonly progressFill = document.getElementById('progress-fill') as HTMLDivElement;
  private readonly progressLabel = document.getElementById('progress-label') as HTMLSpanElement;
  private toastTimer: number | null = null;

  constructor() {
    EventBus.on('edu:update', ({ title, body, equation, hint }) => {
      this.title.textContent = title;
      this.body.innerHTML = body;
      this.equation.innerHTML = equation
        ? katex.renderToString(equation, { displayMode: true, throwOnError: false, output: 'html' })
        : '';
      this.equation.style.display = equation ? 'block' : 'none';
      this.hint.textContent = hint ?? '';
      this.hint.style.display = hint ? 'block' : 'none';
      this.events.innerHTML = '';
      this.progressContainer.style.display = 'none';
    });

    EventBus.on('edu:event', ({ text }) => {
      const row = document.createElement('div');
      row.textContent = text;
      this.events.prepend(row);
      while (this.events.children.length > 12) {
        this.events.removeChild(this.events.lastElementChild as Element);
      }
    });

    EventBus.on('toast', ({ title, body }) => {
      this.showToast(title, body);
    });

    EventBus.on('progress', ({ value }) => {
      this.progressContainer.style.display = 'block';
      this.progressFill.style.width = `${Math.round(value * 100)}%`;
      this.progressLabel.textContent = `${Math.round(value * 100)}%`;
    });
  }

  private showToast(title: string, body: string): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toast.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
    this.toast.classList.remove('visible');
    void this.toast.offsetWidth;
    this.toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 3500);
  }
}
