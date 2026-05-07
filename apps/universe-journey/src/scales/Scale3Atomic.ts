import * as THREE from 'three';
import { EventBus } from '../EventBus';
import { mathHtml } from '../EduPanel';
import type { IScale } from '../ScaleManager';

interface AtomInfo {
  name: string;
  symbol: string;
  protons: number;
  electrons: number;
  shell: string;
  mass: string;
  accentColor: number;
  fact: string;
}

const ATOM_DATA: Record<'H' | 'He', AtomInfo> = {
  H: {
    name: 'Hydrogen', symbol: 'H', protons: 1, electrons: 1,
    shell: '1s¹', mass: '1.008 u', accentColor: 0x90cdf4,
    fact: 'The simplest and most abundant atom in the universe — 75% of all baryonic matter. Its one electron fills the lowest energy shell (1s¹). Hydrogen\'s discrete spectrum was the first quantum fingerprint decoded, directly leading Bohr to his atomic model in 1913. In nebulae, the 1→2 Lyman-α transition at 121.6 nm is the brightest UV line in the cosmos.',
  },
  He: {
    name: 'Helium', symbol: 'He', protons: 2, electrons: 2,
    shell: '1s²', mass: '4.003 u', accentColor: 0xffd75e,
    fact: 'The noble gas. Its two electrons completely fill the 1s shell (1s²) — a closed shell that makes helium chemically inert. Helium will never form a molecule. It was discovered in the Sun\'s spectrum 27 years before it was found on Earth, hence its name from Helios, the Greek sun god. It\'s the second most abundant element in the universe.',
  },
};

interface OrbitalRing {
  mesh: THREE.Mesh;
  uniforms: {
    time: { value: number };
    color: { value: THREE.Color };
    opacity: { value: number };
  };
  radius: number;
  n: number;
}

interface Atom {
  key: 'H' | 'He';
  position: THREE.Vector3;
  nucleus: THREE.Group;
  electrons: Electron[];
  orbitals: OrbitalRing[];
  capacity: number;
}

interface Electron {
  atom: Atom;
  mesh: THREE.Mesh;
  orbitalN: number;
  state: 'spiral' | 'orbital' | 'excited';
  angle: number;
  timer: number;
  startRadius: number;
}

interface Photon {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

const SCALE_INDEX = 2;

export class Scale3Atomic implements IScale {
  readonly name = 'Scale 3 — Atomic';
  readonly scaleLabel = '10⁻¹⁰ m';

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-14, 14, 8, -8, 0.1, 60);
  private renderer: THREE.WebGLRenderer | null = null;
  private atoms: Atom[] = [];
  private photons: Photon[] = [];
  private completed = false;
  private discoveredAtoms = new Set<'H' | 'He'>();

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x7c96b5, 0.95));
    const light = new THREE.PointLight(0xc5ecff, 10, 55, 2);
    light.position.set(0, 0, 15);
    this.scene.add(light, createBackdropPoints());
    this.atoms = [this.createAtom('H', new THREE.Vector3(-4.5, 0, 0)), this.createAtom('He', new THREE.Vector3(4.5, 0, 0))];
    this.photons = [];
    this.completed = false;
    this.discoveredAtoms.clear();
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    document.getElementById('discovery-close')!.onclick = null;
    document.getElementById('discovery-modal')!.classList.remove('visible');
    document.getElementById('discovery-modal')!.setAttribute('aria-hidden', 'true');
    this.scene.clear();
    this.atoms = [];
    this.photons = [];
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.033);
    this.atoms.forEach((atom) => {
      atom.orbitals.forEach((orbital, index) => {
        orbital.uniforms.time.value += step * (1 + index * 0.2);
      });
      atom.electrons.forEach((electron) => this.updateElectron(electron, step));
      atom.nucleus.rotation.y += step * 0.5;
    });
    this.photons = this.photons.filter((photon) => {
      photon.life -= step;
      photon.mesh.position.addScaledVector(photon.velocity, step);
      (photon.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(photon.life / 1.6, 0);
      if (photon.life <= 0) {
        this.scene.remove(photon.mesh);
        return false;
      }
      return true;
    });
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    const aspect = Math.max(width / height, 1);
    this.camera.left = -9 * aspect;
    this.camera.right = 9 * aspect;
    this.camera.top = 8;
    this.camera.bottom = -8;
    this.camera.position.set(0, 0, 18);
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 3 — Atomic · 10⁻¹⁰ m',
      body: `
<div class="edu-section">
  <p>You have zoomed out to the scale of the <span class="edu-highlight">atom</span> — ångströms (Å, 10⁻¹⁰ m). The nucleus is now a tiny speck at the centre; electrons form quantum clouds around it. Atoms are 99.99999% empty space — hydrogen is about 100,000× wider than its nucleus.</p>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Bohr Energy Levels</div>
  <p>Electrons can only occupy <span class="edu-highlight">discrete energy shells</span>. The energy of shell <em>n</em> in hydrogen is:</p>
  <div class="edu-equation-inline">${mathHtml('E_n = -\\dfrac{13.6\\,\\text{eV}}{n^2}', false)}</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name">n=1 · ground state</div>
      <div class="edu-card-sub">E = −13.6 eV — most stable. Electron sits as close to nucleus as quantum mechanics allows</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">n=2 · first excited</div>
      <div class="edu-card-sub">E = −3.4 eV — temporary. Electron jumps here when it absorbs energy, then falls back</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name">n=∞ · ionisation</div>
      <div class="edu-card-sub">E = 0 — electron escapes the atom. Requires 13.6 eV to ionise H from ground state</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Spectral Lines — Photon Emission</div>
  <p>When an excited electron falls from shell <em>n₂</em> to <em>n₁</em>, the energy difference is released as a photon. The <span class="edu-highlight">Rydberg formula</span> gives its wavelength:</p>
  <div class="edu-equation-inline">${mathHtml('\\dfrac{1}{\\lambda} = R_H\\!\\left(\\dfrac{1}{n_1^2}-\\dfrac{1}{n_2^2}\\right)', false)}</div>
  <div class="edu-card-grid">
    <div class="edu-card">
      <div class="edu-card-name" style="color:#ff8a65">2→1 · Lyman-α</div>
      <div class="edu-card-sub">121.6 nm — ultraviolet. Seen in absorption in distant quasar spectra; reveals hydrogen clouds</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name" style="color:#5eead4">3→2 · Hα Balmer</div>
      <div class="edu-card-sub">656 nm — visible red. The line that colours nebulae pink-red in telescope images</div>
    </div>
    <div class="edu-card">
      <div class="edu-card-name" style="color:#c4b5fd">3→1 · Lyman-β</div>
      <div class="edu-card-sub">102.6 nm — deep ultraviolet</div>
    </div>
  </div>
</div>

<hr/>

<div class="edu-section">
  <div class="edu-section-title">Electron Shells &amp; Noble Gases</div>
  <p>The first shell (n=1) holds exactly 2 electrons. Helium fills it completely — this <span class="edu-highlight">closed shell</span> makes helium chemically inert. It will never form a molecule. This pattern repeats across the periodic table: atoms with full shells are the noble gases.</p>
</div>`,
      hint: '⛛️ Add electrons to both atoms. Once neutral, hit ✨ Excite — watch coloured photons fly out as electrons decay back to ground state.',
    });
    EventBus.emit('edu:event', { text: 'H needs 1 electron · He needs 2 electrons. Add them to neutralise both atoms.' });
  }

  private setupActionBar(): void {
    const actionBar = document.getElementById('action-bar')!;
    actionBar.innerHTML = '';
    actionBar.appendChild(this.makeButton('+ Electron → H', () => this.spawnElectron('H')));
    actionBar.appendChild(this.makeButton('+ Electron → He', () => this.spawnElectron('He')));
    actionBar.appendChild(this.makeButton('Excite electrons', () => this.exciteElectrons()));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private createAtom(key: 'H' | 'He', position: THREE.Vector3): Atom {
    const nucleus = new THREE.Group();
    const nucleusCore = new THREE.Mesh(
      new THREE.SphereGeometry(key === 'H' ? 0.4 : 0.6, 24, 24),
      new THREE.MeshStandardMaterial({
        color: key === 'H' ? 0x90cdf4 : 0xfff5c2,
        emissive: key === 'H' ? 0x63b3ff : 0xffd75e,
        emissiveIntensity: 0.8,
      }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(key === 'H' ? 0.7 : 0.95, 24, 24),
      new THREE.MeshBasicMaterial({ color: key === 'H' ? 0x63b3ff : 0xffe680, transparent: true, opacity: 0.18 }),
    );
    nucleus.add(glow, nucleusCore);
    nucleus.position.copy(position);
    this.scene.add(nucleus);
    const orbitalRadii = [0.7, 2.2, 4.9];
    const orbitals = orbitalRadii.map((radius, index) => createOrbitalRing(radius, index + 1));
    orbitals.forEach((orbital) => {
      orbital.mesh.position.copy(position);
      orbital.mesh.rotation.x = Math.PI / 2;
      this.scene.add(orbital.mesh);
    });
    return { key, position, nucleus, electrons: [], orbitals, capacity: key === 'H' ? 1 : 2 };
  }

  private spawnElectron(targetKey: 'H' | 'He'): void {
    const atom = this.atoms.find((entry) => entry.key === targetKey)!;
    if (atom.electrons.length >= atom.capacity || atom.electrons.length >= 10) {
      EventBus.emit('edu:event', { text: `${targetKey} is already neutral.` });
      return;
    }
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0x9ae6ff }),
    );
    this.scene.add(mesh);
    const electron: Electron = {
      atom,
      mesh,
      orbitalN: 1,
      state: 'spiral',
      angle: Math.random() * Math.PI * 2,
      timer: 0,
      startRadius: 6 + Math.random() * 2,
    };
    atom.electrons.push(electron);
    EventBus.emit('edu:event', { text: `An electron was released toward ${targetKey}.` });
  }

  private updateElectron(electron: Electron, dt: number): void {
    const atom = electron.atom;
    if (electron.state === 'spiral') {
      electron.timer = Math.min(electron.timer + dt * 0.7, 1);
      electron.angle += dt * 5.5;
      const targetRadius = atom.orbitals[electron.orbitalN - 1].radius;
      const radius = THREE.MathUtils.lerp(electron.startRadius, targetRadius, electron.timer);
      const wobble = Math.sin(electron.angle * 3) * 0.16;
      electron.mesh.position.set(
        atom.position.x + Math.cos(electron.angle) * radius,
        atom.position.y + Math.sin(electron.angle) * radius * 0.65,
        wobble,
      );
      if (electron.timer >= 1) {
        electron.state = 'orbital';
        EventBus.emit('edu:event', { text: `${atom.key} captured an electron into the ${electron.orbitalN}s shell.` });
        this.checkAtomComplete(atom);
      }
      return;
    }

    const radius = atom.orbitals[electron.orbitalN - 1].radius;
    const speed = electron.state === 'excited' ? 2 : 3.2;
    electron.angle += dt * speed;
    electron.mesh.position.set(
      atom.position.x + Math.cos(electron.angle) * radius,
      atom.position.y + Math.sin(electron.angle) * radius,
      Math.sin(electron.angle * 2 + radius) * 0.08,
    );

    if (electron.state === 'excited') {
      electron.timer -= dt;
      if (electron.timer <= 0) {
        const from = electron.orbitalN;
        electron.orbitalN = Math.max(1, electron.orbitalN - 1);
        electron.state = 'orbital';
        this.emitPhoton(atom.position.clone(), from, electron.orbitalN);
      }
    }
  }

  private exciteElectrons(): void {
    let excitedAny = false;
    this.atoms.forEach((atom) => {
      atom.electrons.forEach((electron, index) => {
        if (electron.state === 'orbital' && electron.orbitalN < 3) {
          electron.state = 'excited';
          electron.orbitalN += 1;
          electron.timer = 0.8 + index * 0.25 + Math.random() * 0.6;
          excitedAny = true;
        }
      });
    });
    if (excitedAny) {
      EventBus.emit('edu:event', { text: 'Electrons jumped to higher orbitals and will soon radiate photons.' });
      EventBus.emit('toast', { title: 'Excited state', body: 'Watch for Balmer-style and Lyman-style photons as the electrons decay.' });
    }
  }

  private emitPhoton(origin: THREE.Vector3, from: number, to: number): void {
    const color = from === 2 && to === 1 ? 0xff8a65 : from === 3 && to === 2 ? 0x5eead4 : 0xc4b5fd;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(5);
    this.photons.push({ mesh, velocity: direction, life: 1.6 });
    EventBus.emit('edu:event', { text: `Photon emitted from n=${from} → n=${to}.` });
  }

  private checkAtomComplete(atom: Atom): void {
    const settled = atom.electrons.filter((e) => e.state !== 'spiral').length;
    if (settled < atom.capacity || this.discoveredAtoms.has(atom.key)) return;
    this.discoveredAtoms.add(atom.key);
    this.showAtomDiscovery(atom.key);
    const info = ATOM_DATA[atom.key];
    EventBus.emit('edu:event', { text: `${info.name} is now neutral — a complete atom!` });
    EventBus.emit('toast', {
      title: `${info.name} formed`,
      body: `${atom.key === 'H' ? '1 electron in 1s¹' : '2 electrons in 1s²'} · ${info.mass}`,
    });
    if (this.discoveredAtoms.size === 2 && !this.completed) {
      this.completed = true;
      EventBus.emit('edu:event', { text: 'Both atoms neutral — the universe can now build a gas cloud.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
  }

  private showAtomDiscovery(key: 'H' | 'He'): void {
    const info    = ATOM_DATA[key];
    const modal   = document.getElementById('discovery-modal')!;
    const card    = document.getElementById('discovery-card')!;
    const badge   = document.getElementById('discovery-badge')!;
    const symEl   = document.getElementById('discovery-symbol')!;

    badge.textContent = 'ATOM NEUTRALISED';
    badge.className = '';

    const r = (info.accentColor >> 16) & 0xff;
    const g = (info.accentColor >> 8) & 0xff;
    const b = info.accentColor & 0xff;
    card.style.boxShadow = `0 0 60px rgba(${r},${g},${b},0.35), 0 0 0 1px rgba(${r},${g},${b},0.2)`;
    card.style.borderColor = `rgba(${r},${g},${b},0.3)`;

    symEl.textContent = info.symbol;
    symEl.style.color = `rgb(${r},${g},${b})`;
    document.getElementById('discovery-name')!.textContent = info.name;
    document.getElementById('discovery-quarks')!.textContent = `${info.protons}p · ${info.electrons}e⁻ · ${info.shell}`;
    document.getElementById('discovery-charge')!.textContent = 'Charge: neutral (0)';
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

function createOrbitalRing(radius: number, n: number): OrbitalRing {
  const uniforms = {
    time: { value: 0 },
    color: { value: new THREE.Color(n === 1 ? 0x63b3ff : n === 2 ? 0x7dd3fc : 0xc4b5fd) },
    opacity: { value: n === 1 ? 0.52 : n === 2 ? 0.34 : 0.22 },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        transformed.z += sin(uv.x * 18.0 + time * 2.0) * 0.03;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      void main() {
        float shimmer = 0.55 + 0.45 * sin(vUv.x * 30.0 + time * 5.0);
        gl_FragColor = vec4(color, opacity * shimmer);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 16, 90), material);
  return { mesh, uniforms, radius, n };
}

function createBackdropPoints(): THREE.Points {
  const count = 220;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 2] = -4 - Math.random() * 8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.7 }));
}
