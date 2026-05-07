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
  pulse: number;
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
const MAX_NUCLEONS = 24;
const BOND_RANGE = 2.5;   // units within which nucleons attract each other
const MAX_HINT_LABELS = 4; // max simultaneous forming-nucleus labels

export class Scale2Nuclear implements IScale {
  readonly name = 'Scale 2 — Nuclear';
  readonly scaleLabel = '10⁻¹⁵ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;
  private nucleons: Nucleon[] = [];
  private completed = false;
  private heliumCenter = new THREE.Vector2();
  private heliumPhase = 0;
  private discoveredNuclei = new Set<string>();

  // Bond line visuals
  private bondGeo: THREE.BufferGeometry | null = null;
  private bondMat: THREE.LineBasicMaterial | null = null;
  private bondLines: THREE.LineSegments | null = null;
  private bondPosArr: Float32Array = new Float32Array(0);
  private bondColArr: Float32Array = new Float32Array(0);

  // Forming-nucleus label sprites
  private hintSprites: THREE.Sprite[] = [];
  private hintTextures: THREE.CanvasTexture[] = [];
  private hintCanvases: HTMLCanvasElement[] = [];

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x788ea8, 0.95));
    const light = new THREE.PointLight(0x9dd5ff, 8, 40, 2);
    light.position.set(0, 0, 12);
    this.scene.add(light, createBackdrop());
    this.nucleons = [];
    this.completed = false;
    this.heliumCenter.set(0, 0);
    this.heliumPhase = 0;
    this.discoveredNuclei.clear();
    this.initBondVisuals();
    this.spawnNucleon('proton', -1.6, 0.3);
    this.spawnNucleon('neutron', 1.6, -0.3);
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    document.getElementById('discovery-close')!.onclick = null;
    document.getElementById('discovery-modal')!.classList.remove('visible');
    document.getElementById('discovery-modal')!.setAttribute('aria-hidden', 'true');
    // Clean up bond line resources
    if (this.bondLines) {
      this.scene.remove(this.bondLines);
      this.bondGeo?.dispose();
      this.bondMat?.dispose();
      this.bondLines = null;
      this.bondGeo = null;
      this.bondMat = null;
    }
    // Clean up forming label sprites
    for (let i = 0; i < this.hintSprites.length; i++) {
      this.scene.remove(this.hintSprites[i]);
      this.hintTextures[i].dispose();
      (this.hintSprites[i].material as THREE.SpriteMaterial).dispose();
    }
    this.hintSprites = [];
    this.hintTextures = [];
    this.hintCanvases = [];
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
    this.updateBondVisuals();
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

  private initBondVisuals(): void {
    const maxPairs = (MAX_NUCLEONS * (MAX_NUCLEONS - 1)) / 2;
    this.bondPosArr = new Float32Array(maxPairs * 6); // 2 endpoints × 3 coords
    this.bondColArr = new Float32Array(maxPairs * 6);
    this.bondGeo = new THREE.BufferGeometry();
    this.bondGeo.setAttribute('position', new THREE.BufferAttribute(this.bondPosArr, 3));
    this.bondGeo.setAttribute('color', new THREE.BufferAttribute(this.bondColArr, 3));
    this.bondMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthTest: false });
    this.bondLines = new THREE.LineSegments(this.bondGeo, this.bondMat);
    this.bondLines.renderOrder = 2;
    this.scene.add(this.bondLines);

    this.hintSprites = [];
    this.hintTextures = [];
    this.hintCanvases = [];
    for (let i = 0; i < MAX_HINT_LABELS; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 50;
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.scale.set(0, 0, 1); // hidden until needed
      sprite.renderOrder = 3;
      this.scene.add(sprite);
      this.hintSprites.push(sprite);
      this.hintTextures.push(texture);
      this.hintCanvases.push(canvas);
    }
  }

  private updateBondVisuals(): void {
    if (!this.bondGeo) {
      return;
    }

    // Reset free nucleon glow before recalculating
    for (const n of this.nucleons) {
      if (!n.locked) {
        (n.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7;
      }
    }

    let bondCount = 0;
    for (let i = 0; i < this.nucleons.length; i++) {
      for (let j = i + 1; j < this.nucleons.length; j++) {
        const a = this.nucleons[i];
        const b = this.nucleons[j];
        const dist = a.position.distanceTo(b.position);
        if (dist > BOND_RANGE) {
          continue;
        }
        const t = 1 - dist / BOND_RANGE; // 0→1, closer = stronger
        // p-n: cyan (strongest attraction), p-p: orange (Coulomb competes), n-n: blue-gray
        let r: number;
        let g: number;
        let bl: number;
        if (a.kind !== b.kind) {
          [r, g, bl] = [0.2, 0.9, 1.0];
        } else if (a.kind === 'proton') {
          [r, g, bl] = [1.0, 0.55, 0.1];
        } else {
          [r, g, bl] = [0.45, 0.62, 0.88];
        }
        const alpha = 0.12 + 0.65 * t * t;
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

        // Glow boost proportional to bond strength
        if (!a.locked) {
          const mat = a.mesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.7 + 0.85 * t);
        }
        if (!b.locked) {
          const mat = b.mesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.7 + 0.85 * t);
        }
      }
    }

    this.bondGeo.setDrawRange(0, bondCount * 2);
    (this.bondGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.bondGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // Forming-nucleus labels: find connected clusters, match to known nuclei
    const clusters = this.buildClusters();
    let spriteIdx = 0;
    for (const cluster of clusters) {
      if (spriteIdx >= MAX_HINT_LABELS) {
        break;
      }
      if (cluster.some((n) => n.locked)) {
        continue; // already a completed nucleus
      }
      const protons = cluster.filter((n) => n.kind === 'proton').length;
      const neutrons = cluster.length - protons;
      const key = `${protons}p${neutrons}n`;
      const info = NUCLEUS_DATA[key];
      if (!info) {
        continue;
      }

      const centroid = cluster
        .reduce((acc, n) => acc.add(n.position), new THREE.Vector2())
        .multiplyScalar(1 / cluster.length);

      const canvas = this.hintCanvases[spriteIdx];
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(8, 16, 36, 0.82)';
      ctx.beginPath();
      ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 9);
      ctx.fill();
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = info.isEasterEgg ? '#f0abfc' : '#7dd3fc';
      ctx.fillText(`→ ${info.symbol} ${info.name}`, canvas.width / 2, canvas.height / 2);
      this.hintTextures[spriteIdx].needsUpdate = true;

      const sprite = this.hintSprites[spriteIdx];
      sprite.scale.set(2.8, 0.64, 1);
      sprite.position.set(centroid.x, centroid.y + 1.0, 0.3);
      spriteIdx++;
    }
    // Hide any unused sprites
    for (let i = spriteIdx; i < MAX_HINT_LABELS; i++) {
      this.hintSprites[i].scale.set(0, 0, 1);
    }
  }

  private buildClusters(): Nucleon[][] {
    const visited = new Set<number>();
    const clusters: Nucleon[][] = [];
    for (let i = 0; i < this.nucleons.length; i++) {
      if (visited.has(i)) {
        continue;
      }
      const cluster: Nucleon[] = [];
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const idx = queue.shift()!;
        cluster.push(this.nucleons[idx]);
        for (let j = 0; j < this.nucleons.length; j++) {
          if (!visited.has(j) && this.nucleons[idx].position.distanceTo(this.nucleons[j].position) <= BOND_RANGE) {
            visited.add(j);
            queue.push(j);
          }
        }
      }
      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }
    return clusters;
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
  <p>Nucleons fill <span class="edu-highlight">nuclear shells</span> just as electrons fill atomic shells. Nuclei with 2, 8, 20, 28, 50, 82 protons or neutrons are exceptionally stable — these are "magic numbers". Helium-4 is doubly magic (Z=2, N=2) which is why it\'s the product of stellar helium burning. Keep building — exotic nuclei await.</p>
</div>`,
      hint: '🔬 Spawn protons and neutrons. Get 2 of each close together to form Helium-4 and unlock the next scale. Bigger combos may trigger easter eggs!',
    });
    EventBus.emit('edu:event', { text: 'Proton and neutron emerging from the quark scale — residual strong force active.' });
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
    const label = createNucleonLabel(kind);
    label.position.set(0, 0, 0.35);
    mesh.add(label);
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
    if (!this.completed && this.nucleons.length >= 4) {
      let heliumFormed = false;
      for (let a = 0; a < this.nucleons.length && !heliumFormed; a += 1) {
        for (let b = a + 1; b < this.nucleons.length && !heliumFormed; b += 1) {
          for (let c = b + 1; c < this.nucleons.length && !heliumFormed; c += 1) {
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
              heliumFormed = true;
              EventBus.emit('edu:event', { text: 'Helium-4 assembled. Mass defect converted into ≈28.3 MeV of binding energy.' });
              EventBus.emit('toast', { title: 'Helium-4 nucleus complete', body: 'Two protons and two neutrons snapped into one of nature’s most stable light nuclei.' });
              EventBus.emit('scale:complete', { scale: SCALE_INDEX });
              break;
            }
          }
        }
      }
    }

    for (const size of NUCLEUS_TARGET_SIZES) {
      if (this.nucleons.length < size) {
        continue;
      }
      const nucleusKeys = Object.keys(NUCLEUS_DATA).filter((key) => {
        const info = NUCLEUS_DATA[key];
        return info.protons + info.neutrons === size && !this.discoveredNuclei.has(key);
      });
      for (const key of nucleusKeys) {
        this.searchForNucleus(NUCLEUS_DATA[key]);
      }
    }
  }

  private searchForNucleus(info: NucleusInfo): void {
    const key = `${info.protons}p${info.neutrons}n`;
    if (this.discoveredNuclei.has(key)) {
      return;
    }
    const protonPool = this.nucleons.filter((nucleon) => nucleon.kind === 'proton');
    const neutronPool = this.nucleons.filter((nucleon) => nucleon.kind === 'neutron');
    if (protonPool.length < info.protons || neutronPool.length < info.neutrons) {
      return;
    }

    const targetSize = info.protons + info.neutrons;
    const neighborhoodRadius = 1.5 * Math.sqrt(targetSize);
    for (let anchorIndex = 0; anchorIndex < this.nucleons.length; anchorIndex += 1) {
      const anchor = this.nucleons[anchorIndex];
      const remainingProtons = info.protons - (anchor.kind === 'proton' ? 1 : 0);
      const remainingNeutrons = info.neutrons - (anchor.kind === 'neutron' ? 1 : 0);
      if (remainingProtons < 0 || remainingNeutrons < 0) {
        continue;
      }

      const nearby = this.nucleons.filter((candidate, candidateIndex) => (
        candidateIndex > anchorIndex && candidate.position.distanceTo(anchor.position) <= neighborhoodRadius
      ));
      const nearbyProtons = nearby.filter((candidate) => candidate.kind === 'proton').length;
      const nearbyNeutrons = nearby.length - nearbyProtons;
      if (nearbyProtons < remainingProtons || nearbyNeutrons < remainingNeutrons) {
        continue;
      }

      const cluster = [anchor];
      if (this.collectNucleusCluster(nearby, 0, remainingProtons, remainingNeutrons, targetSize - 1, cluster, key)) {
        return;
      }
    }
  }

  private collectNucleusCluster(
    candidates: Nucleon[],
    start: number,
    remainingProtons: number,
    remainingNeutrons: number,
    remainingSlots: number,
    cluster: Nucleon[],
    key: string,
  ): boolean {
    if (remainingSlots === 0) {
      this.tryRecordNucleus([...cluster]);
      return this.discoveredNuclei.has(key);
    }
    if (candidates.length - start < remainingSlots) {
      return false;
    }

    for (let index = start; index <= candidates.length - remainingSlots; index += 1) {
      const candidate = candidates[index];
      const nextProtons = remainingProtons - (candidate.kind === 'proton' ? 1 : 0);
      const nextNeutrons = remainingNeutrons - (candidate.kind === 'neutron' ? 1 : 0);
      if (nextProtons < 0 || nextNeutrons < 0) {
        continue;
      }

      let availableProtons = 0;
      let availableNeutrons = 0;
      for (let remainingIndex = index + 1; remainingIndex < candidates.length; remainingIndex += 1) {
        if (candidates[remainingIndex].kind === 'proton') {
          availableProtons += 1;
        } else {
          availableNeutrons += 1;
        }
      }
      if (availableProtons < nextProtons || availableNeutrons < nextNeutrons) {
        continue;
      }

      cluster.push(candidate);
      if (this.collectNucleusCluster(candidates, index + 1, nextProtons, nextNeutrons, remainingSlots - 1, cluster, key)) {
        return true;
      }
      cluster.pop();
    }

    return false;
  }

  private tryRecordNucleus(cluster: Nucleon[]): void {
    const protons = cluster.filter((n) => n.kind === 'proton').length;
    const neutrons = cluster.filter((n) => n.kind === 'neutron').length;
    const key = `${protons}p${neutrons}n`;
    const info = NUCLEUS_DATA[key];
    if (!info || this.discoveredNuclei.has(key)) {
      return;
    }
    const centroid = cluster.reduce((acc, n) => acc.add(n.position), new THREE.Vector2()).multiplyScalar(1 / cluster.length);
    const maxRadius = 0.75 * Math.sqrt(cluster.length);
    if (cluster.some((n) => n.position.distanceTo(centroid) > maxRadius)) {
      return;
    }
    this.discoveredNuclei.add(key);
    this.showDiscoveryModal(info, protons, neutrons);
    EventBus.emit('edu:event', { text: `${info.name} (${info.symbol}) detected — ${info.bindingEnergy} binding energy` });
    EventBus.emit('toast', { title: `${info.name} formed`, body: `${protons} protons + ${neutrons} neutrons, BE = ${info.bindingEnergy}` });
    if (key === '4p4n') {
      window.setTimeout(() => {
        EventBus.emit('edu:event', { text: 'Be-8 decayed: ⁸Be → 2×⁴He (8.2×10⁻¹⁷ s lifetime — simulated as 1.5s)' });
        cluster.forEach((n) => {
          n.locked = false;
        });
      }, 1500);
    }
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
