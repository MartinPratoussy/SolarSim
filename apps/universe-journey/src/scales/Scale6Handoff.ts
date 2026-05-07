import * as THREE from 'three';
import { EventBus } from '../EventBus';
import type { IScale } from '../ScaleManager';

interface DiskParticle {
  radius: number;
  angle: number;
  speed: number;
  height: number;
  eccentricity: number;
}

export class Scale6Handoff implements IScale {
  readonly name = 'Scale 6 — Solar System Handoff';
  readonly scaleLabel = '10¹¹ m';

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  private renderer: THREE.WebGLRenderer | null = null;
  private star: THREE.Group | null = null;
  private diskGeometry = new THREE.BufferGeometry();
  private diskPoints = new THREE.Points();
  private diskParticles: DiskParticle[] = [];
  private clumps: THREE.Mesh[] = [];
  private elapsed = 0;
  private cardShown = false;
  private card: HTMLDivElement | null = null;

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0x5d6f88, 0.65));
    const light = new THREE.PointLight(0xfff4c2, 5, 90, 2);
    light.position.set(0, 2, 0);
    this.scene.add(light, createBackdrop());
    this.camera.position.set(0, 7, 18);
    this.camera.lookAt(0, 0, 0);
    this.elapsed = 0;
    this.cardShown = false;
    this.card?.remove();
    this.card = null;
    this.buildStar();
    this.buildDisk();
    this.buildClumps();
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.emitEducation();
  }

  dispose(): void {
    this.card?.remove();
    this.card = null;
    document.getElementById('action-bar')!.innerHTML = '';
    document.getElementById('progress-bar-container')!.style.display = 'none';
    this.scene.clear();
    this.renderer = null;
  }

  update(dt: number): void {
    if (!this.renderer) {
      return;
    }
    const step = Math.min(dt, 0.033);
    this.elapsed += step;
    this.star!.rotation.y += step * 0.28;
    this.updateDisk(step);
    this.updateClumps(step);
    if (!this.cardShown && this.elapsed > 5) {
      this.showCard();
    }
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'You built a universe!',
      body: `From a handful of quarks, you've built:
• 1 proton + 1 neutron (quarks → hadrons)
• Helium-4 nucleus (nuclear binding energy)
• Neutral hydrogen and helium atoms (Bohr orbitals)
• A nebula that collapsed under gravity (Jeans instability)
• A star igniting fusion (hydrostatic equilibrium)

Your star is on the main sequence — it will burn
hydrogen for billions of years before expanding
into a red giant, then shedding its outer layers
as a planetary nebula, leaving a white dwarf.

Or, if it's massive enough, it will end as a
supernova... and a neutron star or black hole.`,
      hint: 'Watch the debris disk settle. A new planetary system is about to begin.',
      equation: 'Scale bridge complete:\nquarks → hadrons → nuclei → atoms → nebula → star → planets',
    });
    EventBus.emit('edu:event', { text: 'A young star now glows at the center of a rotating debris disk.' });
    EventBus.emit('toast', { title: 'Journey complete', body: 'Your newborn star is ready to hand off to the SolarSim sandbox.' });
  }

  private buildStar(): void {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 36, 36),
      new THREE.MeshStandardMaterial({ color: 0xffe29a, emissive: 0xffb703, emissiveIntensity: 1.15 }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff5cf, transparent: true, opacity: 0.16 }),
    );
    group.add(glow, core);
    this.scene.add(group);
    this.star = group;
  }

  private buildDisk(): void {
    this.diskParticles = [];
    const array = new Float32Array(100 * 3);
    this.diskGeometry = new THREE.BufferGeometry();
    this.diskGeometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
    this.diskPoints = new THREE.Points(
      this.diskGeometry,
      new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.14, transparent: true, opacity: 0.9 }),
    );
    for (let i = 0; i < 100; i += 1) {
      this.diskParticles.push({
        radius: 3.4 + Math.random() * 6.8,
        angle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.45,
        height: (Math.random() - 0.5) * 0.5,
        eccentricity: 0.7 + Math.random() * 0.3,
      });
    }
    this.scene.add(this.diskPoints);
    this.updateDisk(0);
  }

  private buildClumps(): void {
    this.clumps = [];
    const material = new THREE.MeshStandardMaterial({ color: 0xb8b8c2, roughness: 0.9, metalness: 0.05 });
    for (let i = 0; i < 4; i += 1) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33 + i * 0.05, 0), material.clone());
      mesh.position.set(2.8 + i * 0.9, (i - 1.5) * 0.12, 1.6 - i * 0.7);
      this.clumps.push(mesh);
      this.scene.add(mesh);
    }
  }

  private updateDisk(dt: number): void {
    const attribute = this.diskGeometry.getAttribute('position') as THREE.BufferAttribute;
    this.diskParticles.forEach((particle, index) => {
      particle.angle += particle.speed * Math.max(dt, 0.005);
      const x = Math.cos(particle.angle) * particle.radius;
      const z = Math.sin(particle.angle) * particle.radius * particle.eccentricity;
      attribute.setXYZ(index, x, particle.height, z);
    });
    attribute.needsUpdate = true;
  }

  private updateClumps(dt: number): void {
    const aggregateTarget = new THREE.Vector3(4.8, 0, 0.2);
    this.clumps.forEach((clump, index) => {
      const wobble = new THREE.Vector3(Math.sin(this.elapsed * 0.8 + index) * 0.08, Math.cos(this.elapsed + index) * 0.02, Math.sin(this.elapsed * 0.6 + index) * 0.05);
      clump.position.lerp(aggregateTarget.clone().add(wobble), 0.015 * dt * 60);
      clump.rotation.x += dt * 0.7;
      clump.rotation.y += dt * 0.45;
    });
  }

  private showCard(): void {
    this.cardShown = true;
    const card = document.createElement('div');
    card.className = 'overlay-card final-card';
    card.innerHTML = `
      <h3>🌟 Your star is born!</h3>
      <p>
        Over millions of years, the debris disk will
        cool and accrete into planets.<br/><br/>
        Continue your journey in SolarSim →
      </p>
      <a href="../solar-system/index.html" target="_blank" rel="noopener noreferrer">→ Launch SolarSim</a>
    `;
    document.body.appendChild(card);
    this.card = card;
    EventBus.emit('edu:event', { text: 'The final handoff card appeared: your next stop is SolarSim.' });
  }
}

function createBackdrop(): THREE.Points {
  const count = 320;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 42;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 28;
    positions[i * 3 + 2] = -12 - Math.random() * 24;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.7 }));
}
