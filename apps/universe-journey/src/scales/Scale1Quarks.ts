import * as THREE from 'three';
import { EventBus } from '../EventBus';
import { mathHtml } from '../EduPanel';
import type { IScale } from '../ScaleManager';

type Flavor = 'u' | 'd' | 's' | 'c' | 'b' | 't';
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
  decayIn?: number;
}

interface Hadron {
  id: number;
  kind: string;
  quarks: Quark[];
  center: THREE.Vector2;
  drift: THREE.Vector2;
  phase: number;
  line: THREE.LineSegments;
  label: THREE.Sprite;
}

interface HadronInfo {
  name: string;
  symbol: string;
  charge: string;
  mass: string;
  fact: string;
  isEasterEgg?: boolean;
  accentColor: number;
}

const SCALE_INDEX = 0;
const CONFINE_RADIUS = 1.8;
const MAX_QUARKS = 24;
const COLOR_ORDER: ColorCharge[] = ['R', 'G', 'B'];
const FLAVOR_CONFIG: Record<Flavor, { label: string; color: number; mass: number; decayIn?: number }> = {
  u: { label: 'Up quark', color: 0xa6d8ff, mass: 1 },
  d: { label: 'Down quark', color: 0xff8356, mass: 1.18 },
  s: { label: 'Strange quark', color: 0xcdfb6d, mass: 1.8 },
  c: { label: 'Charm quark', color: 0xe879f9, mass: 2.8 },
  b: { label: 'Bottom quark', color: 0xf59e0b, mass: 5.4 },
  t: { label: 'Top quark', color: 0xf8fafc, mass: 12.0, decayIn: 0.7 },
};

const HADRON_DATA: Record<string, HadronInfo> = {
  duu: {
    name: 'Proton',
    symbol: 'p⁺',
    charge: '+1',
    mass: '938.3 MeV/c²',
    accentColor: 0x7dd3fc,
    fact: 'The proton is the backbone of every atomic nucleus. Its charge defines what element an atom is. Protons appear to be essentially stable — their half-life exceeds 10³⁴ years, longer than the age of the universe by 24 orders of magnitude.',
  },
  ddu: {
    name: 'Neutron',
    symbol: 'n⁰',
    charge: '0',
    mass: '939.6 MeV/c²',
    accentColor: 0xa8a29e,
    fact: 'Free neutrons are unstable, decaying to a proton, electron and antineutrino in ~14.8 minutes. Inside a nucleus the residual strong force stabilises them — without neutrons, most nuclei would blow apart from proton-proton repulsion.',
  },
  dsu: {
    name: 'Lambda⁰',
    symbol: 'Λ⁰',
    charge: '0',
    mass: '1115.7 MeV/c²',
    accentColor: 0x86efac,
    fact: 'The lightest strange baryon, discovered in 1947 in cosmic-ray cloud chamber photographs. It was the first particle containing a strange quark ever seen. Despite being "long-lived" by particle physics standards (2.6×10⁻¹⁰ s), it still decays 10¹³ times faster than a free neutron.',
  },
  suu: {
    name: 'Sigma⁺',
    symbol: 'Σ⁺',
    charge: '+1',
    mass: '1189.4 MeV/c²',
    accentColor: 0xfcd34d,
    fact: 'A charged strange baryon — one strange quark plus two up quarks. Part of the baryon octet predicted by Gell-Mann\'s Eightfold Way symmetry scheme (1961). Decays primarily to proton + neutral pion in ~8×10⁻¹¹ s.',
  },
  dds: {
    name: 'Sigma⁻',
    symbol: 'Σ⁻',
    charge: '−1',
    mass: '1197.4 MeV/c²',
    accentColor: 0xf87171,
    fact: 'The negatively charged member of the Sigma triplet. Remarkably, despite having the same quark content signature as other Sigmas, the three Sigma baryons have slightly different masses due to electromagnetic and isospin breaking effects.',
  },
  ssu: {
    name: 'Xi⁰',
    symbol: 'Ξ⁰',
    charge: '0',
    mass: '1314.9 MeV/c²',
    accentColor: 0xc4b5fd,
    fact: 'A "doubly strange" baryon — contains two strange quarks. Called a "cascade" particle because it decays in two sequential steps, each producing a lighter strange baryon, before finally ending as ordinary nucleons and pions.',
  },
  dss: {
    name: 'Xi⁻',
    symbol: 'Ξ⁻',
    charge: '−1',
    mass: '1321.7 MeV/c²',
    accentColor: 0xa78bfa,
    fact: 'The charged doubly-strange baryon. With two heavy strange quarks, it\'s significantly more massive than a proton. Decays via the weak force through a chain: Ξ⁻ → Λ⁰ + π⁻, then Λ⁰ → p + π⁻.',
  },
  sss: {
    name: 'Omega⁻',
    symbol: 'Ω⁻',
    charge: '−1',
    mass: '1672.5 MeV/c²',
    accentColor: 0xf0abfc,
    isEasterEgg: true,
    fact: '🏆 The crown jewel of the Eightfold Way. In 1962, Murray Gell-Mann predicted the Omega-minus should exist, with strangeness −3, charge −1, and mass ~1680 MeV/c² — before anyone had seen it. It was discovered at Brookhaven in February 1964 with exactly the predicted properties. This confirmed quarks were real and Gell-Mann won the 1969 Nobel Prize.',
  },
  uuu: {
    name: 'Delta⁺⁺',
    symbol: 'Δ⁺⁺',
    charge: '+2',
    mass: '1232 MeV/c²',
    accentColor: 0xfbbf24,
    isEasterEgg: true,
    fact: '⚡ The only baryon with charge +2! Three up quarks packed together — the Pauli exclusion principle is satisfied because quarks also carry colour charge. Incredibly short-lived at 5.6×10⁻²⁴ s (it\'s a "resonance", not a proper particle). The first evidence came from Fermi\'s pion scattering experiments at Chicago in 1951.',
  },
  ddd: {
    name: 'Delta⁻',
    symbol: 'Δ⁻',
    charge: '−1',
    mass: '1232 MeV/c²',
    accentColor: 0xfb923c,
    isEasterEgg: true,
    fact: '⚡ Three down quarks — the maximally negative baryon. Like its sibling Delta⁺⁺, it\'s a spin-3/2 resonance that decays almost instantly to a nucleon + pion. The Delta quartet (−, 0, +, ++) was essential evidence for quarks coming in exactly three colours.',
  },
  cdu: {
    name: 'Lambda_c⁺',
    symbol: 'Λ_c⁺',
    charge: '+1',
    mass: '2286.5 MeV/c²',
    accentColor: 0xe879f9,
    isEasterEgg: true,
    fact: '✨ The lightest charmed baryon — the first particle found to contain a charm quark, discovered at SLAC in 1975. The charm quark is ~550× heavier than an up quark. Decays in ~2×10⁻¹³ s via the weak force into strange particles.',
  },
  bdu: {
    name: 'Lambda_b⁰',
    symbol: 'Λ_b⁰',
    charge: '0',
    mass: '5619.6 MeV/c²',
    accentColor: 0xf59e0b,
    isEasterEgg: true,
    fact: '🔬 Contains the heavy bottom quark (~4180 MeV). Studied intensively at the LHC. In 2019, LHCb measured CP violation in Lambda_b decays — a subtle asymmetry between matter and antimatter that hints at why the universe has more matter than antimatter.',
  },
};

const TOP_DISCOVERY: HadronInfo = {
  name: 'Top quark',
  symbol: 't',
  charge: '+2/3',
  mass: '173,000 MeV/c²',
  accentColor: 0xffffff,
  isEasterEgg: true,
  fact: '🌟 The heaviest known elementary particle — as massive as a gold atom! The top quark is so heavy (173 GeV) it decays before the strong force can bind it into a hadron: t → W⁺ + b in ~5×10⁻²⁵ seconds. This is 20 times faster than hadronisation timescales. Discovered at Fermilab\'s Tevatron in 1995 after a 20-year search. It\'s the only quark whose bare properties we can measure directly.',
};

const UNKNOWN_HADRON: HadronInfo = {
  name: 'Hadron',
  symbol: '?',
  charge: '?',
  mass: '?',
  fact: 'An exotic quark combination.',
  accentColor: 0x94a3b8,
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
  private discoveredParticles = new Set<string>();
  private discoveryTimeoutId: number | null = null; // kept for legacy clearTimeout safety
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
    this.discoveredParticles.clear();
    this.completed = false;
    this.nextId = 1;
    this.nextHadronId = 1;
    this.spawnMode = 'u';
    renderer.domElement.addEventListener('click', this.handleCanvasClick);
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    this.renderer?.domElement.removeEventListener('click', this.handleCanvasClick);
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    if (this.discoveryTimeoutId !== null) {
      window.clearTimeout(this.discoveryTimeoutId);
      this.discoveryTimeoutId = null;
    }
    document.getElementById('discovery-close')!.onclick = null;
    document.getElementById('discovery-modal')!.classList.remove('visible');
    document.getElementById('discovery-modal')!.setAttribute('aria-hidden', 'true');
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

    for (const quark of this.quarks.filter((candidate) => candidate.flavor === 't' && !candidate.locked)) {
      if (quark.decayIn !== undefined) {
        quark.decayIn -= step;
        if (quark.decayIn <= 0) {
          this.decayTopQuark(quark);
          break;
        }
      }
    }

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
      title: 'Scale 1 — Quark Field · 10⁻¹⁸ m',
      body: `
<div class="edu-section">
  <p>You are at the smallest known scale of matter — <span class="edu-highlight">10⁻¹⁸ metres</span>, far smaller than an atomic nucleus. Here, the fundamental building blocks of protons and neutrons float freely in a sea of colour charge.</p>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Quark Flavours</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name">⬆ Up quark <span class="edu-tag">u</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">+²⁄₃ e</span> · Mass ≈ 2.3 MeV/c²<br/>The lightest quark. Two ups + one down = <strong>Proton</strong>.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">⬇ Down quark <span class="edu-tag">d</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">−¹⁄₃ e</span> · Mass ≈ 4.8 MeV/c²<br/>One up + two downs = <strong>Neutron</strong>.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">↯ Strange quark <span class="edu-tag">s</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">−¹⁄₃ e</span> · Mass ≈ 95 MeV/c²<br/>Forms exotic hadrons — short-lived in nature.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">✨ Charm quark <span class="edu-tag">c</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">+²⁄₃ e</span> · Mass ≈ 1.27 GeV/c²<br/>Only seen in high-energy collisions.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">🔬 Bottom quark <span class="edu-tag">b</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">−¹⁄₃ e</span> · Mass ≈ 4.18 GeV/c²<br/>Named "beauty" quark in Europe.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">🌟 Top quark <span class="edu-tag">t</span></div>
      <div class="edu-card-sub">Charge <span class="edu-highlight">+²⁄₃ e</span> · Mass ≈ 173 GeV/c²<br/>Decays before it can form hadrons!</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Colour Charge</div>
  <p>Every quark carries a <span class="edu-highlight">colour charge</span> — nothing to do with visible colour, but an analogy for the three types of strong charge in QCD.</p>
  <div class="edu-pill-row">
    <span class="edu-pill pill-red">● Red</span>
    <span class="edu-pill pill-green">● Green</span>
    <span class="edu-pill pill-blue">● Blue</span>
  </div>
  <p style="margin-top:5px">A stable hadron must be <span class="edu-highlight">colour-neutral</span> (Red + Green + Blue = "white"). Gluons continuously swap colour charge between quarks to maintain this balance.</p>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Cornell Potential</div>
  <p>The force between two quarks is described by the <span class="edu-highlight">Cornell potential</span>. The first term pulls quarks together at short range; the second grows with distance, making escape impossible.</p>
  <div class="edu-equation-inline">${mathHtml('V(r) = -\dfrac{4\alpha_s}{3\,r} + \kappa\, r')}</div>
  <table class="edu-def-table">
    <tr><td><em>α</em><sub>s</sub></td><td>≈ 0.118 — strong coupling constant</td></tr>
    <tr><td><em>κ</em></td><td>≈ 0.18 GeV²/ℏc — string tension</td></tr>
    <tr><td><em>r</em></td><td>quark separation</td></tr>
  </table>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Confinement</div>
  <p>The strong force behaves like a <span class="edu-highlight">rubber band</span>: the farther quarks pull apart, the stronger the restoring force. Beyond a critical distance, the energy stored in the "string" is enough to <em>create a new quark pair</em> — quarks can never be isolated.</p>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">The Proton Mass Mystery</div>
  <p>A proton has mass 938 MeV/c². The three quarks inside total only ≈ 9 MeV/c². The remaining <span class="edu-highlight">99% comes from gluon binding energy</span> — <em>E = mc²</em> running in both directions.</p>
</div>`,
      hint: '👆 Spawn quarks with the u/d/s buttons, then experiment with c/b/t for heavy baryons. Legendary easter egg: the Omega-minus (sss) is hiding in the strange sector.',
    });
    EventBus.emit('edu:event', { text: 'Spawn quarks and let confinement weave them into hadrons.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    this.buttonMap.clear();

    const commonRow = document.createElement('div');
    commonRow.className = 'action-row';
    const heavyRow = document.createElement('div');
    heavyRow.className = 'action-row';

    const commonLabel = document.createElement('div');
    commonLabel.className = 'action-label';
    commonLabel.textContent = 'Common quarks';

    const heavyLabel = document.createElement('div');
    heavyLabel.className = 'action-label heavy';
    heavyLabel.textContent = 'Heavy / exotic quarks';

    const commonSpecs: Array<[Flavor, string]> = [
      ['u', '+ Up quark (u)'],
      ['d', '+ Down quark (d)'],
      ['s', '+ Strange quark (s)'],
    ];
    const heavySpecs: Array<[Flavor, string]> = [
      ['c', '+ Charm quark (c)'],
      ['b', '+ Bottom quark (b)'],
      ['t', '+ Top quark (t)'],
    ];

    for (const [flavor, label] of commonSpecs) {
      const button = this.makeButton(label, () => {
        this.spawnMode = flavor;
        this.updateButtonState();
      });
      this.buttonMap.set(flavor, button);
      commonRow.appendChild(button);
    }

    for (const [flavor, label] of heavySpecs) {
      const button = this.makeButton(label, () => {
        this.spawnMode = flavor;
        this.updateButtonState();
      });
      button.classList.add('heavy-quark-button');
      if (flavor === 't') {
        button.classList.add('top-quark-button');
        button.title = 'Top quark: decays in ~0.7s into a bottom quark!';
      }
      this.buttonMap.set(flavor, button);
      heavyRow.appendChild(button);
    }

    actionBar.append(commonLabel, commonRow, heavyLabel, heavyRow);
    actionBar.appendChild(this.makeButton('Clear free quarks', () => {
      this.clearFreeQuarks();
    }, ['action-clear-button']));
    this.updateButtonState();
  }

  private updateButtonState(): void {
    this.buttonMap.forEach((button, flavor) => {
      button.classList.toggle('active', flavor === this.spawnMode);
    });
  }

  private makeButton(label: string, onClick: () => void, classNames: string[] = []): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.classList.add(...classNames);
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

    const labelSprite = createQuarkLabel(flavor, config.color);
    labelSprite.position.set(0, 0, 0.3);
    mesh.add(labelSprite);

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
      decayIn: config.decayIn,
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
        const sameColor = a.colorCharge === b.colorCharge;
        let strength = sameColor
          ? 0.55 / (dist * dist + 0.3)
          : 1.35 / (dist * dist + 0.25);
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
          const centroid = trio
            .reduce((acc, quark) => acc.add(quark.position), new THREE.Vector2())
            .multiplyScalar(1 / 3);
          if (trio.some((quark) => quark.position.distanceTo(centroid) > CONFINE_RADIUS)) {
            continue;
          }
          const shuffled = (['R', 'G', 'B'] as ColorCharge[]).sort(() => Math.random() - 0.5);
          trio.forEach((quark, idx) => {
            quark.colorCharge = shuffled[idx];
          });
          this.formHadron(trio, centroid);
          return;
        }
      }
    }
  }

  private formHadron(quarks: Quark[], centroid: THREE.Vector2): void {
    const key = quarks.map((quark) => quark.flavor).sort().join('');
    const hadronInfo = HADRON_DATA[key] ?? UNKNOWN_HADRON;
    for (const quark of quarks) {
      quark.locked = true;
      quark.flash = 1;
      quark.decayIn = undefined;
    }
    const positions = new Float32Array(18);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: hadronInfo.accentColor, transparent: true, opacity: 0.8 }),
    );
    const label = createLabelSprite(hadronInfo.name);
    this.scene.add(line, label);
    const hadron: Hadron = {
      id: this.nextHadronId++,
      kind: hadronInfo.name,
      quarks,
      center: centroid.clone(),
      drift: new THREE.Vector2((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7),
      phase: Math.random() * Math.PI * 2,
      line,
      label,
    };
    this.hadrons.push(hadron);
    this.formedKinds.add(hadronInfo.name);

    if (!this.discoveredParticles.has(key)) {
      this.discoveredParticles.add(key);
      this.showDiscoveryModal(hadronInfo, quarks);
    }

    EventBus.emit('edu:event', {
      text: `${hadronInfo.name} formed: ${quarks.map((quark) => `${quark.flavor}${quark.colorCharge}`).join(' + ' )}`,
    });
    EventBus.emit('toast', {
      title: `${hadronInfo.name} assembled`,
      body: hadronInfo.name === 'Proton'
        ? 'A colour-neutral uud baryon emerged from the quark field.'
        : hadronInfo.name === 'Neutron'
          ? 'A colour-neutral udd baryon has locked together.'
          : `Three quarks confined into ${hadronInfo.name}.`,
    });
    if (!this.completed && this.formedKinds.has('Proton') && this.formedKinds.has('Neutron')) {
      this.completed = true;
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }

  private showDiscoveryModal(info: HadronInfo, quarks?: Quark[]): void {
    const modal = document.getElementById('discovery-modal')!;
    const card = document.getElementById('discovery-card')!;
    const badge = document.getElementById('discovery-badge')!;

    badge.textContent = info.isEasterEgg ? '🥚 EASTER EGG UNLOCKED' : 'NEW PARTICLE DISCOVERED';
    badge.className = info.isEasterEgg ? 'easter-egg' : '';

    const r = (info.accentColor >> 16) & 0xff;
    const g = (info.accentColor >> 8) & 0xff;
    const b = info.accentColor & 0xff;
    card.style.boxShadow = `0 0 60px rgba(${r},${g},${b},0.35), 0 0 0 1px rgba(${r},${g},${b},0.2)`;
    card.style.borderColor = `rgba(${r},${g},${b},0.3)`;

    document.getElementById('discovery-symbol')!.textContent = info.symbol;
    document.getElementById('discovery-symbol')!.style.color = `rgb(${r},${g},${b})`;
    document.getElementById('discovery-name')!.textContent = info.name;
    document.getElementById('discovery-quarks')!.textContent = quarks
      ? quarks.map((quark) => quark.flavor).join(' + ' )
      : info.symbol;
    document.getElementById('discovery-charge')!.textContent = `Charge: ${info.charge}`;
    document.getElementById('discovery-mass')!.textContent = `Mass: ${info.mass}`;
    document.getElementById('discovery-fact')!.textContent = info.fact;

    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');

    if (this.discoveryTimeoutId !== null) {
      window.clearTimeout(this.discoveryTimeoutId);
      this.discoveryTimeoutId = null;
    }

    const close = document.getElementById('discovery-close')!;
    const dismiss = () => {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
      close.onclick = null;
    };
    close.onclick = dismiss;
  }

  private decayTopQuark(quark: Quark): void {
    const { x, y } = quark.position;
    this.scene.remove(quark.mesh);
    this.quarks = this.quarks.filter((candidate) => candidate.id !== quark.id);

    const flash = new THREE.PointLight(0xffffff, 15, 6, 2);
    flash.position.set(x, y, 0);
    this.scene.add(flash);
    window.setTimeout(() => this.scene.remove(flash), 300);

    this.spawnQuark('b', x, y);

    EventBus.emit('edu:event', { text: 'Top quark decayed: t → b + W⁺ (W⁺ escaped)' });

    if (!this.discoveredParticles.has('t')) {
      this.discoveredParticles.add('t');
      this.showDiscoveryModal(TOP_DISCOVERY);
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

function createQuarkLabel(flavor: Flavor, colorHex: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const r = (colorHex >> 16) & 0xff;
  const g = (colorHex >> 8) & 0xff;
  const b = colorHex & 0xff;
  ctx.font = 'bold 38px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(flavor, 33, 34);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillText(flavor, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.42, 0.42, 1);
  return sprite;
}

function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const fontSize = text.length > 12 ? 20 : text.length > 9 ? 24 : 30;
  ctx.fillStyle = 'rgba(4, 16, 40, 0.8)';
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
  ctx.lineWidth = 4;
  ctx.roundRect(8, 8, 240, 80, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6f7ff';
  ctx.font = `bold ${fontSize}px Segoe UI`;
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
