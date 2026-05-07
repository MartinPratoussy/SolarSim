import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

interface Nucleon {
  kind: 'proton' | 'neutron';
  mesh: THREE.Mesh;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  locked: boolean;
  pulse: number;
}

const SCALE_INDEX = 1;
const MAX_NUCLEONS = 20;

export class Scale2Nuclear implements IScale {
  readonly name = 'Scale 2 — Nuclear';
  readonly scaleLabel = '10⁻¹⁵ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;
  private nucleons: Nucleon[] = [];
  private completed = false;
  private deuteriumLogged = false;
  private heliumCenter = new THREE.Vector2();
  private heliumPhase = 0;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x788ea8, 0.95));
    const light = new THREE.PointLight(0x9dd5ff, 8, 40, 2);
    light.position.set(0, 0, 12);
    this.scene.add(light, createBackdrop());
    this.nucleons = [];
    this.completed = false;
    this.deuteriumLogged = false;
    this.heliumCenter.set(0, 0);
    this.heliumPhase = 0;
    this.spawnNucleon('proton', -1.6, 0.3);
    this.spawnNucleon('neutron', 1.6, -0.3);
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.scene.clear();
    this.nucleons = [];
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.033);
    this.integrate(step);
    this.detectMilestones();
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    const aspect = Math.max(width / height, 1);
    this.camera.left = -8 * aspect;
    this.camera.right = 8 * aspect;
    this.camera.top = 8;
    this.camera.bottom = -8;
    this.camera.position.set(0, 0, 10);
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 2 — Nuclear (10⁻¹⁵ m)',
      body: `Inside atomic nuclei, protons and neutrons (collectively: nucleons)
are bound by the RESIDUAL strong force — a leftover effect of the
colour force between their constituent quarks.

This force is mediated by virtual pions (composite particles) and
follows a Yukawa potential: short-range attractive, dropping to zero
beyond ~3 fm.

The binding energy — the energy you'd need to pull a nucleus apart
— comes from Einstein's E=mc². The nucleus weighs LESS than the sum
of its parts. That missing mass became energy when it formed.

Helium-4 is especially stable because it has a “magic number” of
both protons and neutrons (2 each), filling the 1s nuclear shell.`,
      hint: 'Gather two protons and two neutrons. Short-range attraction wins when they get close enough.',
    });
    EventBus.emit('edu:event', { text: 'The proton and neutron from the quark scale now feel the residual strong force.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ Proton', () => this.spawnNucleon('proton')));
    actionBar.appendChild(this.makeButton('+ Neutron', () => this.spawnNucleon('neutron')));
    actionBar.appendChild(this.makeButton('+ Energy boost', () => {
      this.nucleons.forEach((nucleon) => {
        if (!nucleon.locked) {
          nucleon.velocity.add(new THREE.Vector2((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
        }
      });
      EventBus.emit('edu:event', { text: 'A burst of kinetic energy jostled the nucleons.' });
    }));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private spawnNucleon(kind: 'proton' | 'neutron', x?: number, y?: number): void {
    if (this.nucleons.length >= MAX_NUCLEONS) {
      return;
    }
    const color = kind === 'proton' ? 0x5bbcff : 0xbec8d8;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 20, 20),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }),
    );
    const position = new THREE.Vector2(
      x ?? (Math.random() - 0.5) * 8,
      y ?? (Math.random() - 0.5) * 6,
    );
    mesh.position.set(position.x, position.y, 0);
    this.scene.add(mesh);
    this.nucleons.push({
      kind,
      mesh,
      position,
      velocity: new THREE.Vector2((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6),
      locked: false,
      pulse: 0,
    });
    EventBus.emit('edu:event', { text: `${kind === 'proton' ? 'Proton' : 'Neutron'} added to the nucleus-building field.` });
  }

  private integrate(dt: number): void {
    const free = this.nucleons.filter((nucleon) => !nucleon.locked);
    const accelerations = new Map<Nucleon, THREE.Vector2>();
    free.forEach((nucleon) => accelerations.set(nucleon, nucleon.position.clone().multiplyScalar(-0.04)));
    for (let i = 0; i < free.length; i += 1) {
      for (let j = i + 1; j < free.length; j += 1) {
        const a = free[i];
        const b = free[j];
        const delta = b.position.clone().sub(a.position);
        const dist = Math.max(delta.length(), 0.3);
        const dir = delta.normalize();
        const yukawa = 1.8 * Math.exp(-dist / 1.4) / (dist * dist + 0.25);
        const repulsion = a.kind === b.kind && dist < 1.1 ? 2.4 / (dist * dist + 0.1) : 0;
        const hardCore = dist < 0.65 ? 2.2 : 0;
        const strength = yukawa - repulsion - hardCore;
        const force = dir.multiplyScalar(strength);
        accelerations.get(a)!.add(force);
        accelerations.get(b)!.sub(force);
      }
    }

    free.forEach((nucleon) => {
      nucleon.velocity.addScaledVector(accelerations.get(nucleon)!, dt);
      nucleon.velocity.multiplyScalar(0.992);
      nucleon.position.addScaledVector(nucleon.velocity, dt * 2.8);
      nucleon.mesh.position.set(nucleon.position.x, nucleon.position.y, 0);
    });

    if (this.completed) {
      this.heliumPhase += dt * 1.5;
      const locked = this.nucleons.filter((nucleon) => nucleon.locked);
      const offsets = [
        new THREE.Vector2(-0.45, 0.35),
        new THREE.Vector2(0.45, 0.35),
        new THREE.Vector2(-0.45, -0.35),
        new THREE.Vector2(0.45, -0.35),
      ];
      locked.forEach((nucleon, index) => {
        const wobble = new THREE.Vector2(Math.cos(this.heliumPhase + index) * 0.05, Math.sin(this.heliumPhase * 1.2 + index) * 0.05);
        const target = this.heliumCenter.clone().add(offsets[index] ?? new THREE.Vector2()).add(wobble);
        nucleon.position.lerp(target, 0.12);
        nucleon.mesh.position.set(nucleon.position.x, nucleon.position.y, 0);
        const material = nucleon.mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 1 + Math.sin(this.heliumPhase * 4 + index) * 0.22;
      });
    }
  }

  private detectMilestones(): void {
    if (!this.deuteriumLogged) {
      for (let i = 0; i < this.nucleons.length; i += 1) {
        for (let j = i + 1; j < this.nucleons.length; j += 1) {
          const a = this.nucleons[i];
          const b = this.nucleons[j];
          if (a.kind === b.kind) {
            continue;
          }
          if (a.position.distanceTo(b.position) < 1.2) {
            this.deuteriumLogged = true;
            EventBus.emit('edu:event', { text: 'Deuterium formed: one proton and one neutron bound with ~2.2 MeV released.' });
            EventBus.emit('toast', { title: 'Deuterium formed', body: 'Residual strong force overcame separation and released binding energy.' });
            break;
          }
        }
      }
    }
    if (this.completed || this.nucleons.length < 4) {
      return;
    }
    for (let a = 0; a < this.nucleons.length; a += 1) {
      for (let b = a + 1; b < this.nucleons.length; b += 1) {
        for (let c = b + 1; c < this.nucleons.length; c += 1) {
          for (let d = c + 1; d < this.nucleons.length; d += 1) {
            const cluster = [this.nucleons[a], this.nucleons[b], this.nucleons[c], this.nucleons[d]];
            const protons = cluster.filter((n) => n.kind === 'proton').length;
            const neutrons = cluster.filter((n) => n.kind === 'neutron').length;
            if (protons !== 2 || neutrons !== 2) {
              continue;
            }
            const centroid = cluster.reduce((acc, nucleon) => acc.add(nucleon.position), new THREE.Vector2()).multiplyScalar(0.25);
            if (cluster.some((nucleon) => nucleon.position.distanceTo(centroid) > 1.35)) {
              continue;
            }
            cluster.forEach((nucleon) => {
              nucleon.locked = true;
              nucleon.velocity.set(0, 0);
            });
            this.heliumCenter.copy(centroid);
            this.completed = true;
            EventBus.emit('edu:event', { text: 'Helium-4 assembled. Mass defect converted into ≈28.3 MeV of binding energy.' });
            EventBus.emit('toast', { title: 'Helium-4 nucleus complete', body: 'Two protons and two neutrons snapped into one of nature’s most stable light nuclei.' });
            EventBus.emit('scale:complete', { scale: SCALE_INDEX });
            return;
          }
        }
      }
    }
  }
}

function createBackdrop(): THREE.Points {
  const count = 200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 2] = -5 - Math.random() * 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdbeafe, size: 0.05, transparent: true, opacity: 0.75 }));
}
