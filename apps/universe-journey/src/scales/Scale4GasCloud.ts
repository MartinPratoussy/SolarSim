import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';
import { mathHtml } from '../EduPanel';

const SCALE_INDEX = 3;
const MAX_ATOMS = 500;
const SHOCKWAVE_IMPULSE = 4.2;
const SHOCKWAVE_RADIUS  = 3.5;

export class Scale4GasCloud implements IScale {
  readonly name = 'Scale 4 — Gas Cloud';
  readonly scaleLabel = '10¹² m';

  private scene    = new THREE.Scene();
  private camera   = new THREE.OrthographicCamera(-8.5, 8.5, 5.5, -5.5, 0.1, 60);
  private renderer: THREE.WebGLRenderer | null = null;

  private positions:  THREE.Vector2[] = [];
  private velocities: THREE.Vector2[] = [];
  private geometry  = new THREE.BufferGeometry();
  private points    = new THREE.Points();

  private progress      = 0;
  private gravityEnabled = true;
  private collapsed     = false;
  private thermalLevel  = 1;
  private gravityButton: HTMLButtonElement | null = null;

  // shockwave ring visuals
  private rings: Array<{ mesh: THREE.Mesh; life: number }> = [];

  private clickHandler: ((e: MouseEvent) => void) | null = null;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(createBackdropCloud());
    this.positions    = [];
    this.velocities   = [];
    this.rings        = [];
    this.progress     = 0;
    this.gravityEnabled = true;
    this.collapsed    = false;
    this.thermalLevel = 1;
    this.spawnAtoms(380);
    this.buildPoints();
    this.setupActionBar();
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);

    // Click → shockwave
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);
    renderer.domElement.addEventListener('click', this.clickHandler);

    document.getElementById('progress-bar-container')!.style.display = 'block';
    EventBus.emit('progress', { value: 0 });
    this.emitEducation();
  }

  dispose(): void {
    if (this.renderer && this.clickHandler) {
      this.renderer.domElement.removeEventListener('click', this.clickHandler);
    }
    this.clickHandler = null;
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.scene.clear();
    this.positions  = [];
    this.velocities = [];
    this.rings      = [];
    this.renderer   = null;
    this.gravityButton = null;
  }

  update(dt: number): void {
    if (!this.renderer) return;
    const step = Math.min(dt, 0.03);
    this.integrate(step);
    this.updatePointGeometry();
    this.updateProgress();
    this.updateRings(step);
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    const aspect = Math.max(width / height, 1);
    this.camera.left   = -5.5 * aspect;
    this.camera.right  =  5.5 * aspect;
    this.camera.top    =  5.5;
    this.camera.bottom = -5.5;
    this.camera.position.set(0, 0, 18);
    this.camera.updateProjectionMatrix();
  }

  // ── Click → shockwave ─────────────────────────────────────────────────────

  private handleClick(e: MouseEvent): void {
    if (!this.renderer) return;
    const rect  = this.renderer.domElement.getBoundingClientRect();
    const ndcX  = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY  = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    const wx    = ndcX * this.camera.right;
    const wy    = ndcY * this.camera.top;
    this.shockwave(wx, wy);
  }

  private shockwave(cx: number, cy: number): void {
    const origin = new THREE.Vector2(cx, cy);
    let pushed   = 0;
    this.positions.forEach((pos, i) => {
      const delta = pos.clone().sub(origin);
      const dist  = delta.length();
      if (dist < SHOCKWAVE_RADIUS && dist > 0.01) {
        const strength = SHOCKWAVE_IMPULSE * (1 - dist / SHOCKWAVE_RADIUS);
        this.velocities[i].addScaledVector(delta.normalize(), strength);
        pushed++;
      }
    });
    this.spawnRing(cx, cy);
    EventBus.emit('edu:event', { text: `💥 Shockwave sent — ${pushed} atoms scattered. Can disrupt collapse or trigger fragmentation.` });
  }

  private spawnRing(cx: number, cy: number): void {
    const geo  = new THREE.RingGeometry(0.08, 0.18, 48);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, 0.1);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 1 });
  }

  private updateRings(dt: number): void {
    this.rings = this.rings.filter(r => {
      r.life -= dt * 1.4;
      const s   = 1 + (1 - r.life) * (SHOCKWAVE_RADIUS / 0.18);
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, r.life * 0.85);
      if (r.life <= 0) { this.scene.remove(r.mesh); return false; }
      return true;
    });
  }

  // ── Edu panel ─────────────────────────────────────────────────────────────

  private emitEducation(): void {
    const jeans = mathHtml('M_J \\approx \\left(\\frac{5kT}{Gm}\\right)^{3/2} \\left(\\frac{3}{4\\pi\\rho}\\right)^{1/2}');
    EventBus.emit('edu:update', {
      title: 'Scale 4 — Gas Cloud (10¹² m)',
      body: `
<p>Cold hydrogen gas drifting through interstellar space can become
unstable under its own gravity. Random thermal motions push <em>outward</em>;
gravity pulls <em>inward</em>. When enough matter gathers in a cold enough
region, self-gravity wins — the cloud collapses into a <span class="edu-highlight">protostellar disk</span>.</p>

<hr/>

<div class="edu-section">
  <div class="edu-card-name">Jeans Mass</div>
  <div class="edu-card-sub">The minimum cloud mass needed for gravity to overcome thermal pressure:</div>
  ${jeans}
  <div class="edu-card-sub" style="margin-top:6px">
    <em>k</em> = Boltzmann constant &nbsp;·&nbsp; <em>T</em> = temperature &nbsp;·&nbsp; <em>G</em> = gravity &nbsp;·&nbsp; <em>ρ</em> = density
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-card-name">How to play</div>
  <div class="edu-card-sub">🖱 <strong>Click the cloud</strong> to fire a shockwave — disrupts or fragments the collapse.</div>
  <div class="edu-card-sub">❄️ <strong>Cool the cloud</strong> to drop thermal pressure and push toward Jeans instability.</div>
  <div class="edu-card-sub">➕ <strong>Add atoms</strong> to raise density and climb the Jeans progress bar.</div>
</div>`,
      hint: 'Cool + add atoms to collapse. Click to fire shockwaves.',
    });
    EventBus.emit('edu:event', { text: 'A diffuse hydrogen nebula drifts near the threshold of instability.' });
  }

  // ── Action bar ────────────────────────────────────────────────────────────

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ 20 H atoms', () => this.spawnAtoms(20)));
    this.gravityButton = this.makeButton('Disable gravity', () => {
      this.gravityEnabled = !this.gravityEnabled;
      this.gravityButton!.textContent = this.gravityEnabled ? 'Disable gravity' : 'Enable gravity';
      EventBus.emit('edu:event', { text: this.gravityEnabled ? 'Gravity re-enabled.' : 'Gravity paused — only thermal drift remains.' });
    });
    actionBar.appendChild(this.gravityButton);
    actionBar.appendChild(this.makeButton('❄️ Cool cloud', () => {
      this.thermalLevel = Math.max(0.25, this.thermalLevel * 0.8);
      this.velocities.forEach(v => v.multiplyScalar(0.78));
      EventBus.emit('edu:event', { text: '❄️ Thermal motion dropped — Jeans threshold lowered.' });
    }));
    actionBar.appendChild(this.makeButton('🔥 Heat cloud', () => {
      this.thermalLevel = Math.min(2.0, this.thermalLevel * 1.35);
      this.velocities.forEach(v => v.multiplyScalar(1.25));
      EventBus.emit('edu:event', { text: '🔥 Thermal pressure raised — cloud resists collapse.' });
    }));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ── Particle spawning ─────────────────────────────────────────────────────

  private spawnAtoms(count: number): void {
    const remaining = Math.min(count, MAX_ATOMS - this.positions.length);
    for (let i = 0; i < remaining; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 10.5;
      this.positions.push(new THREE.Vector2(Math.cos(theta) * radius, Math.sin(theta) * radius * 0.82));
      this.velocities.push(new THREE.Vector2(
        randomGaussian() * 0.55 * this.thermalLevel,
        randomGaussian() * 0.42 * this.thermalLevel,
      ));
    }
    if (remaining > 0) EventBus.emit('edu:event', { text: `${remaining} hydrogen atoms joined the cloud.` });
  }

  // ── Three.js geometry ─────────────────────────────────────────────────────

  private buildPoints(): void {
    const posArr   = new Float32Array(MAX_ATOMS * 3);
    const colorArr = new Float32Array(MAX_ATOMS * 3);
    this.geometry  = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.geometry.setAttribute('color',    new THREE.BufferAttribute(colorArr, 3));
    this.geometry.setDrawRange(0, this.positions.length);
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ vertexColors: true, size: 0.34, transparent: true, opacity: 0.96, sizeAttenuation: true }),
    );
    this.scene.add(this.points);
    this.updatePointGeometry();
  }

  private updatePointGeometry(): void {
    const posAttr   = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = this.geometry.getAttribute('color')    as THREE.BufferAttribute;

    // Build a quick local density estimate per particle (count neighbours within r=2)
    const SAMPLE_RADIUS_SQ = 4.0;
    const densities = this.positions.map((p, i) => {
      let n = 0;
      for (let j = 0; j < this.positions.length; j++) {
        if (i === j) continue;
        if (this.positions[j].distanceToSquared(p) < SAMPLE_RADIUS_SQ) n++;
      }
      return n;
    });
    const maxD = Math.max(1, ...densities);

    // Dense → bright blue (#5eaaff), sparse → dim purple (#6d28d9)
    const denseColor  = new THREE.Color(0x5eaaff);
    const sparseColor = new THREE.Color(0x6d28d9);
    const c = new THREE.Color();

    this.positions.forEach((pos, idx) => {
      posAttr.setXYZ(idx, pos.x, pos.y, 0);
      const t = densities[idx] / maxD;
      c.lerpColors(sparseColor, denseColor, t);
      colorAttr.setXYZ(idx, c.r, c.g, c.b);
    });
    this.geometry.setDrawRange(0, this.positions.length);
    posAttr.needsUpdate   = true;
    colorAttr.needsUpdate = true;
  }

  // ── Physics ───────────────────────────────────────────────────────────────

  private integrate(dt: number): void {
    const accs = this.positions.map(() => new THREE.Vector2());
    if (this.gravityEnabled) {
      for (let i = 0; i < this.positions.length; i++) {
        for (let j = i + 1; j < this.positions.length; j++) {
          const delta = this.positions[j].clone().sub(this.positions[i]);
          const distSq = delta.lengthSq() + 0.6;
          const dist   = Math.sqrt(distSq);
          const force  = delta.multiplyScalar(0.012 / (distSq * dist));
          accs[i].add(force);
          accs[j].sub(force);
        }
      }
    }
    for (let i = 0; i < this.positions.length; i++) {
      const pos = this.positions[i];
      const vel = this.velocities[i];
      if (!this.collapsed) {
        vel.x += randomGaussian() * dt * 0.05 * this.thermalLevel;
        vel.y += randomGaussian() * dt * 0.05 * this.thermalLevel;
      }
      vel.addScaledVector(accs[i], dt * 12);
      if (this.collapsed) {
        const inward     = pos.clone().multiplyScalar(-0.22 * dt);
        const tangential = new THREE.Vector2(-pos.y, pos.x).normalize().multiplyScalar(0.16 * dt);
        vel.add(inward).add(tangential);
      }
      vel.multiplyScalar(0.998 - (1 - this.thermalLevel) * 0.0015);
      pos.addScaledVector(vel, dt * 5.5);
    }
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  private updateProgress(): void {
    const cloudRadius = Math.max(2.2, this.positions.reduce((m, p) => Math.max(m, p.length()), 0));
    const density     = this.positions.length / (Math.PI * cloudRadius * cloudRadius);
    const threshold   = 2.05 * this.thermalLevel;
    this.progress     = THREE.MathUtils.clamp(density / threshold, 0, 1);
    EventBus.emit('progress', { value: this.progress });
    if (!this.collapsed && this.progress >= 1) {
      this.collapsed = true;
      this.velocities.forEach((vel, i) => {
        const dir = this.positions[i].clone().normalize().multiplyScalar(-0.85);
        const tan = new THREE.Vector2(-this.positions[i].y, this.positions[i].x).normalize().multiplyScalar(0.4);
        vel.add(dir).add(tan);
      });
      EventBus.emit('edu:event', { text: '🌀 Jeans instability 100% — runaway gravitational collapse begins!' });
      EventBus.emit('toast', { title: 'Gravitational collapse!', body: 'Density passed the Jeans threshold — the nebula flattens into a spinning protostellar disk.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }
}

function createBackdropCloud(): THREE.Points {
  const count     = 500;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const starColors = [
    new THREE.Color(0xffffff), new THREE.Color(0xadd8ff),
    new THREE.Color(0xffe8b0), new THREE.Color(0xc8b4ff),
  ];
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 2] = -8 - Math.random() * 12;
    const c = starColors[Math.floor(Math.random() * starColors.length)];
    const brightness = 0.4 + Math.random() * 0.6;
    colors[i * 3]     = c.r * brightness;
    colors[i * 3 + 1] = c.g * brightness;
    colors[i * 3 + 2] = c.b * brightness;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 0.055, transparent: true, opacity: 0.75 }));
}

function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
