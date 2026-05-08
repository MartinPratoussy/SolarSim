import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { IScale } from '../ScaleManager';
import { EventBus } from '../EventBus';
import { Body, keplerVelocity, metersToScene, type BodyType } from '../solar/Body';
import { SolarSystem, escapeVelocity } from '../solar/SolarSystem';
import { EventBus as SolarEventBus } from '../solar/solarEvents';
import { AU, BASE_TIMESTEP, DAY } from '../solar/constants';
import { SOLAR_DATA, initialPosition } from '../solar/solarData';
import { updateInfoPanel, showTooltip, hideTooltip } from '../solar/ui';
import {
  addAtmosphere,
  addSaturnRing,
  applyPlanetTexture,
  applyStarVisuals,
  buildBlackHoleVisuals,
  createGravityGrid,
  createStarfield,
  createSunGlow,
  LensDistortionShader,
  spawnGravWaveRing,
  spaghettify,
} from '../solar/visuals';

interface FlyState {
  targetEnd: THREE.Vector3;
  camEnd: THREE.Vector3;
  targetStart: THREE.Vector3;
  camStart: THREE.Vector3;
  t: number;
  followOnLand: boolean;
}

interface ImpactFlash {
  light: THREE.PointLight;
  age: number;
  duration: number;
}

const MAX_DEBRIS = 150;
const MAX_SUBSTEP_DT = DAY * 2;
const MAX_SUBSTEPS = 60;

const BODY_PRESETS: Record<BodyType, { mass: number; realRadius: number; drawRadius: number; color: number }> = {
  planet: { mass: 6e24, realRadius: 6.4e6, drawRadius: 1.0, color: 0x4fa3e0 },
  moon: { mass: 7.3e22, realRadius: 1.74e6, drawRadius: 0.4, color: 0xbbbbbb },
  star: { mass: 2e30, realRadius: 7e8, drawRadius: 5.0, color: 0xfff5c0 },
  asteroid: { mass: 1e15, realRadius: 5e4, drawRadius: 0.2, color: 0x888888 },
  comet: { mass: 1e13, realRadius: 2e3, drawRadius: 0.2, color: 0xaaddff },
  blackhole: { mass: 1e31, realRadius: 3e9, drawRadius: 2.0, color: 0x000000 },
  debris: { mass: 5e20, realRadius: 5e4, drawRadius: 0.12, color: 0xff6622 },
};

export class Scale6SolarSystem implements IScale {
  readonly name = 'Scale 6 — Solar System';
  readonly scaleLabel = '10¹¹ m';

  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private overlayScene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100000);
  private controls: OrbitControls | null = null;
  private composer: EffectComposer | null = null;
  private lensPass: ShaderPass | null = null;
  private gravityGrid: ReturnType<typeof createGravityGrid> | null = null;
  private solar: SolarSystem | null = null;
  private sun: Body | null = null;
  private sunLight: THREE.PointLight | null = null;
  private speedMultiplier = 1;
  private selectedBody: Body | null = null;
  private placingType: BodyType | 'none' = 'none';
  private followMode = false;
  private artisticScale = true;
  private simulatedDays = 0;
  private flyState: FlyState | null = null;
  private followedBodyLastPos = new THREE.Vector3();
  private impactFlashes: ImpactFlash[] = [];
  private mouseDownX = 0;
  private mouseDownY = 0;
  private bodyCounter = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();
  private cleanupCallbacks: Array<() => void> = [];

  init(_container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.dispose();
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.overlayScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100000);
    this.camera.position.set(0, 250, 500);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 8000;
    const handleControlsStart = () => {
      this.flyState = null;
    };
    this.controls.addEventListener('start', handleControlsStart);
    this.cleanupCallbacks.push(() => {
      this.controls?.removeEventListener('start', handleControlsStart);
    });

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.lensPass = new ShaderPass(LensDistortionShader);
    this.lensPass.enabled = false;
    this.composer.addPass(this.lensPass);

    this.sunLight = new THREE.PointLight(0xfff5c0, 3, 0, 0);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x334466, 0.6));
    createStarfield(this.scene);

    this.gravityGrid = createGravityGrid(this.scene);
    this.scene.remove(this.gravityGrid.mesh);
    this.overlayScene.add(this.gravityGrid.mesh);

    this.solar = new SolarSystem(this.scene);
    this.sun = new Body({
      name: 'Sun',
      type: 'star',
      mass: SOLAR_DATA.sun.mass,
      realRadius: SOLAR_DATA.sun.realRadius,
      drawRadius: SOLAR_DATA.sun.drawRadius,
      color: SOLAR_DATA.sun.color,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
    }, this.scene);
    applyPlanetTexture(this.sun, SOLAR_DATA.sun.texture);
    const sunMaterial = this.sun.mesh.material as THREE.MeshStandardMaterial;
    sunMaterial.emissive = new THREE.Color(0xfff5c0);
    sunMaterial.emissiveIntensity = 0.6;
    this.solar.add(this.sun);

    const sunGlow = createSunGlow(this.scene, new THREE.Vector3(0, 0, 0), this.sun.drawRadius);
    this.scene.remove(sunGlow);
    this.sun.mesh.add(sunGlow);
    sunGlow.position.set(0, 0, 0);

    for (const planetData of SOLAR_DATA.planets) {
      const position = initialPosition(planetData);
      const velocity = keplerVelocity(position, SOLAR_DATA.sun.mass, planetData.inclination);
      const planet = new Body({
        name: planetData.name,
        type: 'planet',
        mass: planetData.mass,
        realRadius: planetData.realRadius,
        drawRadius: planetData.drawRadius,
        color: planetData.color,
        position,
        velocity,
      }, this.scene);
      applyPlanetTexture(planet, planetData.texture);
      planet.mesh.rotation.z = planetData.axialTilt;
      if (planetData.atmosphere) {
        addAtmosphere(planet, planetData.atmosphere);
      }
      if (planetData.hasRing) {
        addSaturnRing(planet);
      }
      this.solar.add(planet);
    }

    const totalMomentum = new THREE.Vector3();
    let totalMass = 0;
    for (const body of this.solar.bodies) {
      totalMomentum.addScaledVector(body.velocity, body.mass);
      totalMass += body.mass;
    }
    const centerVelocity = totalMomentum.divideScalar(totalMass);
    for (const body of this.solar.bodies) {
      body.velocity.sub(centerVelocity);
      body.syncMesh();
    }

    this.solar.onImpact = (target, impactor, relVel) => {
      this.spawnImpactDebris(target, impactor, relVel);
    };

    this.speedMultiplier = 1;
    this.selectedBody = null;
    this.placingType = 'none';
    this.followMode = false;
    this.artisticScale = true;
    this.simulatedDays = 0;
    this.flyState = null;
    this.impactFlashes = [];

    this.setSolarUiVisible(true);
    this.bindUI();
    updateInfoPanel(null, 0);
    const actionBar = document.getElementById('action-bar');
    const progress = document.getElementById('progress-bar-container');
    if (actionBar) {
      actionBar.innerHTML = '';
    }
    if (progress) {
      progress.style.display = 'none';
    }
    this.emitEducation();
  }

  update(dt: number): void {
    if (!this.renderer || !this.controls || !this.composer || !this.solar || !this.sun || !this.sunLight || !this.gravityGrid || !this.lensPass) {
      return;
    }

    const delta = Math.min(dt, 0.05);
    const totalDt = BASE_TIMESTEP * this.speedMultiplier * delta;
    if (this.speedMultiplier > 0) {
      const steps = Math.min(Math.ceil(totalDt / MAX_SUBSTEP_DT), MAX_SUBSTEPS);
      const subDt = totalDt / steps;
      for (let i = 0; i < steps; i += 1) {
        this.solar.update(subDt);
      }
      this.simulatedDays += totalDt / DAY;
    }

    for (const body of this.solar.bodies) {
      if (body.type === 'planet' || body.type === 'star') {
        body.mesh.rotation.y += 0.002;
      }
    }

    const blackholes = this.solar.bodies.filter((body) => body.type === 'blackhole');
    if (blackholes.length > 0) {
      const toRemove: Body[] = [];
      for (const body of this.solar.bodies) {
        if (body.type === 'blackhole' || body.type === 'star') {
          continue;
        }
        for (const blackhole of blackholes) {
          if (spaghettify(body, blackhole)) {
            toRemove.push(body);
            break;
          }
        }
      }
      for (const body of toRemove) {
        this.solar.remove(body);
      }

      for (let i = 0; i < blackholes.length; i += 1) {
        for (let j = i + 1; j < blackholes.length; j += 1) {
          const first = blackholes[i];
          const second = blackholes[j];
          if (first.mesh.position.distanceTo(second.mesh.position) < first.drawRadius + second.drawRadius) {
            const totalMass = first.mass + second.mass;
            first.velocity.multiplyScalar(first.mass / totalMass).addScaledVector(second.velocity, second.mass / totalMass);
            first.mass = totalMass;
            first.drawRadius = Math.pow(Math.pow(first.drawRadius, 3) + Math.pow(second.drawRadius, 3), 1 / 3);
            spawnGravWaveRing(this.scene, first.mesh.position.clone());
            this.solar.remove(second);
          }
        }
      }
    }

    this.sunLight.position.copy(this.sun.mesh.position);

    for (let i = this.impactFlashes.length - 1; i >= 0; i -= 1) {
      const flash = this.impactFlashes[i];
      flash.age += delta;
      flash.light.intensity = Math.max(0, 12 * (1 - flash.age / flash.duration));
      if (flash.age >= flash.duration) {
        this.scene.remove(flash.light);
        this.impactFlashes.splice(i, 1);
      }
    }

    if (this.flyState) {
      if (this.selectedBody) {
        const zoom = Math.max(this.selectedBody.drawRadius * 12, 18);
        const direction = this.flyState.camEnd.clone().sub(this.flyState.targetEnd).normalize();
        this.flyState.targetEnd.copy(this.selectedBody.mesh.position);
        this.flyState.camEnd.copy(this.selectedBody.mesh.position).addScaledVector(direction, zoom);
      }
      this.flyState.t = Math.min(this.flyState.t + delta * 1.8, 1);
      const k = this.flyState.t < 0.5
        ? 2 * this.flyState.t * this.flyState.t
        : 1 - Math.pow(-2 * this.flyState.t + 2, 2) / 2;
      this.controls.target.lerpVectors(this.flyState.targetStart, this.flyState.targetEnd, k);
      this.camera.position.lerpVectors(this.flyState.camStart, this.flyState.camEnd, k);
      if (this.flyState.t >= 1) {
        if (this.flyState.followOnLand && this.selectedBody) {
          this.followMode = true;
          this.followedBodyLastPos.copy(this.selectedBody.mesh.position);
        }
        this.flyState = null;
      }
    } else if (this.followMode && this.selectedBody) {
      const deltaPosition = this.selectedBody.mesh.position.clone().sub(this.followedBodyLastPos);
      this.controls.target.add(deltaPosition);
      this.camera.position.add(deltaPosition);
      this.followedBodyLastPos.copy(this.selectedBody.mesh.position);
    }

    if (this.selectedBody) {
      updateInfoPanel(this.selectedBody, this.solar.findStar()?.mass ?? 0);
    }

    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
      const dayCount = Math.floor(this.simulatedDays);
      timeDisplay.textContent = dayCount < 730 ? `Day ${dayCount.toLocaleString()}` : `Year ${(dayCount / 365.25).toFixed(1)}`;
    }

    if (this.gravityGrid.mesh.visible) {
      this.gravityGrid.update(this.solar.bodies);
    }

    this.lensPass.enabled = blackholes.length > 0;
    if (this.lensPass.enabled) {
      const uvs = this.lensPass.uniforms['bhUV'].value as THREE.Vector2[];
      const strengths = this.lensPass.uniforms['bhStrength'].value as number[];
      for (let i = 0; i < 4; i += 1) {
        if (i < blackholes.length) {
          const projected = blackholes[i].mesh.position.clone().project(this.camera);
          uvs[i].set((projected.x + 1) / 2, (projected.y + 1) / 2);
          strengths[i] = blackholes[i].drawRadius * blackholes[i].drawRadius * 0.00025;
        } else {
          strengths[i] = 0;
        }
      }
      this.lensPass.uniforms['bhCount'].value = Math.min(blackholes.length, 4);
    }

    this.controls.update();
    this.composer.render();
    if (this.gravityGrid.mesh.visible) {
      this.renderer.autoClear = false;
      this.renderer.render(this.overlayScene, this.camera);
      this.renderer.autoClear = true;
    }
  }

  dispose(): void {
    this.cleanupCallbacks.forEach((cleanup) => cleanup());
    this.cleanupCallbacks = [];

    this.controls?.dispose();
    this.controls = null;

    this.setSolarUiVisible(false);
    hideTooltip();
    updateInfoPanel(null, 0);
    const popup = document.getElementById('event-popup');
    if (popup) {
      popup.style.display = 'none';
    }

    if (this.solar) {
      for (const body of [...this.solar.bodies]) {
        body.remove(this.scene);
      }
      this.solar.bodies = [];
    }

    for (const flash of this.impactFlashes) {
      this.scene.remove(flash.light);
    }
    this.impactFlashes = [];

    this.disposeScene(this.scene);
    this.disposeScene(this.overlayScene);
    this.scene = new THREE.Scene();
    this.overlayScene = new THREE.Scene();

    this.renderer?.setClearColor(0x000000, 1);
    if (this.renderer) {
      this.renderer.autoClear = true;
    }

    this.composer?.dispose();
    this.composer = null;
    this.lensPass = null;
    this.gravityGrid = null;
    this.solar = null;
    this.sun = null;
    this.sunLight = null;
    this.selectedBody = null;
    this.followMode = false;
    this.flyState = null;
    this.renderer = null;
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height);
    this.composer?.setSize(width, height);
  }

  private bindUI(): void {
    const toolbarButtons = document.querySelectorAll<HTMLButtonElement>('#toolbar button');
    toolbarButtons.forEach((button) => {
      const handler = () => {
        this.placingType = (button.dataset.type as BodyType | 'none') ?? 'none';
        toolbarButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
      };
      button.addEventListener('click', handler);
      this.cleanupCallbacks.push(() => button.removeEventListener('click', handler));
    });

    const timeButtons = document.querySelectorAll<HTMLButtonElement>('#time-controls button');
    timeButtons.forEach((button) => {
      const handler = () => {
        this.speedMultiplier = Number(button.dataset.speed ?? '1');
        timeButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
      };
      button.addEventListener('click', handler);
      this.cleanupCallbacks.push(() => button.removeEventListener('click', handler));
    });

    const scaleToggle = document.getElementById('scale-toggle');
    if (scaleToggle) {
      const handler = () => {
        this.artisticScale = !this.artisticScale;
        scaleToggle.textContent = this.artisticScale ? '🔭 Artistic Scale' : '🔭 True Scale';
        if (!this.solar) {
          return;
        }
        for (const body of this.solar.bodies) {
          if (body.type === 'star' || body.type === 'blackhole') {
            continue;
          }
          const newRadius = this.artisticScale ? body.drawRadius : Math.max(0.05, metersToScene(body.realRadius) * 300);
          body.mesh.geometry.dispose();
          body.mesh.geometry = new THREE.SphereGeometry(newRadius, 24, 24);
        }
      };
      scaleToggle.textContent = '🔭 Artistic Scale';
      scaleToggle.addEventListener('click', handler);
      this.cleanupCallbacks.push(() => scaleToggle.removeEventListener('click', handler));
    }

    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle && this.gravityGrid) {
      gridToggle.classList.remove('active');
      const handler = () => {
        if (!this.gravityGrid) {
          return;
        }
        this.gravityGrid.mesh.visible = !this.gravityGrid.mesh.visible;
        gridToggle.classList.toggle('active', this.gravityGrid.mesh.visible);
      };
      gridToggle.addEventListener('click', handler);
      this.cleanupCallbacks.push(() => gridToggle.removeEventListener('click', handler));
    }

    if (!this.renderer) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      this.mouseDownX = event.clientX;
      this.mouseDownY = event.clientY;
    };
    const handleClick = (event: MouseEvent) => {
      if (Math.hypot(event.clientX - this.mouseDownX, event.clientY - this.mouseDownY) > 5) {
        return;
      }
      if (this.placingType !== 'none') {
        this.placeBody(event.clientX, event.clientY);
        return;
      }
      const body = this.nearestBodyToScreen(event.clientX, event.clientY, 48);
      if (body) {
        this.selectedBody = body;
        this.followMode = false;
        this.followedBodyLastPos.copy(body.mesh.position);
        updateInfoPanel(body, this.solar?.findStar()?.mass ?? 0);
        SolarEventBus.emit('select:body', { body });
      } else {
        this.selectedBody = null;
        this.followMode = false;
        updateInfoPanel(null, 0);
        SolarEventBus.emit('select:none', {});
      }
    };
    const handleDoubleClick = (event: MouseEvent) => {
      const body = this.nearestBodyToScreen(event.clientX, event.clientY, 60);
      if (!body || !this.controls) {
        return;
      }
      this.followMode = false;
      this.selectedBody = body;
      updateInfoPanel(body, this.solar?.findStar()?.mass ?? 0);
      const zoom = Math.max(body.drawRadius * 12, 18);
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();
      this.flyState = {
        targetStart: this.controls.target.clone(),
        camStart: this.camera.position.clone(),
        targetEnd: body.mesh.position.clone(),
        camEnd: body.mesh.position.clone().addScaledVector(direction, zoom),
        followOnLand: true,
        t: 0,
      };
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!this.solar) {
        return;
      }
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.solar.bodies.map((body) => body.mesh));
      if (hits.length === 0) {
        return;
      }
      const body = hits[0].object.userData.body as Body;
      if (body.type === 'star') {
        return;
      }
      if (this.selectedBody === body) {
        this.selectedBody = null;
        updateInfoPanel(null, 0);
      }
      this.solar.remove(body);
    };
    const handleMouseMove = (event: MouseEvent) => {
      const body = this.nearestBodyToScreen(event.clientX, event.clientY, 48);
      if (body) {
        showTooltip(body, event.clientX, event.clientY);
      } else {
        hideTooltip();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') {
        this.followMode = this.selectedBody !== null && !this.followMode;
        if (this.followMode && this.selectedBody) {
          this.followedBodyLastPos.copy(this.selectedBody.mesh.position);
        }
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedBody && this.selectedBody.type !== 'star' && this.solar) {
        this.solar.remove(this.selectedBody);
        this.selectedBody = null;
        updateInfoPanel(null, 0);
      }
    };

    this.renderer.domElement.addEventListener('mousedown', handleMouseDown);
    this.renderer.domElement.addEventListener('click', handleClick);
    this.renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    this.renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    this.renderer.domElement.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    this.cleanupCallbacks.push(() => this.renderer?.domElement.removeEventListener('mousedown', handleMouseDown));
    this.cleanupCallbacks.push(() => this.renderer?.domElement.removeEventListener('click', handleClick));
    this.cleanupCallbacks.push(() => this.renderer?.domElement.removeEventListener('dblclick', handleDoubleClick));
    this.cleanupCallbacks.push(() => this.renderer?.domElement.removeEventListener('contextmenu', handleContextMenu));
    this.cleanupCallbacks.push(() => this.renderer?.domElement.removeEventListener('mousemove', handleMouseMove));
    this.cleanupCallbacks.push(() => window.removeEventListener('keydown', handleKeyDown));
  }

  private emitEducation(): void {
    EventBus.emit('edu:update', {
      title: 'Scale 6 — Solar System (10¹¹ m)',
      body: 'You made it! From quarks to a star with orbiting planets. This is Newtonian N-body gravity — every body attracts every other body via F = Gm₁m₂/r². Add stars, black holes, watch chaos unfold.',
      hint: '👆 Use the toolbar to add bodies. Double-click to focus camera on a body.',
    });
    EventBus.emit('edu:event', { text: 'Scale 6 is live: the full SolarSim sandbox now runs inside the journey.' });
  }

  private setSolarUiVisible(visible: boolean): void {
    const toolbar = document.getElementById('toolbar');
    const timeControls = document.getElementById('time-controls');
    const scaleToggle = document.getElementById('scale-toggle');
    const gridToggle = document.getElementById('grid-toggle');
    const infoPanel = document.getElementById('info-panel');
    const tooltip = document.getElementById('tooltip');
    const popup = document.getElementById('event-popup');

    if (toolbar) {
      toolbar.style.display = visible ? 'flex' : 'none';
      toolbar.querySelectorAll('button').forEach((button, index) => {
        button.classList.toggle('active', index === 0);
      });
    }
    if (timeControls) {
      timeControls.style.display = visible ? 'flex' : 'none';
      timeControls.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.speed === '1');
      });
    }
    if (scaleToggle) {
      scaleToggle.style.display = visible ? 'block' : 'none';
      scaleToggle.textContent = '🔭 Artistic Scale';
    }
    if (gridToggle) {
      gridToggle.style.display = visible ? 'block' : 'none';
      gridToggle.classList.remove('active');
    }
    if (infoPanel) {
      infoPanel.style.display = 'none';
    }
    if (tooltip) {
      tooltip.style.display = 'none';
    }
    if (popup) {
      popup.style.display = 'none';
    }
  }

  private nearestBodyToScreen(clientX: number, clientY: number, threshold: number): Body | null {
    if (!this.solar) {
      return null;
    }
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    let nearest: Body | null = null;
    let nearestDistance = threshold;
    for (const body of this.solar.bodies) {
      const screen = body.mesh.position.clone().project(this.camera);
      if (screen.z > 1) {
        continue;
      }
      const distance = Math.hypot((screen.x + 1) * halfWidth - clientX, (1 - screen.y) * halfHeight - clientY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = body;
      }
    }
    return nearest;
  }

  private placeBody(screenX: number, screenY: number): void {
    if (!this.solar) {
      return;
    }
    const vector = new THREE.Vector3((screenX / window.innerWidth) * 2 - 1, -(screenY / window.innerHeight) * 2 + 1, 0.5);
    vector.unproject(this.camera);
    const direction = vector.sub(this.camera.position).normalize();
    const t = -this.camera.position.y / direction.y;
    if (!Number.isFinite(t) || t < 0) {
      return;
    }

    const scenePosition = this.camera.position.clone().addScaledVector(direction, t);
    scenePosition.y = 0;
    const worldPosition = scenePosition.clone().multiplyScalar(AU / 100);
    const type = this.placingType as BodyType;
    const preset = BODY_PRESETS[type];
    if (!preset) {
      return;
    }

    const star = this.solar.findStar();
    let velocity = new THREE.Vector3();
    if (star && type !== 'star' && type !== 'blackhole' && type !== 'asteroid') {
      velocity = keplerVelocity(worldPosition.clone().sub(star.position), star.mass);
      velocity.add(star.velocity);
    }

    this.bodyCounter += 1;
    const body = new Body({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.bodyCounter}`,
      type,
      ...preset,
      position: worldPosition,
      velocity,
    }, this.scene);

    if (type === 'blackhole') {
      buildBlackHoleVisuals(body);
      SolarEventBus.emit('edu:blackhole', {});
    }
    if (type === 'star') {
      applyStarVisuals(body, this.scene);
      const starLight = new THREE.PointLight(0xfff5c0, 2, 0, 0);
      body.mesh.add(starLight);
    }

    this.solar.add(body);
  }

  private spawnImpactDebris(target: Body, impactor: Body, relVel: THREE.Vector3): void {
    if (!this.solar) {
      return;
    }
    const currentDebris = this.solar.bodies.filter((body) => body.type === 'debris').length;
    if (currentDebris >= MAX_DEBRIS) {
      return;
    }

    const relSpeed = relVel.length();
    const debrisMassTotal = impactor.mass * 0.7;
    const desiredCount = Math.min(8, Math.max(4, Math.ceil(debrisMassTotal / 5e20)));
    const actualCount = Math.min(desiredCount, MAX_DEBRIS - currentDebris);
    const debrisMassEach = Math.max(debrisMassTotal / actualCount, 5e20);
    const impactAxis = impactor.position.clone().sub(target.position).normalize();
    const scatterRadius = target.drawRadius * (AU / 100) * 0.8;
    const escapeSpeed = escapeVelocity(target);

    for (let index = 0; index < actualCount; index += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.6;
      const randomDirection = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi),
        Math.sin(phi),
        Math.sin(theta) * Math.cos(phi),
      );
      const ejectaDirection = impactAxis.clone().multiplyScalar(0.55).addScaledVector(randomDirection, 0.45).normalize();
      const ejectaSpeed = relSpeed * (0.05 + Math.random() * 0.2);
      const scatter = new THREE.Vector3(
        Math.random() - 0.5,
        (Math.random() - 0.5) * 0.3,
        Math.random() - 0.5,
      ).normalize().multiplyScalar(scatterRadius * (0.15 + Math.random() * 0.85));

      this.bodyCounter += 1;
      const debris = new Body({
        name: `Fragment ${this.bodyCounter}`,
        type: 'debris',
        mass: debrisMassEach,
        realRadius: BODY_PRESETS.debris.realRadius,
        drawRadius: BODY_PRESETS.debris.drawRadius,
        color: this.lerpColor(target.color, 0xff6622, 0.6),
        position: target.position.clone().add(scatter),
        velocity: target.velocity.clone().addScaledVector(ejectaDirection, ejectaSpeed),
      }, this.scene);
      this.solar.add(debris);
    }

    const flash = new THREE.PointLight(0xff7700, 12, target.drawRadius * 25);
    flash.position.copy(target.mesh.position);
    this.scene.add(flash);
    this.impactFlashes.push({ light: flash, age: 0, duration: 0.4 });
    EventBus.emit('edu:event', {
      text: `Impact on ${target.name}: ejecta launched at ${(relSpeed / 1000).toFixed(1)} km/s (escape ${ (escapeSpeed / 1000).toFixed(1)} km/s).`,
    });
  }

  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;
    return (Math.round(r1 + (r2 - r1) * t) << 16)
      | (Math.round(g1 + (g2 - g1) * t) << 8)
      | Math.round(b1 + (b2 - b1) * t);
  }

  private disposeScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const geometry = (mesh as THREE.Mesh).geometry;
      if (geometry) {
        geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => this.disposeMaterial(entry));
      } else if (material) {
        this.disposeMaterial(material);
      }
    });
    scene.clear();
  }

  private disposeMaterial(material: THREE.Material): void {
    const textureKeys = ['map', 'alphaMap', 'emissiveMap'];
    textureKeys.forEach((key) => {
      const texture = (material as THREE.Material & Record<string, unknown>)[key];
      if (texture instanceof THREE.Texture) {
        texture.dispose();
      }
    });
    material.dispose();
  }
}
