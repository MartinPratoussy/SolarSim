import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

type Flavor = 'u' | 'd' | 's';
type ColorCharge = 'R' | 'G' | 'B';

interface Quark {
  id: number;
  flavor: Flavor;
  colorCharge: ColorCharge;
  mass: number;
  mesh: THREE.Mesh;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  locked: boolean;
  flash: number;
}

interface Hadron {
  id: number;
  kind: 'Proton' | 'Neutron' | 'Hadron';
  quarks: Quark[];
  center: THREE.Vector2;
  drift: THREE.Vector2;
  phase: number;
  line: THREE.LineSegments;
  label: THREE.Sprite;
}

const SCALE_INDEX = 0;
const CONFINE_RADIUS = 1.8;
const MAX_QUARKS = 20;
const COLOR_ORDER: ColorCharge[] = ['R', 'G', 'B'];
const FLAVOR_CONFIG: Record<Flavor, { label: string; color: number; mass: number }> = {
  u: { label: 'Up quark', color: 0xa6d8ff, mass: 1 },
  d: { label: 'Down quark', color: 0xff8356, mass: 1.18 },
  s: { label: 'Strange quark', color: 0xcdfb6d, mass: 1.8 },
};

export class Scale1Quarks implements IScale {
  readonly name = 'Scale 1 — Quark Field';
  readonly scaleLabel = '10⁻¹⁸ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;
  private quarks: Quark[] = [];
  private hadrons: Hadron[] = [];
  private spawnMode: Flavor | null = 'u';
  private buttonMap = new Map<Flavor, HTMLButtonElement>();
  private formedKinds = new Set<string>();
  private completed = false;
  private nextId = 1;
  private nextHadronId = 1;

  private readonly handleCanvasClick = (event: MouseEvent) => {
    if (!this.renderer || !this.spawnMode || this.quarks.length >= MAX_QUARKS) {
      return;
    }
    const point = this.pointerToWorld(event.clientX, event.clientY);
    this.spawnQuark(this.spawnMode, point.x, point.y);
  };

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x6688aa, 0.9));
    const keyLight = new THREE.PointLight(0x63b3ff, 7, 40, 2);
    keyLight.position.set(0, 0, 10);
    this.scene.add(keyLight, createStarfield(180, 18));
    this.quarks = [];
    this.hadrons = [];
    this.formedKinds.clear();
    this.completed = false;
    this.spawnMode = 'u';
    renderer.domElement.addEventListener('click', this.handleCanvasClick);
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    this.renderer?.domElement.removeEventListener('click', this.handleCanvasClick);
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.scene.clear();
    this.quarks = [];
    this.hadrons = [];
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.033);
    this.integrateFreeQuarks(step);
    this.updateHadrons(step);
    this.detectHadrons();
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
      title: 'Scale 1 — Quark Field (10⁻¹⁸ m)',
      body: `Quarks are the fundamental constituents of protons and neutrons.
They come in 6 flavours (up, down, strange, charm, bottom, top)
and carry a property called colour charge — not actual colour,
but the QCD equivalent of electric charge.

The Strong Force binds quarks via gluons, the force-carrying
particles of Quantum Chromodynamics (QCD). Unlike electromagnetism,
the strong force gets STRONGER as quarks move apart — like a rubber
band. This phenomenon is called confinement: quarks can never
exist alone.

A proton = uud (2 up + 1 down)
A neutron = udd (1 up + 2 down)`,
      equation: `Cornell potential:
V(r) = −(4αs/3r) + κr

αs ≈ 0.118 (strong coupling constant)
κ ≈ 0.18 GeV²/ℏc (string tension)

Proton mass: 938.3 MeV/c²
(mostly from binding energy, not quark masses!)`,
      hint: '👆 Click the buttons below to spawn quarks. Watch them seek colour-neutral combinations!',
    });
    EventBus.emit('edu:event', { text: 'Spawn quarks and let confinement weave them into hadrons.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    this.buttonMap.clear();
    const specs: Array<[Flavor, string]> = [
      ['u', '+ Up quark (u)'],
      ['d', '+ Down quark (d)'],
      ['s', '+ Strange quark (s)'],
    ];
    for (const [flavor, label] of specs) {
      const button = this.makeButton(label, () => {
        this.spawnMode = flavor;
        this.updateButtonState();
      });
      this.buttonMap.set(flavor, button);
      actionBar.appendChild(button);
    }
    actionBar.appendChild(this.makeButton('Clear free quarks', () => {
      this.clearFreeQuarks();
    }));
    this.updateButtonState();
  }

  private updateButtonState(): void {
    this.buttonMap.forEach((button, flavor) => {
      button.classList.toggle('active', flavor === this.spawnMode);
    });
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private pointerToWorld(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer!.domElement.getBoundingClientRect();
    const xN = (clientX - rect.left) / rect.width;
    const yN = (clientY - rect.top) / rect.height;
    return new THREE.Vector2(
      THREE.MathUtils.lerp(this.camera.left, this.camera.right, xN),
      THREE.MathUtils.lerp(this.camera.top, this.camera.bottom, yN),
    );
  }

  private spawnQuark(flavor: Flavor, x: number, y: number): void {
    const config = FLAVOR_CONFIG[flavor];
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 20), material);
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);
    const colorCharge = COLOR_ORDER[Math.floor(Math.random() * COLOR_ORDER.length)];
    const tangent = new THREE.Vector2(-(y || 0.1), x || 0.1).normalize().multiplyScalar((Math.random() - 0.5) * 0.7);
    this.quarks.push({
      id: this.nextId++,
      flavor,
      colorCharge,
      mass: config.mass,
      mesh,
      position: new THREE.Vector2(x, y),
      velocity: tangent,
      locked: false,
      flash: 0,
    });
    EventBus.emit('edu:event', { text: `${config.label} spawned with ${colorCharge} colour charge.` });
  }

  private clearFreeQuarks(): void {
    const lockedIds = new Set(this.quarks.filter((quark) => quark.locked).map((quark) => quark.id));
    for (const quark of this.quarks) {
      if (!lockedIds.has(quark.id)) {
        this.scene.remove(quark.mesh);
      }
    }
    this.quarks = this.quarks.filter((quark) => lockedIds.has(quark.id));
    EventBus.emit('edu:event', { text: 'Cleared unbound quarks while preserving completed hadrons.' });
  }

  private integrateFreeQuarks(dt: number): void {
    const accelerations = this.computeAccelerations();
    for (const quark of this.quarks) {
      if (quark.locked) {
        continue;
      }
      const a = accelerations.get(quark.id) ?? new THREE.Vector2();
      quark.position.addScaledVector(quark.velocity, dt).addScaledVector(a, 0.5 * dt * dt);
    }
    const newAccelerations = this.computeAccelerations();
    for (const quark of this.quarks) {
      if (quark.locked) {
        continue;
      }
      const a0 = accelerations.get(quark.id) ?? new THREE.Vector2();
      const a1 = newAccelerations.get(quark.id) ?? new THREE.Vector2();
      quark.velocity.add(a0.clone().add(a1).multiplyScalar(0.5 * dt));
      quark.velocity.multiplyScalar(0.992);
      quark.mesh.position.set(quark.position.x, quark.position.y, 0);
      const material = quark.mesh.material as THREE.MeshStandardMaterial;
      quark.flash = Math.max(0, quark.flash - dt * 2.4);
      material.emissiveIntensity = 0.75 + quark.flash * 1.8;
    }
  }

  private computeAccelerations(): Map<number, THREE.Vector2> {
    const accelerations = new Map<number, THREE.Vector2>();
    for (const quark of this.quarks) {
      if (!quark.locked) {
        accelerations.set(quark.id, quark.position.clone().multiplyScalar(-0.06));
      }
    }
    const freeQuarks = this.quarks.filter((quark) => !quark.locked);
    for (let i = 0; i < freeQuarks.length; i += 1) {
      for (let j = i + 1; j < freeQuarks.length; j += 1) {
        const a = freeQuarks[i];
        const b = freeQuarks[j];
        const delta = b.position.clone().sub(a.position);
        const dist = Math.max(delta.length(), 0.35);
        const dir = delta.normalize();
        let strength = a.colorCharge === b.colorCharge ? -1.25 / (dist * dist + 0.3) : 1.35 / (dist * dist + 0.25);
        if (dist > CONFINE_RADIUS * 1.8) {
          strength += 0.8 * (dist - CONFINE_RADIUS * 1.8);
        }
        if (dist < 0.7) {
          strength -= 0.5;
        }
        const force = dir.multiplyScalar(strength);
        accelerations.get(a.id)!.add(force.clone().divideScalar(a.mass));
        accelerations.get(b.id)!.sub(force.clone().divideScalar(b.mass));
      }
    }
    return accelerations;
  }

  private detectHadrons(): void {
    const free = this.quarks.filter((quark) => !quark.locked);
    for (let i = 0; i < free.length; i += 1) {
      for (let j = i + 1; j < free.length; j += 1) {
        for (let k = j + 1; k < free.length; k += 1) {
          const trio = [free[i], free[j], free[k]];
          const colors = new Set(trio.map((quark) => quark.colorCharge));
          if (colors.size !== 3) {
            continue;
          }
          const centroid = trio.reduce((acc, quark) => acc.add(quark.position), new THREE.Vector2()).multiplyScalar(1 / 3);
          if (trio.some((quark) => quark.position.distanceTo(centroid) > CONFINE_RADIUS)) {
            continue;
          }
          this.formHadron(trio, centroid);
          return;
        }
      }
    }
  }

  private formHadron(quarks: Quark[], centroid: THREE.Vector2): void {
    const signature = quarks.map((quark) => quark.flavor).sort().join('');
    const kind = signature === 'duu' ? 'Proton' : signature === 'ddu' ? 'Neutron' : 'Hadron';
    for (const quark of quarks) {
      quark.locked = true;
      quark.flash = 1;
    }
    const positions = new Float32Array(18);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 }),
    );
    const label = createLabelSprite(kind);
    this.scene.add(line, label);
    const hadron: Hadron = {
      id: this.nextHadronId++,
      kind,
      quarks,
      center: centroid.clone(),
      drift: new THREE.Vector2((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7),
      phase: Math.random() * Math.PI * 2,
      line,
      label,
    };
    this.hadrons.push(hadron);
    this.formedKinds.add(kind);
    EventBus.emit('edu:event', {
      text: `${kind} formed: ${quarks.map((quark) => `${quark.flavor}${quark.colorCharge}`).join(' + ')}`,
    });
    EventBus.emit('toast', {
      title: `${kind} assembled`,
      body: kind === 'Proton' ? 'A colour-neutral uud baryon emerged from the quark field.' : kind === 'Neutron' ? 'A colour-neutral udd baryon has locked together.' : 'Three quarks confined into a colour-neutral hadron.',
    });
    if (!this.completed && this.formedKinds.has('Proton') && this.formedKinds.has('Neutron')) {
      this.completed = true;
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }

  private updateHadrons(dt: number): void {
    for (const hadron of this.hadrons) {
      hadron.phase += dt * 0.9;
      hadron.center.addScaledVector(hadron.drift, dt);
      if (Math.abs(hadron.center.x) > this.camera.right - 2) {
        hadron.drift.x *= -1;
      }
      if (Math.abs(hadron.center.y) > this.camera.top - 2) {
        hadron.drift.y *= -1;
      }
      const ringRadius = 0.48;
      hadron.quarks.forEach((quark, index) => {
        const angle = hadron.phase + (Math.PI * 2 * index) / 3;
        const target = new THREE.Vector2(
          hadron.center.x + Math.cos(angle) * ringRadius,
          hadron.center.y + Math.sin(angle) * ringRadius,
        );
        quark.position.lerp(target, 0.12);
        quark.mesh.position.set(quark.position.x, quark.position.y, 0);
        quark.flash = Math.max(0, quark.flash - dt * 1.2);
        const material = quark.mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 1.2 + Math.sin(hadron.phase * 4 + index) * 0.18 + quark.flash * 1.4;
      });
      const attribute = hadron.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const pairs: Array<[number, number]> = [[0, 1], [1, 2], [2, 0]];
      pairs.forEach(([a, b], pairIndex) => {
        const qa = hadron.quarks[a].position;
        const qb = hadron.quarks[b].position;
        attribute.setXYZ(pairIndex * 2, qa.x, qa.y, 0);
        attribute.setXYZ(pairIndex * 2 + 1, qb.x, qb.y, 0);
      });
      attribute.needsUpdate = true;
      hadron.label.position.set(hadron.center.x, hadron.center.y + 1.05, 0);
    }
  }
}

function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(4, 16, 40, 0.8)';
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
  ctx.lineWidth = 4;
  ctx.roundRect(8, 8, 240, 80, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6f7ff';
  ctx.font = 'bold 30px Segoe UI';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.6, 0.95, 1);
  return sprite;
}

function createStarfield(count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = Math.random() * radius;
    const theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(theta) * r;
    positions[i * 3 + 2] = -4 - Math.random() * 8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8 }));
}
