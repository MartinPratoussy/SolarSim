import * as THREE from 'three';
import { EventBus } from '../EventBus';
import { mathHtml } from '../EduPanel';
import type { IScale } from '../ScaleManager';

interface Nucleon {
  kind: 'proton' | 'neutron';
  mesh: THREE.Mesh;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  locked: boolean;
}

interface NucleusInfo {
  name: string;
  symbol: string;
  protons: number;
  neutrons: number;
  bindingEnergy: string;
  mass: string;
  fact: string;
  isEasterEgg?: boolean;
  accentColor: number;
}

const NUCLEUS_DATA: Record<string, NucleusInfo> = {
  '1p1n': {
    name: 'Deuterium', symbol: '²H', protons: 1, neutrons: 1,
    bindingEnergy: '2.22 MeV', mass: '2.014 u', accentColor: 0x7dd3fc,
    fact: 'The simplest bound nucleus — just one proton and one neutron. Deuterium is stable and makes up 0.0156% of all hydrogen on Earth. Heavy water (D₂O) uses deuterium instead of ordinary hydrogen. In fusion reactors, deuterium + tritium is the most promising fuel reaction, releasing 17.6 MeV per event.',
  },
  '1p2n': {
    name: 'Tritium', symbol: '³H', protons: 1, neutrons: 2,
    bindingEnergy: '8.48 MeV', mass: '3.016 u', accentColor: 0x34d399,
    fact: 'Radioactive hydrogen with two neutrons. Beta-decays into Helium-3 with a half-life of 12.3 years. Tritium is produced naturally by cosmic rays in the upper atmosphere and is the key fuel component in thermonuclear weapons. The D-T fusion reaction (deuterium + tritium → He-4 + neutron) releases 17.6 MeV.',
  },
  '2p1n': {
    name: 'Helium-3', symbol: '³He', protons: 2, neutrons: 1,
    bindingEnergy: '7.72 MeV', mass: '3.016 u', accentColor: 0xa7f3d0,
    fact: 'The lighter stable isotope of helium. Extremely rare on Earth (only ~0.0002% of all helium) but abundant on the Moon — deposited there over billions of years by the solar wind. Some scientists propose mining lunar He-3 as fuel for fusion reactors, where it produces fewer dangerous neutrons than D-T fusion.',
  },
  '2p2n': {
    name: 'Helium-4', symbol: '⁴He', protons: 2, neutrons: 2,
    bindingEnergy: '28.3 MeV (7.07 MeV/nucleon)', mass: '4.003 u', accentColor: 0x93c5fd,
    fact: 'One of nature\'s most stable light nuclei — a "doubly magic" number (Z=2, N=2 both fill the first nuclear shell). Helium-4 is the end product of hydrogen burning in stars and the most common nucleus produced in Big Bang nucleosynthesis (~24% of all baryonic mass). Its nucleus (an alpha particle) is emitted in radioactive alpha decay.',
  },
  '3p3n': {
    name: 'Lithium-6', symbol: '⁶Li', protons: 3, neutrons: 3,
    bindingEnergy: '31.99 MeV (5.33 MeV/nucleon)', mass: '6.015 u', accentColor: 0xfcd34d,
    fact: 'The lighter isotope of lithium. Only 7.6% of natural lithium is Li-6, but it\'s crucial for nuclear weapons — the lithium deuteride (⁶LiD) in hydrogen bombs reacts with fusion neutrons to produce tritium. Li-6 is also being studied as a breeding material in fusion reactor blankets.',
  },
  '3p4n': {
    name: 'Lithium-7', symbol: '⁷Li', protons: 3, neutrons: 4,
    bindingEnergy: '39.24 MeV (5.61 MeV/nucleon)', mass: '7.016 u', accentColor: 0xfbbf24,
    fact: 'The dominant isotope of lithium (92.5% of natural lithium). Produced in the Big Bang nucleosynthesis — the heaviest nucleus made in significant quantities in the early universe. Today it\'s used in lithium-ion batteries, psychiatric medication (lithium carbonate), and as a neutron shield in nuclear reactors.',
  },
  '4p4n': {
    name: 'Beryllium-8', symbol: '⁸Be', protons: 4, neutrons: 4,
    bindingEnergy: '56.5 MeV', mass: '8.005 u', accentColor: 0xf0abfc,
    isEasterEgg: true,
    fact: '🔬 The ultimate unstable nucleus! Be-8 exists for only 8.2×10⁻¹⁷ seconds before splitting back into two helium-4 nuclei. This vanishingly brief lifetime is actually crucial for stellar nucleosynthesis — Fred Hoyle predicted a resonance in carbon-12 that allows three He-4 nuclei to fuse via a fleeting Be-8 intermediate (the triple-alpha process). Without this coincidence, carbon — and life — would not exist.',
  },
  '6p6n': {
    name: 'Carbon-12', symbol: '¹²C', protons: 6, neutrons: 6,
    bindingEnergy: '92.16 MeV (7.68 MeV/nucleon)', mass: '12.000 u', accentColor: 0x86efac,
    isEasterEgg: true,
    fact: '🌟 The backbone of all known life. Carbon-12 is the product of the triple-alpha process in stellar cores: 3×He-4 → C-12 + 7.37 MeV. It\'s the definition of the atomic mass unit (exactly 12 u). Fred Hoyle\'s 1953 prediction of the "Hoyle state" resonance in C-12 — made because carbon clearly exists — remains one of the most remarkable predictions in physics.',
  },
};

const NUCLEUS_TARGET_SIZES = [2, 3, 4, 6, 7, 8, 12] as const;

const SCALE_INDEX = 1;
const MAX_NUCLEONS = 14;
const BOND_DRAW_DIST = 1.8;

// Golden-ratio spiral slot positions — natural-looking nuclear packing
function getSlotPosition(index: number): THREE.Vector2 {
  if (index === 0) return new THREE.Vector2(0, 0);
  const r = 0.68 * Math.sqrt(index);
  const angle = index * 2.39996229; // golden angle ≈ 137.5°
  return new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r);
}

export class Scale2Nuclear implements IScale {
  readonly name = 'Scale 2 — Nuclear';
  readonly scaleLabel = '10⁻¹⁵ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;

  private nucleons: Nucleon[] = [];
  private incomingNucleon: Nucleon | null = null;
  private phase = 0;
  private completed = false;
  private discoveredNuclei = new Set<string>();

  // Bond line visuals
  private bondGeo: THREE.BufferGeometry | null = null;
  private bondMat: THREE.LineBasicMaterial | null = null;
  private bondLines: THREE.LineSegments | null = null;
  private bondPosArr: Float32Array = new Float32Array(0);
  private bondColArr: Float32Array = new Float32Array(0);

  // Nucleus name label sprite (floats above the nucleus)
  private nameLabel: THREE.Sprite | null = null;
  private nameLabelCanvas: HTMLCanvasElement | null = null;
  private nameLabelTexture: THREE.CanvasTexture | null = null;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x788ea8, 0.95));
    const light = new THREE.PointLight(0x9dd5ff, 8, 40, 2);
    light.position.set(0, 0, 12);
    this.scene.add(light, createBackdrop());
    this.nucleons = [];
    this.incomingNucleon = null;
    this.phase = 0;
    this.completed = false;
    this.discoveredNuclei.clear();
    this.initBondVisuals();
    this.initNameLabel();
    this.placeInitialProton();
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    document.getElementById('discovery-close')!.onclick = null;
    document.getElementById('discovery-modal')!.classList.remove('visible');
    document.getElementById('discovery-modal')!.setAttribute('aria-hidden', 'true');
    if (this.bondLines) {
      this.bondGeo?.dispose();
      this.bondMat?.dispose();
      this.bondLines = null;
      this.bondGeo = null;
      this.bondMat = null;
    }
    if (this.nameLabel) {
      this.nameLabelTexture?.dispose();
      (this.nameLabel.material as THREE.SpriteMaterial).dispose();
      this.nameLabel = null;
      this.nameLabelCanvas = null;
      this.nameLabelTexture = null;
    }
    this.scene.clear();
    this.nucleons = [];
    this.incomingNucleon = null;
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) return;
    const step = Math.min(dt, 0.033);
    this.phase += step;
    this.animateIncoming(step);
    this.animateLocked();
    this.updateBondVisuals();
    this.updateNameLabel();
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

  // ── Nucleon lifecycle ────────────────────────────────────────────────────

  private placeInitialProton(): void {
    const n = this.makeNucleon('proton', 0, 0);
    n.locked = true;
    this.nucleons.push(n);
    this.scene.add(n.mesh);
  }

  private spawnNucleon(kind: 'proton' | 'neutron'): void {
    if (this.incomingNucleon || this.nucleons.length >= MAX_NUCLEONS) return;
    const angle = Math.random() * Math.PI * 2;
    const spawnR = 11;
    const sx = Math.cos(angle) * spawnR;
    const sy = Math.sin(angle) * spawnR;
    const n = this.makeNucleon(kind, sx, sy);
    // Aim at nucleus centroid with slight random wobble
    const c = this.getNucleusCentroid();
    const dir = new THREE.Vector2(c.x - sx, c.y - sy).normalize();
    const wobble = new THREE.Vector2((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
    n.velocity.copy(dir).add(wobble).normalize().multiplyScalar(4.5 + Math.random() * 2);
    this.nucleons.push(n);
    this.scene.add(n.mesh);
    this.incomingNucleon = n;
    this.setButtonsDisabled(true);
    EventBus.emit('edu:event', { text: `${kind === 'proton' ? 'Proton' : 'Neutron'} approaching the nucleus…` });
  }

  private makeNucleon(kind: 'proton' | 'neutron', x: number, y: number): Nucleon {
    const color = kind === 'proton' ? 0x5bbcff : 0xbec8d8;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 20, 20),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }),
    );
    const label = createNucleonLabel(kind);
    label.position.set(0, 0, 0.4);
    mesh.add(label);
    mesh.position.set(x, y, 0);
    return {
      kind,
      mesh,
      position: new THREE.Vector2(x, y),
      velocity: new THREE.Vector2(),
      locked: false,
    };
  }

  // ── Animation ─────────────────────────────────────────────────────────

  private animateIncoming(dt: number): void {
    const n = this.incomingNucleon;
    if (!n) return;
    const c = this.getNucleusCentroid();
    const toCenter = new THREE.Vector2(c.x - n.position.x, c.y - n.position.y);
    const dist = toCenter.length();
    n.velocity.addScaledVector(toCenter.clone().normalize().multiplyScalar(7), dt);
    n.velocity.clampLength(0, 10);
    n.velocity.multiplyScalar(0.97);
    n.position.addScaledVector(n.velocity, dt);
    n.mesh.position.set(n.position.x, n.position.y, 0);
    // Pulsing glow that intensifies as it approaches
    const proximity = Math.max(0, 1 - dist / 9);
    (n.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.8 + Math.sin(this.phase * 8) * 0.35 * proximity;
    // Snap to nucleus when it reaches the binding boundary
    const lockedCount = this.nucleons.filter((x) => x.locked).length;
    const snapRadius = 1.0 + 0.68 * Math.sqrt(lockedCount);
    if (dist <= snapRadius) {
      this.lockIncoming();
    }
  }

  private lockIncoming(): void {
    const n = this.incomingNucleon!;
    const slotIndex = this.nucleons.filter((x) => x.locked).length; // count before locking
    n.locked = true;
    n.velocity.set(0, 0);
    this.incomingNucleon = null;
    const slot = getSlotPosition(slotIndex);
    n.position.copy(slot);
    n.mesh.position.set(slot.x, slot.y, 0);
    (n.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.0; // brief flash
    this.setButtonsDisabled(false);
    this.checkMilestones();
  }

  private animateLocked(): void {
    const locked = this.nucleons.filter((n) => n.locked);
    for (let i = 0; i < locked.length; i += 1) {
      const n = locked[i];
      const slot = getSlotPosition(i);
      const wobble = new THREE.Vector2(
        Math.sin(this.phase * 1.4 + i * 1.1) * 0.04,
        Math.cos(this.phase * 1.8 + i * 0.8) * 0.04,
      );
      n.position.copy(slot).add(wobble);
      n.mesh.position.set(n.position.x, n.position.y, 0);
      const mat = n.mesh.material as THREE.MeshStandardMaterial;
      // Decay the snap flash back to a steady gentle pulse
      const steadyGlow = 0.8 + Math.sin(this.phase * 3 + i * 0.7) * 0.18;
      mat.emissiveIntensity = mat.emissiveIntensity > steadyGlow
        ? mat.emissiveIntensity * 0.88 + steadyGlow * 0.12
        : steadyGlow;
    }
  }

  // ── Milestone detection ───────────────────────────────────────────────

  private checkMilestones(): void {
    const protons = this.nucleons.filter((n) => n.kind === 'proton' && n.locked).length;
    const neutrons = this.nucleons.filter((n) => n.kind === 'neutron' && n.locked).length;
    const key = `${protons}p${neutrons}n`;
    const info = NUCLEUS_DATA[key];
    if (info && !this.discoveredNuclei.has(key)) {
      this.discoveredNuclei.add(key);
      this.showDiscoveryModal(info, protons, neutrons);
      EventBus.emit('edu:event', { text: `${info.name} (${info.symbol}) formed — ${info.bindingEnergy} binding energy` });
      EventBus.emit('toast', { title: `${info.name} formed`, body: `${protons}p + ${neutrons}n · ${info.bindingEnergy}` });
    }
    // Scale goal: Helium-4
    if (protons === 2 && neutrons === 2 && !this.completed) {
      this.completed = true;
      EventBus.emit('edu:event', { text: 'Helium-4 assembled — doubly magic nucleus, 28.3 MeV binding energy.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
    // Be-8 easter egg: physically unstable, simulate decay back to 2×He-4
    if (key === '4p4n') {
      window.setTimeout(() => {
        EventBus.emit('edu:event', { text: 'Be-8 decayed: ⁸Be → 2×⁴He (8.2×10⁻¹⁷ s — simulated as 1.5 s). Nucleus reset.' });
        this.nucleons.forEach((x) => this.scene.remove(x.mesh));
        this.nucleons = [];
        this.incomingNucleon = null;
        this.placeInitialProton();
        this.setButtonsDisabled(false);
      }, 1500);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private getNucleusCentroid(): THREE.Vector2 {
    const locked = this.nucleons.filter((n) => n.locked);
    if (locked.length === 0) return new THREE.Vector2(0, 0);
    return locked
      .reduce((acc, n) => acc.add(n.position), new THREE.Vector2())
      .multiplyScalar(1 / locked.length);
  }

  private setButtonsDisabled(disabled: boolean): void {
    document.querySelectorAll<HTMLButtonElement>('#action-bar button').forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  // ── Bond & label visuals ───────────────────────────────────────────────

  private initBondVisuals(): void {
    const maxPairs = (MAX_NUCLEONS * (MAX_NUCLEONS - 1)) / 2;
    this.bondPosArr = new Float32Array((maxPairs + 1) * 6); // +1 for incoming beam line
    this.bondColArr = new Float32Array((maxPairs + 1) * 6);
    this.bondGeo = new THREE.BufferGeometry();
    this.bondGeo.setAttribute('position', new THREE.BufferAttribute(this.bondPosArr, 3));
    this.bondGeo.setAttribute('color', new THREE.BufferAttribute(this.bondColArr, 3));
    this.bondMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false });
    this.bondLines = new THREE.LineSegments(this.bondGeo, this.bondMat);
    this.bondLines.renderOrder = 2;
    this.scene.add(this.bondLines);
  }

  private updateBondVisuals(): void {
    if (!this.bondGeo) return;
    const locked = this.nucleons.filter((n) => n.locked);
    let bondCount = 0;
    // Bonds between locked nucleons
    for (let i = 0; i < locked.length; i += 1) {
      for (let j = i + 1; j < locked.length; j += 1) {
        const a = locked[i];
        const b = locked[j];
        const dist = a.position.distanceTo(b.position);
        if (dist > BOND_DRAW_DIST) continue;
        const t = 1 - dist / BOND_DRAW_DIST;
        let r: number;
        let g: number;
        let bl: number;
        if (a.kind !== b.kind) {
          [r, g, bl] = [0.2, 0.9, 1.0];   // cyan: p-n (strongest)
        } else if (a.kind === 'proton') {
          [r, g, bl] = [1.0, 0.55, 0.1];  // orange: p-p (Coulomb competing)
        } else {
          [r, g, bl] = [0.45, 0.62, 0.88]; // blue-gray: n-n
        }
        const alpha = 0.3 + 0.65 * t;
        const base = bondCount * 6;
        this.bondPosArr[base]     = a.position.x;
        this.bondPosArr[base + 1] = a.position.y;
        this.bondPosArr[base + 2] = 0.1;
        this.bondPosArr[base + 3] = b.position.x;
        this.bondPosArr[base + 4] = b.position.y;
        this.bondPosArr[base + 5] = 0.1;
        this.bondColArr[base]     = r * alpha;
        this.bondColArr[base + 1] = g * alpha;
        this.bondColArr[base + 2] = bl * alpha;
        this.bondColArr[base + 3] = r * alpha;
        this.bondColArr[base + 4] = g * alpha;
        this.bondColArr[base + 5] = bl * alpha;
        bondCount += 1;
      }
    }
    // Dashed beam line from incoming nucleon toward the nucleus center
    const inc = this.incomingNucleon;
    if (inc) {
      const c = this.getNucleusCentroid();
      const [r, g, bl] = inc.kind === 'proton' ? [0.35, 0.75, 1.0] : [0.6, 0.7, 0.85];
      const base = bondCount * 6;
      this.bondPosArr[base]     = inc.position.x;
      this.bondPosArr[base + 1] = inc.position.y;
      this.bondPosArr[base + 2] = 0.1;
      this.bondPosArr[base + 3] = c.x;
      this.bondPosArr[base + 4] = c.y;
      this.bondPosArr[base + 5] = 0.1;
      this.bondColArr[base]     = r * 0.3;
      this.bondColArr[base + 1] = g * 0.3;
      this.bondColArr[base + 2] = bl * 0.3;
      this.bondColArr[base + 3] = r * 0.05;
      this.bondColArr[base + 4] = g * 0.05;
      this.bondColArr[base + 5] = bl * 0.05;
      bondCount += 1;
    }
    this.bondGeo.setDrawRange(0, bondCount * 2);
    (this.bondGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.bondGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  private initNameLabel(): void {
    this.nameLabelCanvas = document.createElement('canvas');
    this.nameLabelCanvas.width = 256;
    this.nameLabelCanvas.height = 56;
    this.nameLabelTexture = new THREE.CanvasTexture(this.nameLabelCanvas);
    this.nameLabel = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.nameLabelTexture, transparent: true, depthTest: false }),
    );
    this.nameLabel.scale.set(3.2, 0.7, 1);
    this.nameLabel.renderOrder = 3;
    this.scene.add(this.nameLabel);
  }

  private updateNameLabel(): void {
    if (!this.nameLabelCanvas || !this.nameLabelTexture || !this.nameLabel) return;
    const locked = this.nucleons.filter((n) => n.locked);
    const protons = locked.filter((n) => n.kind === 'proton').length;
    const neutrons = locked.filter((n) => n.kind === 'neutron').length;
    const key = `${protons}p${neutrons}n`;
    const info = NUCLEUS_DATA[key];
    const labelText = info ? `${info.symbol}  ${info.name}` : `${protons}p + ${neutrons}n`;
    const centroid = this.getNucleusCentroid();
    const radius = 0.95 + 0.68 * Math.sqrt(locked.length);
    this.nameLabel.position.set(centroid.x, centroid.y + radius + 0.55, 0.3);
    const ctx = this.nameLabelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 56);
    ctx.fillStyle = 'rgba(8, 16, 36, 0.80)';
    ctx.beginPath();
    ctx.roundRect(2, 2, 252, 52, 10);
    ctx.fill();
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = info ? (info.isEasterEgg ? '#f0abfc' : '#7dd3fc') : '#94a3b8';
    ctx.fillText(labelText, 128, 28);
    this.nameLabelTexture.needsUpdate = true;
  }

  // ── UI ────────────────────────────────────────────────────────────────

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ Proton', () => this.spawnNucleon('proton')));
    actionBar.appendChild(this.makeButton('+ Neutron', () => this.spawnNucleon('neutron')));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 2 — Atomic Nucleus · 10⁻¹⁵ m',
      body: `
<div class="edu-section">
  <p>You have zoomed out to the scale of the <span class="edu-highlight">atomic nucleus</span> — femtometres (fm), roughly 100,000× smaller than an atom. The quarks are now hidden inside protons and neutrons. What holds them together is a weaker echo of the colour force: the <span class="edu-highlight">residual strong force</span>.</p>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Residual Strong Force</div>
  <p>Quarks are colour-confined inside nucleons, but the gluon field "leaks" a little. That leakage mediates an attraction between neighbouring nucleons via <span class="edu-highlight">virtual pion exchange</span> — the residual strong force.</p>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name">Short range</div>
      <div class="edu-card-sub">Strongly attractive from ~0.8–2.5 fm. Falls off exponentially beyond ~3 fm — unlike gravity, it simply switches off at large distances.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">Hard core</div>
      <div class="edu-card-sub">Repulsive at &lt; 0.5 fm — nucleons cannot be squeezed into the same space. This prevents nuclear collapse.</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Yukawa Potential</div>
  <p>Hideki Yukawa predicted in 1935 that a short-range force would be carried by a massive particle. The pion (mass ~140 MeV/c²) was discovered in 1947 — exactly as he had described. He won the 1949 Nobel Prize.</p>
  <div class="edu-equation-inline">${mathHtml('V(r) = -g^2\\,\\dfrac{e^{-r/r_0}}{r}', false)}</div>
  <table class="edu-def-table">
    <tr><td><em>g</em></td><td>coupling strength</td></tr>
    <tr><td><em>r</em><sub>0</sub></td><td>≈ 1.4 fm — range set by pion mass: r₀ = ℏc/m_πc²</td></tr>
    <tr><td><em>r</em></td><td>nucleon separation</td></tr>
  </table>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Mass Defect & Binding Energy</div>
  <p>A bound nucleus weighs <span class="edu-highlight">less</span> than the sum of its free nucleons. The missing mass was converted to energy — the binding energy — released when it formed. This is the most dramatic real-world demonstration of E = mc².</p>
  <div class="edu-equation-inline">${mathHtml('E_B = \\bigl(Z m_p + N m_n - M_{\\text{nucleus}}\\bigr)c^2', false)}</div>
  <table class="edu-def-table">
    <tr><td><em>Z</em></td><td>proton count · <em>N</em> neutron count</td></tr>
    <tr><td><em>M</em></td><td>actual nucleus mass</td></tr>
  </table>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Magic Numbers</div>
  <p>Nucleons fill <span class="edu-highlight">nuclear shells</span> just as electrons fill atomic shells. Nuclei with 2, 8, 20, 28, 50, 82 protons or neutrons are exceptionally stable — these are "magic numbers". Helium-4 is doubly magic (Z=2, N=2) which is why it's the product of stellar helium burning. Keep building — exotic nuclei await.</p>
</div>`,
      hint: '⚛️ Add protons and neutrons one at a time. Each snaps into the growing nucleus. Reach 2p+2n to form Helium-4 and unlock the next scale.',
    });
    EventBus.emit('edu:event', { text: 'Proton ready at the nucleus — add nucleons to build upward.' });
  }

  private showDiscoveryModal(info: NucleusInfo, protons: number, neutrons: number): void {
    const modal = document.getElementById('discovery-modal')!;
    const card = document.getElementById('discovery-card')!;
    const badge = document.getElementById('discovery-badge')!;
    const symbol = document.getElementById('discovery-symbol')!;

    badge.textContent = info.isEasterEgg ? '🥚 EASTER EGG UNLOCKED' : 'NEW NUCLEUS FORMED';
    badge.className = info.isEasterEgg ? 'easter-egg' : '';

    const r = (info.accentColor >> 16) & 0xff;
    const g = (info.accentColor >> 8) & 0xff;
    const b = info.accentColor & 0xff;
    card.style.boxShadow = `0 0 60px rgba(${r},${g},${b},0.35), 0 0 0 1px rgba(${r},${g},${b},0.2)`;
    card.style.borderColor = `rgba(${r},${g},${b},0.3)`;

    symbol.textContent = info.symbol;
    symbol.style.color = `rgb(${r},${g},${b})`;
    document.getElementById('discovery-name')!.textContent = info.name;
    document.getElementById('discovery-quarks')!.textContent = `${protons}p + ${neutrons}n`;
    document.getElementById('discovery-charge')!.textContent = `Charge: +${protons}`;
    document.getElementById('discovery-mass')!.textContent = `Mass: ${info.mass}`;
    document.getElementById('discovery-fact')!.textContent = info.fact;

    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');

    const close = document.getElementById('discovery-close')!;
    const dismiss = () => {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
      close.onclick = null;
    };
    close.onclick = dismiss;
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

function createNucleonLabel(kind: 'proton' | 'neutron'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const letter = kind === 'proton' ? 'p' : 'n';
  const color = kind === 'proton' ? 'rgb(91, 188, 255)' : 'rgb(190, 200, 216)';
  ctx.font = 'bold 36px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillText(letter, 33, 33);
  ctx.fillStyle = color;
  ctx.fillText(letter, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.5, 0.5, 1);
  return sprite;
}
