import * as THREE from 'three';
import { EventBus } from '../EventBus';
import { mathHtml } from '../EduPanel';
import type { IScale } from '../ScaleManager';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElementInfo {
  name: string; symbol: string; Z: number;
  shells: number[];   // electrons per shell in neutral atom (e.g. [2,4] for Carbon)
  color: number;
  fact: string;
}

interface OrbitalRing {
  mesh: THREE.Mesh;
  uniforms: { time: { value: number }; color: { value: THREE.Color }; opacity: { value: number } };
  radius: number;
}

interface NucleusObj {
  Z: number;
  position: THREE.Vector3;
  group: THREE.Group;
  orbitals: OrbitalRing[];
  assignedElectrons: number;
}

interface ElectronObj {
  nucleus: NucleusObj;
  mesh: THREE.Mesh;
  shellN: number;       // 1-indexed
  slotIndex: number;    // position within shell for angle offset
  state: 'free' | 'spiral' | 'orbital' | 'excited';
  angle: number;
  spiralTimer: number;
  spiralStartR: number;
  exciteTimer: number;
}

interface PhotonObj {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Physical max electrons per shell (n=1: 2, n=2: 8, n=3: 18) */
const SHELL_MAX    = [2, 8, 18];
/** Visual orbital radii per shell */
const SHELL_RADII  = [1.7, 3.6, 5.8];
const SCALE_INDEX  = 2;
const MAX_NUCLEI   = 4;
const DISCOVER_WIN = 4;

const NUCLEUS_SLOTS: THREE.Vector3[] = [
  new THREE.Vector3(-5,  2.2, 0),
  new THREE.Vector3( 3,  2.2, 0),
  new THREE.Vector3(-5, -2.2, 0),
  new THREE.Vector3( 3, -2.2, 0),
];

// ─── Element Data H–Ne ────────────────────────────────────────────────────────

const ELEMENTS: Record<number, ElementInfo> = {
  1:  { name: 'Hydrogen',  symbol: 'H',  Z: 1,  shells: [1],   color: 0x90cdf4,
        fact: 'The simplest atom — 1 proton, 1 electron. Makes up 75 % of all visible matter. Its lone electron occupies the 1s shell at −13.6 eV. Hydrogen\'s discrete emission lines directly inspired Bohr\'s atomic model in 1913.' },
  2:  { name: 'Helium',    symbol: 'He', Z: 2,  shells: [2],   color: 0xffd75e,
        fact: 'Noble gas. Two electrons fill the 1s shell completely — a closed shell that makes helium chemically inert. It was discovered in the Sun\'s spectrum 27 years before it was found on Earth.' },
  3:  { name: 'Lithium',   symbol: 'Li', Z: 3,  shells: [2,1], color: 0xc4b5fd,
        fact: 'First alkali metal. Two electrons fill the 1s shell; one lone valence electron sits in 2s. That outermost electron is weakly bound and makes Li highly reactive with water and air.' },
  4:  { name: 'Beryllium', symbol: 'Be', Z: 4,  shells: [2,2], color: 0x6ee7b7,
        fact: 'Alkaline earth metal. Two electrons in 1s, two in 2s. Beryllium is exceptionally stiff and lightweight for its mass — used in aerospace alloys and X-ray windows.' },
  5:  { name: 'Boron',     symbol: 'B',  Z: 5,  shells: [2,3], color: 0xfb923c,
        fact: 'A metalloid. Three electrons in the 2p subshell begin filling the p-block. Boron forms unique icosahedral structures and is essential in borosilicate glass.' },
  6:  { name: 'Carbon',    symbol: 'C',  Z: 6,  shells: [2,4], color: 0xa3e635,
        fact: 'The backbone of life. Four valence electrons in 2s²2p² enable carbon to form 4 covalent bonds — chains, rings, fullerenes, and structures of unlimited complexity.' },
  7:  { name: 'Nitrogen',  symbol: 'N',  Z: 7,  shells: [2,5], color: 0x38bdf8,
        fact: 'Makes up 78 % of Earth\'s atmosphere. N₂ is held by a triple bond (945 kJ/mol). Five valence electrons make nitrogen essential for amino acids, proteins, and DNA.' },
  8:  { name: 'Oxygen',    symbol: 'O',  Z: 8,  shells: [2,6], color: 0xf87171,
        fact: 'Two unpaired 2p electrons make oxygen highly reactive. It forms water (H₂O) and drives combustion. Oxygen is the third most abundant element in the universe by mass.' },
  9:  { name: 'Fluorine',  symbol: 'F',  Z: 9,  shells: [2,7], color: 0xe879f9,
        fact: 'The most electronegative element. One empty slot in 2p makes fluorine aggressively electron-hungry. It forms the strongest single bond with carbon (C–F).' },
  10: { name: 'Neon',      symbol: 'Ne', Z: 10, shells: [2,8], color: 0x67e8f9,
        fact: 'Noble gas. Fills the second shell completely (1s² 2s² 2p⁶). Like helium, neon is chemically inert — the closed shell is too stable to react with anything.' },
};

// ─── Scale class ──────────────────────────────────────────────────────────────

export class Scale3Atomic implements IScale {
  readonly name = 'Scale 3 — Atomic';
  readonly scaleLabel = '10⁻¹⁰ m';

  private scene    = new THREE.Scene();
  private camera   = new THREE.OrthographicCamera(-14, 14, 8, -8, 0.1, 60);
  private renderer: THREE.WebGLRenderer | null = null;

  private nuclei:    NucleusObj[]  = [];
  private electrons: ElectronObj[] = [];
  private photons:   PhotonObj[]   = [];

  private discovered = new Set<number>();
  private completed  = false;
  private tableEl:   HTMLElement | null = null;
  private clickCb:   ((e: MouseEvent) => void) | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene    = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x7c96b5, 0.95));
    const light = new THREE.PointLight(0xc5ecff, 10, 55, 2);
    light.position.set(0, 0, 15);
    this.scene.add(light, createBackdrop());

    this.nuclei    = [];
    this.electrons = [];
    this.photons   = [];
    this.discovered.clear();
    this.completed = false;

    this.addNucleus(1);
    this.addNucleus(2);

    this.buildPeriodicTable();
    this.buildActionBar();
    this.emitEducation();

    this.clickCb = (e) => this.handleClick(e);
    renderer.domElement.addEventListener('click', this.clickCb);
  }

  dispose(): void {
    if (this.renderer && this.clickCb) {
      this.renderer.domElement.removeEventListener('click', this.clickCb);
    }
    this.clickCb = null;
    this.tableEl?.remove();
    this.tableEl = null;
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    const modal = document.getElementById('discovery-modal')!;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('discovery-close')!.onclick = null;
    this.scene.clear();
    this.nuclei = []; this.electrons = []; this.photons = [];
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) return;
    const step = Math.min(dt, 0.033);

    this.nuclei.forEach(n => {
      n.orbitals.forEach((r, i) => { r.uniforms.time.value += step * (1 + i * 0.2); });
    });

    this.electrons.forEach(e => this.updateElectron(e, step));

    this.photons = this.photons.filter(p => {
      p.life -= step;
      p.mesh.position.addScaledVector(p.velocity, step);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / 1.6);
      if (p.life <= 0) { this.scene.remove(p.mesh); return false; }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  }

  // ── Nucleus management ────────────────────────────────────────────────────

  private addNucleus(Z: number): boolean {
    if (this.nuclei.find(n => n.Z === Z)) return false;
    if (this.nuclei.length >= MAX_NUCLEI) return false;
    const info = ELEMENTS[Z];
    if (!info) return false;

    const pos   = NUCLEUS_SLOTS[this.nuclei.length].clone();
    const group = new THREE.Group();
    const r     = 0.3 + Z * 0.05;

    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.8, 20, 20),
        new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.14 }),
      ),
      new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshStandardMaterial({ color: info.color, emissive: info.color, emissiveIntensity: 0.75 }),
      ),
    );
    group.position.copy(pos);
    this.scene.add(group);

    // Label sprite (symbol + Z number)
    const label = makeLabelSprite(info.symbol, info.Z, info.color);
    label.position.set(pos.x + r + 0.8, pos.y + r + 0.5, 0.1);
    this.scene.add(label);

    // Orbital rings — lie flat in XY plane (no rotation) → appear as circles from Z camera
    const orbitals: OrbitalRing[] = info.shells.map((_, i) => {
      const ring = createOrbitalRing(SHELL_RADII[i], i + 1, info.color);
      ring.mesh.position.copy(pos);
      // No ring.mesh.rotation — default torus lies in XY plane, visible as a circle ✓
      this.scene.add(ring.mesh);
      return ring;
    });

    const nucleus: NucleusObj = { Z, position: pos, group, orbitals, assignedElectrons: 0 };
    this.nuclei.push(nucleus);
    return true;
  }

  // ── Electron shooting ─────────────────────────────────────────────────────

  /** Convert canvas click → world coords → fire electron */
  private handleClick(e: MouseEvent): void {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    // Orthographic camera centred at origin with half-extents 14 (x) and 8 (y)
    this.fireElectron(ndcX * 14, ndcY * 8);
  }

  private fireElectron(x: number, y: number): void {
    const clickPt = new THREE.Vector3(x, y, 0);
    // Nearest nucleus that still needs electrons
    const target = this.nuclei
      .filter(n => n.assignedElectrons < n.Z)
      .sort((a, b) => a.position.distanceTo(clickPt) - b.position.distanceTo(clickPt))[0];

    if (!target) {
      EventBus.emit('edu:event', { text: 'All nuclei are neutral. Add more elements from the table below.' });
      return;
    }

    const shellIndex = this.pickShell(target);
    if (shellIndex === -1) return;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x9ae6ff }),
    );
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);

    const slotIndex  = this.electrons.filter(e => e.nucleus === target && e.shellN === shellIndex + 1).length;
    const spiralStartR = new THREE.Vector3(x - target.position.x, y - target.position.y, 0).length();

    const el: ElectronObj = {
      nucleus: target, mesh,
      shellN: shellIndex + 1, slotIndex,
      state: 'free',
      angle: Math.random() * Math.PI * 2,
      spiralTimer: 0, spiralStartR,
      exciteTimer: 0,
    };
    target.assignedElectrons++;
    this.electrons.push(el);
    EventBus.emit('edu:event', { text: `⚡ Electron fired toward ${ELEMENTS[target.Z].symbol}.` });
  }

  /** Find the first shell that still has room for a new electron */
  private pickShell(nucleus: NucleusObj): number {
    const info = ELEMENTS[nucleus.Z];
    for (let i = 0; i < info.shells.length; i++) {
      const occupied = this.electrons.filter(e => e.nucleus === nucleus && e.shellN === i + 1).length;
      // Cap at what the neutral atom needs (not the physical max) for cleaner gameplay
      if (occupied < info.shells[i]) return i;
    }
    return -1;
  }

  // ── Electron physics ─────────────────────────────────────────────────────

  private updateElectron(el: ElectronObj, dt: number): void {
    const cx = el.nucleus.position.x, cy = el.nucleus.position.y;
    const targetR = SHELL_RADII[el.shellN - 1];

    if (el.state === 'free') {
      const dx = cx - el.mesh.position.x, dy = cy - el.mesh.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < targetR + 0.6) {
        el.state = 'spiral';
        el.spiralStartR = dist;
        el.spiralTimer  = 0;
        return;
      }
      const spd = 7;
      el.mesh.position.x += (dx / dist) * spd * dt;
      el.mesh.position.y += (dy / dist) * spd * dt;
      return;
    }

    if (el.state === 'spiral') {
      el.spiralTimer = Math.min(el.spiralTimer + dt * 0.8, 1);
      el.angle += dt * 5.5;
      const r = THREE.MathUtils.lerp(el.spiralStartR, targetR, el.spiralTimer);
      el.mesh.position.set(
        cx + Math.cos(el.angle) * r,
        cy + Math.sin(el.angle) * r,
        Math.sin(el.angle * 3) * 0.05,
      );
      if (el.spiralTimer >= 1) {
        el.state = 'orbital';
        EventBus.emit('edu:event', { text: `${ELEMENTS[el.nucleus.Z].symbol} electron settled into n=${el.shellN} shell.` });
        this.checkNeutral(el.nucleus);
      }
      return;
    }

    // orbital or excited
    const baseOffset = (2 * Math.PI * el.slotIndex) / SHELL_MAX[el.shellN - 1];
    const speed      = el.state === 'excited' ? 1.8 : 3.0 / targetR; // inner orbits faster
    el.angle += dt * speed;
    const a = el.angle + baseOffset;
    el.mesh.position.set(cx + Math.cos(a) * targetR, cy + Math.sin(a) * targetR, Math.sin(a * 2) * 0.05);

    if (el.state === 'excited') {
      el.exciteTimer -= dt;
      if (el.exciteTimer <= 0) {
        const from = el.shellN;
        el.shellN  = Math.max(1, el.shellN - 1);
        el.state   = 'orbital';
        this.emitPhoton(el.nucleus.position.clone(), from, el.shellN);
      }
    }
  }

  // ── Neutral check ─────────────────────────────────────────────────────────

  private checkNeutral(nucleus: NucleusObj): void {
    const orbited = this.electrons.filter(e => e.nucleus === nucleus && e.state === 'orbital').length;
    if (orbited < nucleus.Z || this.discovered.has(nucleus.Z)) return;
    this.discovered.add(nucleus.Z);
    this.updateTableUI();
    this.showDiscovery(nucleus.Z);
    const info = ELEMENTS[nucleus.Z];
    EventBus.emit('edu:event', { text: `✨ ${info.name} atom complete! (${info.Z}p / ${info.Z}e⁻)` });
    EventBus.emit('toast', { title: `${info.name} formed!`, body: info.fact.slice(0, 90) + '…' });
    if (this.discovered.size >= DISCOVER_WIN && !this.completed) {
      this.completed = true;
      EventBus.emit('edu:event', { text: 'Enough atoms discovered — the cosmic chemistry of gas clouds and molecules can begin.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }

  // ── Excite & photons ──────────────────────────────────────────────────────

  private exciteAll(): void {
    let any = false;
    this.electrons.forEach(el => {
      if (el.state === 'orbital' && el.shellN < ELEMENTS[el.nucleus.Z].shells.length) {
        el.state = 'excited';
        el.shellN += 1;
        el.exciteTimer = 0.5 + Math.random() * 0.9;
        any = true;
      }
    });
    if (any) EventBus.emit('edu:event', { text: 'Electrons excited — watch photons radiate as they decay back.' });
    else      EventBus.emit('edu:event', { text: 'No electrons to excite (ground state or single-shell only).' });
  }

  private emitPhoton(origin: THREE.Vector3, from: number, to: number): void {
    const color = from === 2 && to === 1 ? 0xff8a65 : from === 3 && to === 2 ? 0x5eead4 : 0xc4b5fd;
    const mesh  = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * 0.3)
      .normalize().multiplyScalar(5);
    this.photons.push({ mesh, velocity: vel, life: 1.6 });
    EventBus.emit('edu:event', { text: `Photon emitted: n=${from}→n=${to} (${photonLabel(from, to)}).` });
  }

  // ── Discovery modal ───────────────────────────────────────────────────────

  private showDiscovery(Z: number): void {
    const info  = ELEMENTS[Z];
    const r = (info.color >> 16) & 0xff;
    const g = (info.color >> 8)  & 0xff;
    const b =  info.color        & 0xff;
    const modal = document.getElementById('discovery-modal')!;
    const card  = document.getElementById('discovery-card')!;

    document.getElementById('discovery-badge')!.textContent = 'ATOM DISCOVERED';
    document.getElementById('discovery-badge')!.className   = '';
    card.style.boxShadow   = `0 0 60px rgba(${r},${g},${b},0.35), 0 0 0 1px rgba(${r},${g},${b},0.2)`;
    card.style.borderColor = `rgba(${r},${g},${b},0.3)`;

    const sym = document.getElementById('discovery-symbol')!;
    sym.textContent = info.symbol;
    sym.style.color = `rgb(${r},${g},${b})`;

    document.getElementById('discovery-name')!.textContent   = info.name;
    document.getElementById('discovery-quarks')!.textContent = `${info.Z}p · ${info.Z}e⁻ · ${info.shells.map((e, i) => `n${i + 1}:${e}`).join(' ')}`;
    document.getElementById('discovery-charge')!.textContent = 'Charge: neutral (0)';
    document.getElementById('discovery-mass')!.textContent   = `Atomic number Z = ${info.Z}`;
    document.getElementById('discovery-fact')!.textContent   = info.fact;

    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('discovery-close')!.onclick = () => {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    };
  }

  // ── Periodic table HTML ───────────────────────────────────────────────────

  private buildPeriodicTable(): void {
    const el = document.createElement('div');
    el.id = 'atomic-table';
    el.innerHTML = `
      <span class="at-title">Periodic Table — click to spawn a nucleus</span>
      <div class="at-grid">
        <div class="at-row">
          ${ptCell(1)}<div class="at-spacer"></div>${ptCell(2)}
        </div>
        <div class="at-row">
          ${[3, 4, 5, 6, 7, 8, 9, 10].map(ptCell).join('')}
        </div>
      </div>
      <span class="at-progress">Discover <strong class="at-count">0</strong> / ${DISCOVER_WIN} elements to continue</span>
    `;
    document.body.appendChild(el);
    this.tableEl = el;

    el.querySelectorAll<HTMLElement>('[data-z]').forEach(cell => {
      cell.addEventListener('click', () => {
        const Z = parseInt(cell.dataset.z!);
        if (this.nuclei.find(n => n.Z === Z)) {
          EventBus.emit('edu:event', { text: `${ELEMENTS[Z].symbol} is already in the scene.` });
          return;
        }
        if (this.nuclei.length >= MAX_NUCLEI) {
          EventBus.emit('edu:event', { text: 'Scene is full (max 4 nuclei at once).' });
          return;
        }
        if (this.addNucleus(Z)) {
          EventBus.emit('edu:event', { text: `${ELEMENTS[Z].name} nucleus spawned — click the canvas to fire electrons at it!` });
        }
      });
    });
  }

  private updateTableUI(): void {
    if (!this.tableEl) return;
    this.tableEl.querySelectorAll<HTMLElement>('[data-z]').forEach(cell => {
      cell.classList.toggle('at-discovered', this.discovered.has(parseInt(cell.dataset.z!)));
    });
    const countEl = this.tableEl.querySelector('.at-count');
    if (countEl) countEl.textContent = String(this.discovered.size);
  }

  // ── Action bar & edu ──────────────────────────────────────────────────────

  private buildActionBar(): void {
    const bar = document.getElementById('action-bar')!;
    bar.innerHTML = '';
    const btn = document.createElement('button');
    btn.textContent = '✨ Excite electrons';
    btn.addEventListener('click', () => this.exciteAll());
    bar.appendChild(btn);
    const hint = document.createElement('span');
    hint.style.cssText = 'color:#7dd3fc;font-size:12px;margin-left:14px;opacity:0.7;pointer-events:none';
    hint.textContent = '🖱 Click anywhere on the scene to shoot electrons';
    bar.appendChild(hint);
  }

  onResize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.left   = -14 * aspect;
    this.camera.right  =  14 * aspect;
    this.camera.top    =  8;
    this.camera.bottom = -8;
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    const body = `
<p>You've zoomed out to the scale of the <span class="edu-highlight">atom</span> — ångströms (Å, 10⁻¹⁰ m). The glowing spheres are <strong>atomic nuclei</strong> from your nuclear forge. The rings around them mark the <span class="edu-highlight">electron shells</span> — quantum energy levels where electrons orbit stably. Right now, these nuclei are bare ions. Your job: bombard them with electrons.</p>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">How to Play</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name">🖱 Click the scene</div>
      <div class="edu-card-sub">Fires an electron toward the nearest incomplete nucleus. Watch it spiral inward and settle into its shell.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">📊 Periodic table</div>
      <div class="edu-card-sub">Click an element below to spawn its nucleus. You can have up to 4 active nuclei at once.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">✨ Excite</div>
      <div class="edu-card-sub">Bumps all electrons to the next shell. They decay and emit coloured photons — real quantum emission!</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Bohr Energy Levels</div>
  <p>Electrons may only occupy <span class="edu-highlight">discrete shells</span>. For hydrogen, the energy of shell <em>n</em> is:</p>
  <div class="edu-equation-inline">${mathHtml('E_n = -\\dfrac{13.6\\,\\text{eV}}{n^2}', false)}</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name">n = 1 · ground state</div>
      <div class="edu-card-sub">E = −13.6 eV — most stable. Electrons sit here unless given energy to jump higher.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">n = 2 · first excited</div>
      <div class="edu-card-sub">E = −3.4 eV — temporary. Falls back quickly and radiates the energy difference as a photon.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">n = ∞ · ionisation</div>
      <div class="edu-card-sub">E = 0 — electron escapes the atom entirely. Requires 13.6 eV from the ground state.</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Spectral Lines — Photon Emission</div>
  <p>When an excited electron falls from n₂ to n₁, the energy difference escapes as a photon. The <span class="edu-highlight">Rydberg formula</span> gives its wavelength:</p>
  <div class="edu-equation-inline">${mathHtml('\\dfrac{1}{\\lambda} = R_H\\!\\left(\\dfrac{1}{n_1^2}-\\dfrac{1}{n_2^2}\\right)', false)}</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name" style="color:#ff8a65">2→1 · Lyman-α</div>
      <div class="edu-card-sub">121.6 nm ultraviolet — the brightest line in hydrogen nebulae, seen from quasars billions of light years away.</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name" style="color:#5eead4">3→2 · Hα Balmer</div>
      <div class="edu-card-sub">656 nm visible red — colours nebulae pink-red in telescope images. The most iconic spectral line in astronomy.</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Aufbau — Shell Filling Order</div>
  <p>Electrons fill the <span class="edu-highlight">lowest available shell</span> first. Shell n=1 holds <strong>2 electrons</strong>; n=2 holds up to <strong>8</strong>. A full outer shell creates a chemically inert noble gas — He (n=1 full) and Ne (n=2 full).</p>
</div>`;

    EventBus.emit('edu:update', {
      title: 'Scale 3 — Atomic',
      body,
      hint: '🖱 Click anywhere on the scene to fire electrons. Add elements from the periodic table below.',
    });
    EventBus.emit('edu:event', { text: 'Nuclei from your nuclear forge are here — click the scene to bombard them with electrons!' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createOrbitalRing(radius: number, n: number, accentColor: number): OrbitalRing {
  const uniforms = {
    time:    { value: 0 },
    color:   { value: new THREE.Color(accentColor).lerp(new THREE.Color(0xffffff), 0.25) },
    opacity: { value: n === 1 ? 0.52 : n === 2 ? 0.34 : 0.2 },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms,
    vertexShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(uv.x * 18.0 + time * 2.0) * 0.03;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      void main() {
        float shimmer = 0.55 + 0.45 * sin(vUv.x * 30.0 + time * 5.0);
        gl_FragColor = vec4(color, opacity * shimmer);
      }`,
  });
  // Default torus lies in XY plane — appears as a circle from Z-axis camera ✓
  return { mesh: new THREE.Mesh(new THREE.TorusGeometry(radius, 0.04, 12, 90), material), uniforms, radius };
}

function makeLabelSprite(symbol: string, Z: number, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 44;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 96, 44);
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.textAlign = 'center';
  ctx.fillText(symbol, 48, 28);
  ctx.font = '13px monospace';
  ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
  ctx.fillText(`Z=${Z}`, 48, 41);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.3, 0.6, 1);
  return sprite;
}

function ptCell(Z: number): string {
  const { symbol, color } = ELEMENTS[Z];
  const hex = '#' + color.toString(16).padStart(6, '0');
  return `<div class="at-cell" data-z="${Z}" style="--cc:${hex}" title="${ELEMENTS[Z].name}">
    <span class="at-z">${Z}</span><span class="at-sym">${symbol}</span>
  </div>`;
}

function photonLabel(from: number, to: number): string {
  if (from === 2 && to === 1) return 'Lyman-α UV';
  if (from === 3 && to === 2) return 'Hα Balmer red';
  if (from === 3 && to === 1) return 'Lyman-β UV';
  return 'transition';
}

function createBackdrop(): THREE.Points {
  const count = 220;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 2] = -4 - Math.random() * 8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.7 }));
}
