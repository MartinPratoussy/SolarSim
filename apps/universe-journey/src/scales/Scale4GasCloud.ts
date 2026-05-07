import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

const SCALE_INDEX = 3;
const MAX_ATOMS = 400;

export class Scale4GasCloud implements IScale {
  readonly name = 'Scale 4 — Gas Cloud';
  readonly scaleLabel = '10¹² m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 60);
  private renderer: THREE.WebGLRenderer | null = null;
  private positions: THREE.Vector2[] = [];
  private velocities: THREE.Vector2[] = [];
  private geometry = new THREE.BufferGeometry();
  private points = new THREE.Points();
  private progress = 0;
  private gravityEnabled = true;
  private collapsed = false;
  private thermalLevel = 1;
  private gravityButton: HTMLButtonElement | null = null;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x6c86a2, 0.8));
    this.scene.add(createBackdropCloud());
    this.positions = [];
    this.velocities = [];
    this.progress = 0;
    this.gravityEnabled = true;
    this.collapsed = false;
    this.thermalLevel = 1;
    this.spawnAtoms(300);
    this.buildPoints();
    this.setupActionBar();
    document.getElementById('progress-bar-container')!.style.display = 'block';
    EventBus.emit('progress', { value: 0 });
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.scene.clear();
    this.positions = [];
    this.velocities = [];
    this.renderer = null;
    this.gravityButton = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.03);
    this.integrate(step);
    this.updatePointGeometry();
    this.updateProgress();
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    const aspect = Math.max(width / height, 1);
    this.camera.left = -10 * aspect;
    this.camera.right = 10 * aspect;
    this.camera.top = 8;
    this.camera.bottom = -8;
    this.camera.position.set(0, 0, 18);
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 4 — Gas Cloud (10¹² m)',
      body: `Cold hydrogen gas drifting through interstellar space can become
unstable under its own gravity. Random motions and pressure push outward,
while gravity pulls inward. If enough matter gathers in a large enough
region, self-gravity wins and the cloud collapses.

That threshold is captured by the Jeans criterion. A slightly spinning
cloud does not fall straight inward forever — conservation of angular
momentum helps flatten it into a rotating protostellar disk.`,
      equation: `Jeans mass criterion:
M_J = (5kT/Gm)^(3/2) · (3/4πρ)^(1/2)

k = Boltzmann constant
T = temperature
G = gravitational constant
m = mean particle mass
ρ = gas density

When cloud mass > M_J → gravitational collapse!
Angular momentum → disk formation`,
      hint: 'Add atoms, cool the cloud, and watch the Jeans instability bar climb toward collapse.',
    });
    EventBus.emit('edu:event', { text: 'A diffuse hydrogen nebula drifts near the threshold of instability.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ 20 H atoms', () => this.spawnAtoms(20)));
    this.gravityButton = this.makeButton('Disable gravity', () => {
      this.gravityEnabled = !this.gravityEnabled;
      this.gravityButton!.textContent = this.gravityEnabled ? 'Disable gravity' : 'Enable gravity';
      EventBus.emit('edu:event', { text: this.gravityEnabled ? 'Gravity re-enabled.' : 'Gravity paused; only thermal drift remains.' });
    });
    actionBar.appendChild(this.gravityButton);
    actionBar.appendChild(this.makeButton('Cool cloud', () => {
      this.thermalLevel = Math.max(0.35, this.thermalLevel * 0.86);
      this.velocities.forEach((velocity) => velocity.multiplyScalar(0.82));
      EventBus.emit('edu:event', { text: 'Thermal motion dropped, lowering the Jeans threshold.' });
    }));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private spawnAtoms(count: number): void {
    const remaining = Math.min(count, MAX_ATOMS - this.positions.length);
    for (let i = 0; i < remaining; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 7.5;
      const position = new THREE.Vector2(Math.cos(theta) * radius, Math.sin(theta) * radius * 0.75);
      this.positions.push(position);
      this.velocities.push(new THREE.Vector2(randomGaussian() * 0.55 * this.thermalLevel, randomGaussian() * 0.42 * this.thermalLevel));
    }
    if (remaining > 0) {
      EventBus.emit('edu:event', { text: `${remaining} hydrogen atoms joined the cloud.` });
    }
  }

  private buildPoints(): void {
    const positions = new Float32Array(MAX_ATOMS * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, this.positions.length);
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ color: 0x9ddcff, size: 0.11, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(this.points);
    this.updatePointGeometry();
  }

  private integrate(dt: number): void {
    const accelerations = this.positions.map(() => new THREE.Vector2());
    if (this.gravityEnabled) {
      for (let i = 0; i < this.positions.length; i += 1) {
        for (let j = i + 1; j < this.positions.length; j += 1) {
          const delta = this.positions[j].clone().sub(this.positions[i]);
          const distSq = delta.lengthSq() + 0.6;
          const dist = Math.sqrt(distSq);
          const force = delta.multiplyScalar(0.012 / (distSq * dist));
          accelerations[i].add(force);
          accelerations[j].sub(force);
        }
      }
    }

    for (let i = 0; i < this.positions.length; i += 1) {
      const position = this.positions[i];
      const velocity = this.velocities[i];
      if (!this.collapsed) {
        velocity.x += randomGaussian() * dt * 0.05 * this.thermalLevel;
        velocity.y += randomGaussian() * dt * 0.05 * this.thermalLevel;
      }
      velocity.addScaledVector(accelerations[i], dt * 12);
      if (this.collapsed) {
        const inward = position.clone().multiplyScalar(-0.22 * dt);
        const tangential = new THREE.Vector2(-position.y, position.x).normalize().multiplyScalar(0.16 * dt);
        velocity.add(inward).add(tangential);
      }
      velocity.multiplyScalar(0.998 - (1 - this.thermalLevel) * 0.0015);
      position.addScaledVector(velocity, dt * 5.5);
    }
  }

  private updatePointGeometry(): void {
    const attribute = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.positions.forEach((position, index) => {
      attribute.setXYZ(index, position.x, position.y, 0);
    });
    this.geometry.setDrawRange(0, this.positions.length);
    attribute.needsUpdate = true;
  }

  private updateProgress(): void {
    const cloudRadius = Math.max(2.2, this.positions.reduce((max, position) => Math.max(max, position.length()), 0));
    const density = this.positions.length / (Math.PI * cloudRadius * cloudRadius);
    const threshold = 2.05 * this.thermalLevel;
    this.progress = THREE.MathUtils.clamp(density / threshold, 0, 1);
    EventBus.emit('progress', { value: this.progress });
    if (!this.collapsed && this.progress >= 1) {
      this.collapsed = true;
      this.velocities.forEach((velocity, index) => {
        const direction = this.positions[index].clone().normalize().multiplyScalar(-0.85);
        const tangential = new THREE.Vector2(-this.positions[index].y, this.positions[index].x).normalize().multiplyScalar(0.4);
        velocity.add(direction).add(tangential);
      });
      EventBus.emit('edu:event', { text: 'Jeans instability reached 100%. Gravity has triggered a runaway collapse.' });
      EventBus.emit('toast', { title: 'Gravitational collapse!', body: 'Density passed the Jeans threshold and the nebula began to flatten into a spinning disk.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }
}

function createBackdropCloud(): THREE.Points {
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = -8 - Math.random() * 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.65 }));
}

function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
