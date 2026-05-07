import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

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
    this.setupActionBar();
    this.emitEducation();
  }

  dispose(): void {
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
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
      title: 'Scale 3 — Atomic (10⁻¹⁰ m)',
      body: `Atoms form when negatively charged electrons become bound to
positive nuclei. Quantum mechanics replaces tidy little planetary
orbits with probability clouds, but energy levels still come in
discrete shells.

Hydrogen’s single proton makes the simplest atom. Helium’s two-proton,
two-neutron nucleus pulls two electrons into a compact 1s shell.
Excited electrons fall back down and emit photons with specific
energies — the spectral fingerprints astronomers see in stars and nebulae.`,
      hint: 'Feed electrons into hydrogen and helium, then excite them to watch spectral photons fly out.',
    });
    EventBus.emit('edu:event', { text: 'Hydrogen and helium nuclei wait for electrons to neutralise them.' });
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
        this.checkCompletion();
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

  private checkCompletion(): void {
    const hydrogen = this.atoms.find((atom) => atom.key === 'H')!;
    const helium = this.atoms.find((atom) => atom.key === 'He')!;
    const hydrogenNeutral = hydrogen.electrons.some((electron) => electron.state !== 'spiral');
    const heliumNeutral = helium.electrons.filter((electron) => electron.state !== 'spiral').length >= 2;
    if (!this.completed && hydrogenNeutral && heliumNeutral) {
      this.completed = true;
      EventBus.emit('toast', { title: 'Atoms complete', body: 'Neutral hydrogen and helium now drift through space, ready for nebular life.' });
      EventBus.emit('edu:event', { text: 'Hydrogen and helium are fully neutral — the universe can now build a gas cloud.' });
      EventBus.emit('scale:complete', { scale: SCALE_INDEX });
    }
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
