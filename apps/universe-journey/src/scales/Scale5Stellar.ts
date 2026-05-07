import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

const SCALE_INDEX = 4;
const PARTICLE_COUNT = 200;

export class Scale5Stellar implements IScale {
  readonly name = 'Scale 5 — Stellar Ignition';
  readonly scaleLabel = '10⁸ m';

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer | null = null;
  private positions: THREE.Vector3[] = [];
  private velocities: THREE.Vector3[] = [];
  private geometry = new THREE.BufferGeometry();
  private particles = new THREE.Points();
  private star: THREE.Mesh | null = null;
  private flash: THREE.Mesh | null = null;
  private initialRadius = 7.5;
  private ignited = false;
  private overlay: HTMLDivElement | null = null;
  private tempFill: HTMLDivElement | null = null;
  private tempReadout: HTMLDivElement | null = null;
  private pressureFill: HTMLDivElement | null = null;
  private pressureReadout: HTMLDivElement | null = null;
  private hrDot: HTMLDivElement | null = null;
  private hrReadout: HTMLParagraphElement | null = null;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x52677f, 0.65));
    const light = new THREE.PointLight(0xc8f6ff, 6, 80, 2);
    light.position.set(0, 0, 10);
    this.scene.add(light, createStellarBackdrop());
    this.camera.position.set(0, 2.5, 18);
    this.positions = [];
    this.velocities = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const position = randomVectorInSphere(this.initialRadius);
      this.positions.push(position);
      this.velocities.push(new THREE.Vector3(-position.y * 0.05, position.x * 0.05, (Math.random() - 0.5) * 0.12));
    }
    this.buildParticles();
    this.star = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffdd8f, emissive: 0xffae00, emissiveIntensity: 1.2 }),
    );
    this.star.visible = false;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.18 }),
    );
    this.star.add(halo);
    this.scene.add(this.star);
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    );
    this.scene.add(this.flash);
    this.ignited = false;
    this.setupActionBar();
    this.createOverlay();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.overlay?.remove();
    this.overlay = null;
    this.tempFill = null;
    this.tempReadout = null;
    this.pressureFill = null;
    this.pressureReadout = null;
    this.hrDot = null;
    this.hrReadout = null;
    this.scene.clear();
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.03);
    this.integrate(step);
    const radius = this.computeAverageRadius();
    const temperature = Math.min(1.15e7, 3e5 + (this.initialRadius / Math.max(radius, 0.5)) * 7.5e5);
    const density = PARTICLE_COUNT / ((4 / 3) * Math.PI * Math.max(radius, 0.75) ** 3);
    const pressure = THREE.MathUtils.clamp(density * (temperature / 1e7) * 0.7, 0, 1);
    if (!this.ignited && temperature >= 1e7) {
      this.triggerIgnition();
    }
    if (this.ignited && this.flash) {
      this.flash.scale.addScalar(step * 7);
      const material = this.flash.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - step * 0.7);
    }
    this.star!.rotation.y += step * 0.25;
    this.camera.lookAt(0, 0, 0);
    this.updateOverlay(temperature, pressure);
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 5 — Stellar Ignition (10⁸ m)',
      body: `As a protostellar cloud collapses, gravitational potential energy
turns into heat. The core becomes denser, hotter, and higher-pressure
until it reaches the threshold for hydrogen fusion.

A newborn star balances gravity with pressure gradients and radiation.
That balance is called hydrostatic equilibrium. Once fusion starts, the
star can settle onto the main sequence.`,
      hint: 'Monitor temperature and pressure. Compression heats the core until fusion ignites.',
    });
    EventBus.emit('edu:event', { text: 'The protostar contracts, converting gravity into heat.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('Compression pulse', () => {
      this.velocities.forEach((velocity, index) => {
        const inward = this.positions[index].clone().normalize().multiplyScalar(-0.45);
        velocity.add(inward);
      });
      EventBus.emit('edu:event', { text: 'Compression pulse drove gas deeper into the core.' });
    }));
    actionBar.appendChild(this.makeButton('Seed rotation', () => {
      this.velocities.forEach((velocity, index) => {
        const pos = this.positions[index];
        velocity.add(new THREE.Vector3(-pos.z, 0, pos.x).normalize().multiplyScalar(0.18));
      });
      EventBus.emit('edu:event', { text: 'Angular momentum spun up the collapsing protostar.' });
    }));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private buildParticles(): void {
    const array = new Float32Array(PARTICLE_COUNT * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
    this.particles = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ color: 0xfef3c7, size: 0.18, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(this.particles);
    this.updateGeometry();
  }

  private integrate(dt: number): void {
    const accelerations = this.positions.map((position) => position.clone().multiplyScalar(-0.11));
    for (let i = 0; i < this.positions.length; i += 1) {
      for (let j = i + 1; j < this.positions.length; j += 1) {
        const delta = this.positions[j].clone().sub(this.positions[i]);
        const distSq = delta.lengthSq() + 0.8;
        const dist = Math.sqrt(distSq);
        const force = delta.multiplyScalar(0.02 / (distSq * dist));
        accelerations[i].add(force);
        accelerations[j].sub(force);
      }
    }
    for (let i = 0; i < this.positions.length; i += 1) {
      this.velocities[i].addScaledVector(accelerations[i], dt * 10);
      this.velocities[i].multiplyScalar(this.ignited ? 1.001 : 0.995);
      this.positions[i].addScaledVector(this.velocities[i], dt * 3.8);
      if (this.ignited) {
        this.velocities[i].addScaledVector(this.positions[i].clone().normalize(), dt * 0.12);
      }
    }
    this.updateGeometry();
  }

  private updateGeometry(): void {
    const attribute = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.positions.forEach((position, index) => {
      attribute.setXYZ(index, position.x, position.y, position.z);
    });
    attribute.needsUpdate = true;
  }

  private computeAverageRadius(): number {
    return this.positions.reduce((sum, position) => sum + position.length(), 0) / this.positions.length;
  }

  private triggerIgnition(): void {
    this.ignited = true;
    this.star!.visible = true;
    this.velocities.forEach((velocity, index) => {
      velocity.add(this.positions[index].clone().normalize().multiplyScalar(0.8));
    });
    if (this.flash) {
      this.flash.scale.setScalar(1);
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.8;
    }
    EventBus.emit('edu:event', { text: 'Core temperature crossed 10⁷ K. Proton-proton fusion ignited.' });
    EventBus.emit('toast', { title: 'Fusion ignition', body: 'Radiation pressure pushed back against gravity and a true star was born.' });
    EventBus.emit('scale:complete', { scale: SCALE_INDEX });
  }

  private createOverlay(): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'stellar-widgets';
    wrapper.innerHTML = `
      <div class="overlay-card stellar-widget">
        <h3>Core Temperature</h3>
        <div class="meter"><div id="stellar-temp-fill" class="meter-fill"></div></div>
        <div id="stellar-temp-readout" class="readout">0 K</div>
      </div>
      <div class="overlay-card stellar-widget">
        <h3>Pressure Support</h3>
        <div class="meter"><div id="stellar-pressure-fill" class="meter-fill"></div></div>
        <div id="stellar-pressure-readout" class="readout">0%</div>
      </div>
      <div class="overlay-card stellar-widget">
        <h3>H-R Diagram</h3>
        <div class="hr-diagram"><div id="stellar-hr-dot" class="hr-dot"></div></div>
        <p id="stellar-hr-readout" class="readout">Protostar track</p>
      </div>
    `;
    document.body.appendChild(wrapper);
    this.overlay = wrapper;
    this.tempFill = wrapper.querySelector('#stellar-temp-fill');
    this.tempReadout = wrapper.querySelector('#stellar-temp-readout');
    this.pressureFill = wrapper.querySelector('#stellar-pressure-fill');
    this.pressureReadout = wrapper.querySelector('#stellar-pressure-readout');
    this.hrDot = wrapper.querySelector('#stellar-hr-dot');
    this.hrReadout = wrapper.querySelector('#stellar-hr-readout');
  }

  private updateOverlay(temperature: number, pressure: number): void {
    const tempFraction = THREE.MathUtils.clamp(temperature / 1e7, 0, 1);
    if (this.tempFill && this.tempReadout && this.pressureFill && this.pressureReadout && this.hrDot && this.hrReadout) {
      this.tempFill.style.width = `${Math.round(tempFraction * 100)}%`;
      this.tempFill.style.background = tempFraction < 0.35 ? '#60a5fa' : tempFraction < 0.7 ? '#f8fafc' : tempFraction < 0.9 ? '#fde68a' : '#fb923c';
      this.tempReadout.textContent = `${temperature.toExponential(2)} K`;
      this.pressureFill.style.width = `${Math.round(pressure * 100)}%`;
      this.pressureFill.style.background = 'linear-gradient(90deg, #63b3ff, #f59e0b)';
      this.pressureReadout.textContent = `${Math.round(pressure * 100)}% of ignition support`;
      const x = 88 - tempFraction * 72;
      const luminosity = THREE.MathUtils.clamp((temperature / 1e7) * (this.ignited ? 1.15 : 0.7), 0.05, 1);
      const y = 88 - luminosity * 72;
      this.hrDot.style.left = `${x}%`;
      this.hrDot.style.top = `${y}%`;
      this.hrReadout.textContent = this.ignited ? 'Main-sequence ignition point reached' : 'Protostar climbing toward fusion';
    }
  }
}

function createStellarBackdrop(): THREE.Points {
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 34;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 2] = -12 - Math.random() * 14;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdbeafe, size: 0.07, transparent: true, opacity: 0.6 }));
}

function randomVectorInSphere(radius: number): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = u * 2 * Math.PI;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  );
}
