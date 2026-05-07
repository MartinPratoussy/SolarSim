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

// Physics constants — shorter Yukawa range prevents long-distance clumping.
// Coulomb repulsion between protons makes them push apart at medium range,
// only binding when they collide with enough energy (like real nuclear fusion).
const YUKAWA_STRENGTH = 2.8;
const YUKAWA_RANGE    = 0.85;  // fm — attraction drops off much faster than before
const COULOMB_PP      = 0.50;  // proton-proton Coulomb repulsion at all distances
const HARD_CORE_DIST  = 0.62;  // fm — minimum separation (Pauli exclusion)
const HARD_CORE_STR   = 3.0;
const DAMPING         = 0.986; // slightly higher damping for readable dynamics
const CENTER_PULL     = 0.030; // gentle restoring force keeps nucleons on screen

const SCALE_INDEX   = 1;
const MAX_NUCLEONS  = 24;
const BOND_DRAW_DIST = 1.6; // tighter than before — only draw genuine bonds
const MAX_HINT_LABELS = 6;

export class Scale2Nuclear implements IScale {
  readonly name = 'Scale 2 — Nuclear';
  readonly scaleLabel = '10⁻¹⁵ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;

  private nucleons: Nucleon[] = [];
  private simTime = 0;
  private completed = false;
  private discoveredNuclei = new Set<string>();

  // Bond line visuals
  private bondGeo: THREE.BufferGeometry | null = null;
  private bondMat: THREE.LineBasicMaterial | null = null;
  private bondLines: THREE.LineSegments | null = null;
  private bondPosArr: Float32Array = new Float32Array(0);
  private bondColArr: Float32Array = new Float32Array(0);

  // Cluster hint label sprites (one per recognized cluster)
  private hintSprites: THREE.Sprite[] = [];
  private hintCanvases: HTMLCanvasElement[] = [];
  private hintTextures: THREE.CanvasTexture[] = [];

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x788ea8, 0.95));
    const light = new THREE.PointLight(0x9dd5ff, 8, 40, 2);
    light.position.set(0, 0, 12);
    this.scene.add(light, createBackdrop());
    this.nucleons = [];
    this.simTime = 0;
    this.completed = false;
    this.discoveredNuclei.clear();
    this.initBondVisuals();
    this.initHintSprites();
    this.spawnInitialNucleons();
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
    this.hintTextures.forEach((t) => t.dispose());
    this.hintSprites.forEach((s) => (s.material as THREE.SpriteMaterial).dispose());
    this.hintSprites = [];
    this.hintCanvases = [];
    this.hintTextures = [];
    this.scene.clear();
    this.nucleons = [];
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) return;
    const step = Math.min(dt, 0.033);
    this.simTime += step;
    this.integrate(step);
    this.detectMilestones();
    this.updateBondVisuals();
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

  // ── Physics ───────────────────────────────────────────────────────────

  private integrate(dt: number): void {
    const free = this.nucleons.filter((n) => !n.locked);
    const acc: THREE.Vector2[] = free.map(() => new THREE.Vector2());

    // Gentle center pull — prevents nucleons drifting off-screen
    free.forEach((n, i) => acc[i].addScaledVector(n.position, -CENTER_PULL));

    // Pairwise nuclear forces
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i];
        const b = free[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.3);
        const invDist = 1 / dist;

        // Residual strong force (Yukawa) — short-range attraction
        const yukawa = YUKAWA_STRENGTH * Math.exp(-dist / YUKAWA_RANGE) / (dist * dist + 0.15);

        // Coulomb repulsion (proton-proton only) — long-range, explains fusion barrier
        const coulomb = (a.kind === 'proton' && b.kind === 'proton')
          ? COULOMB_PP / (dist * dist + 0.3)
          : 0;

        // Hard-core repulsion — nucleons can't overlap
        const hardCore = dist < HARD_CORE_DIST ? HARD_CORE_STR : 0;

        const strength = yukawa - coulomb - hardCore;
        const fx = dx * invDist * strength;
        const fy = dy * invDist * strength;
        acc[i].x += fx;
        acc[i].y += fy;
        acc[j].x -= fx;
        acc[j].y -= fy;
      }
    }

    // Integrate positions
    free.forEach((n, i) => {
      n.velocity.x += acc[i].x * dt;
      n.velocity.y += acc[i].y * dt;
      n.velocity.multiplyScalar(DAMPING);
      n.velocity.clampLength(0, 12);
      n.position.x += n.velocity.x * dt * 3.0;
      n.position.y += n.velocity.y * dt * 3.0;
      n.mesh.position.set(n.position.x, n.position.y, 0);
      const mat = n.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.7 + Math.sin(this.simTime * 2.5 + i) * 0.2;
    });

    // Locked He-4 celebratory wobble
    const locked = this.nucleons.filter((n) => n.locked);
    if (locked.length === 4) {
      const slots = [
        new THREE.Vector2(-0.45,  0.35),
        new THREE.Vector2( 0.45,  0.35),
        new THREE.Vector2(-0.45, -0.35),
        new THREE.Vector2( 0.45, -0.35),
      ];
      locked.forEach((n, i) => {
        const wobble = new THREE.Vector2(
          Math.sin(this.simTime * 1.5 + i * 1.3) * 0.05,
          Math.cos(this.simTime * 1.8 + i * 0.9) * 0.05,
        );
        n.position.lerp((slots[i] ?? new THREE.Vector2()).clone().add(wobble), 0.1);
        n.mesh.position.set(n.position.x, n.position.y, 0);
        const mat = n.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.2 + Math.sin(this.simTime * 4 + i) * 0.3;
      });
    }
  }

  // ── Milestone detection ───────────────────────────────────────────────

  private detectMilestones(): void {
    const clusters = this.buildClusters();
    for (const cluster of clusters) {
      const protons  = cluster.filter((n) => n.kind === 'proton').length;
      const neutrons = cluster.filter((n) => n.kind === 'neutron').length;
      const total    = protons + neutrons;
      if (!NUCLEUS_TARGET_SIZES.includes(total as (typeof NUCLEUS_TARGET_SIZES)[number])) continue;
      const key = `${protons}p${neutrons}n`;
      const info = NUCLEUS_DATA[key];
      if (!info || this.discoveredNuclei.has(key)) continue;
      // Only trigger when the cluster has settled (low average speed)
      const avgSpeed = cluster.reduce((s, n) => s + n.velocity.length(), 0) / cluster.length;
      if (avgSpeed > 2.0) continue;

      this.discoveredNuclei.add(key);
      this.showDiscoveryModal(info, protons, neutrons);
      EventBus.emit('edu:event', { text: `${info.name} (${info.symbol}) formed — ${info.bindingEnergy} binding energy` });
      EventBus.emit('toast', { title: `${info.name} formed`, body: `${protons}p + ${neutrons}n · ${info.bindingEnergy}` });

      // Scale goal: Helium-4
      if (key === '2p2n' && !this.completed) {
        this.completed = true;
        cluster.forEach((n) => { n.locked = true; n.velocity.set(0, 0); });
        EventBus.emit('edu:event', { text: 'Helium-4 assembled — doubly magic nucleus! 28.3 MeV binding energy.' });
        EventBus.emit('scale:complete', { scale: SCALE_INDEX });
      }

      // Be-8 easter egg — decays almost instantly in real life; scatter it
      if (key === '4p4n') {
        window.setTimeout(() => {
          cluster.forEach((n) => {
            const dir = n.position.clone().normalize();
            if (dir.length() < 0.01) dir.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
            n.velocity.addScaledVector(dir, 4 + Math.random() * 3);
          });
          EventBus.emit('edu:event', { text: '⁸Be decayed: splits back to 2×⁴He in 8.2×10⁻¹⁷ s (simulated as 1.5 s)!' });
        }, 1500);
      }
    }
  }

  private buildClusters(): Nucleon[][] {
    const visited = new Set<Nucleon>();
    const clusters: Nucleon[][] = [];
    for (const n of this.nucleons) {
      if (visited.has(n)) continue;
      const cluster: Nucleon[] = [];
      const queue = [n];
      while (queue.length) {
        const cur = queue.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        cluster.push(cur);
        for (const other of this.nucleons) {
          if (!visited.has(other) && cur.position.distanceTo(other.position) <= BOND_DRAW_DIST) {
            queue.push(other);
          }
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }

  // ── Nucleon lifecycle ────────────────────────────────────────────────────

  private spawnInitialNucleons(): void {
    // Start with a proton and neutron nearby, moving gently toward each other
    const p = this.makeNucleon('proton',  -1.4, 0.5);
    p.velocity.set(0.6, -0.2);
    this.nucleons.push(p);
    this.scene.add(p.mesh);
    const n = this.makeNucleon('neutron', 1.4, -0.5);
    n.velocity.set(-0.6, 0.2);
    this.nucleons.push(n);
    this.scene.add(n.mesh);
  }

  private spawnNucleon(kind: 'proton' | 'neutron'): void {
    if (this.nucleons.length >= MAX_NUCLEONS) return;
    // Spawn at a random angle, medium distance from center
    const angle = Math.random() * Math.PI * 2;
    const r = 4.5 + Math.random() * 2.5;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    const n = this.makeNucleon(kind, x, y);
    // Gentle inward nudge — player can aim by timing, but it's not a rail-gun
    n.velocity.set(-x, -y).normalize().multiplyScalar(1.5 + Math.random() * 1.5);
    this.nucleons.push(n);
    this.scene.add(n.mesh);
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
    return { kind, mesh, position: new THREE.Vector2(x, y), velocity: new THREE.Vector2(), locked: false };
  }

  private energyBoost(): void {
    this.nucleons.filter((n) => !n.locked).forEach((n) => {
      const kick = new THREE.Vector2((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
      n.velocity.addScaledVector(kick, 3.5 + Math.random() * 3);
    });
    EventBus.emit('edu:event', { text: '⚡ Energy boost — simulates nuclear excitation. Breaks clusters apart.' });
  }

  // ── Bond & hint label visuals ─────────────────────────────────────────

  private initBondVisuals(): void {
    const maxPairs = (MAX_NUCLEONS * (MAX_NUCLEONS - 1)) / 2;
    this.bondPosArr = new Float32Array(maxPairs * 6);
    this.bondColArr = new Float32Array(maxPairs * 6);
    this.bondGeo = new THREE.BufferGeometry();
    this.bondGeo.setAttribute('position', new THREE.BufferAttribute(this.bondPosArr, 3));
    this.bondGeo.setAttribute('color', new THREE.BufferAttribute(this.bondColArr, 3));
    this.bondMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false });
    this.bondLines = new THREE.LineSegments(this.bondGeo, this.bondMat);
    this.bondLines.renderOrder = 2;
    this.scene.add(this.bondLines);
  }

  private initHintSprites(): void {
    for (let i = 0; i < MAX_HINT_LABELS; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 56;
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
      );
      sprite.scale.set(3.2, 0.7, 1);
      sprite.renderOrder = 3;
      sprite.visible = false;
      this.hintCanvases.push(canvas);
      this.hintTextures.push(texture);
      this.hintSprites.push(sprite);
      this.scene.add(sprite);
    }
  }

  private updateBondVisuals(): void {
    if (!this.bondGeo) return;
    const all = this.nucleons;
    let bondCount = 0;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dist = a.position.distanceTo(b.position);
        if (dist > BOND_DRAW_DIST) continue;
        const t = 1 - dist / BOND_DRAW_DIST;
        let r: number, g: number, bl: number;
        if (a.kind !== b.kind) {
          [r, g, bl] = [0.2, 0.9, 1.0];     // cyan: p-n (residual strong force)
        } else if (a.kind === 'proton') {
          [r, g, bl] = [1.0, 0.55, 0.1];    // orange: p-p (Coulomb competing)
        } else {
          [r, g, bl] = [0.45, 0.62, 0.88];  // blue-gray: n-n
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
        bondCount++;
      }
    }
    this.bondGeo.setDrawRange(0, bondCount * 2);
    (this.bondGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.bondGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // Update floating cluster name labels
    const clusters = this.buildClusters();
    let labelIdx = 0;
    for (const cluster of clusters) {
      if (labelIdx >= MAX_HINT_LABELS || cluster.length < 2) continue;
      const protons  = cluster.filter((n) => n.kind === 'proton').length;
      const neutrons = cluster.filter((n) => n.kind === 'neutron').length;
      const key = `${protons}p${neutrons}n`;
      const info = NUCLEUS_DATA[key];
      if (!info) continue;
      const centroid = cluster
        .reduce((acc, n) => acc.add(n.position), new THREE.Vector2())
        .multiplyScalar(1 / cluster.length);
      const maxR = cluster.reduce((mx, n) => Math.max(mx, centroid.distanceTo(n.position)), 0.38);
      const sprite = this.hintSprites[labelIdx];
      sprite.position.set(centroid.x, centroid.y + maxR + 0.75, 0.3);
      sprite.visible = true;
      const ctx = this.hintCanvases[labelIdx].getContext('2d')!;
      ctx.clearRect(0, 0, 256, 56);
      ctx.fillStyle = 'rgba(8, 16, 36, 0.82)';
      ctx.beginPath();
      ctx.roundRect(2, 2, 252, 52, 10);
      ctx.fill();
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = info.isEasterEgg ? '#f0abfc' : '#7dd3fc';
      ctx.fillText(`${info.symbol}  ${info.name}`, 128, 28);
      this.hintTextures[labelIdx].needsUpdate = true;
      labelIdx++;
    }
    for (let i = labelIdx; i < MAX_HINT_LABELS; i++) this.hintSprites[i].visible = false;
  }

  // ── UI ────────────────────────────────────────────────────────────────

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ Proton',  () => this.spawnNucleon('proton')));
    actionBar.appendChild(this.makeButton('+ Neutron', () => this.spawnNucleon('neutron')));
    actionBar.appendChild(this.makeButton('⚡ Energy boost', () => this.energyBoost()));
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
      hint: '⚛️ Add protons and neutrons. They attract via the residual strong force but protons repel each other — just like real fusion! Reach 2p+2n to form Helium-4 and unlock the next scale.',
    });
    EventBus.emit('edu:event', { text: 'Proton and neutron in play — use ⚡ Energy boost to scatter them if they clump.' });
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
