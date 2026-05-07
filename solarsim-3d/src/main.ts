import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Body, keplerVelocity, metersToScene, type BodyType } from './Body';
import { SolarSystem } from './SolarSystem';
import { SOLAR_DATA, initialPosition } from './solarData';
import { BASE_TIMESTEP, AU } from './constants';
import {
  createStarfield, createSunGlow,
  applyPlanetTexture, addAtmosphere, addSaturnRing,
  buildBlackHoleVisuals, spaghettify, spawnGravWaveRing,
  applyStarVisuals, createGravityGrid, LensDistortionShader,
} from './visuals';
import { updateInfoPanel, showTooltip, hideTooltip } from './ui';
import { EventBus } from './events';

// ── Renderer & Scene ──────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// ── Camera ────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100000);
camera.position.set(0, 250, 500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 8000;
controls.addEventListener('start', () => { flyState = null; followMode = false; }); // cancel fly+follow on drag

// ── Post-processing (gravitational lens distortion) ───────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const lensPass = new ShaderPass(LensDistortionShader);
lensPass.enabled = false; // only active when BHs exist
composer.addPass(lensPass);

// ── Lights ────────────────────────────────────────────────────────────────
// No decay so all planets are visibly illuminated regardless of distance
const sunLight = new THREE.PointLight(0xfff5c0, 3, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x334466, 0.6)); // subtle blue-space fill

// ── Starfield ─────────────────────────────────────────────────────────────
createStarfield(scene);

// ── Gravity grid (overlay scene — rendered AFTER composer so lens never warps it) ──
const overlayScene = new THREE.Scene();
const gravityGrid = createGravityGrid(scene);
scene.remove(gravityGrid.mesh);      // pull out of main scene
overlayScene.add(gravityGrid.mesh);  // into overlay, rendered post-lens

// ── Solar system ──────────────────────────────────────────────────────────
const solar = new SolarSystem(scene);

// Sun
const sun = new Body({
  name: 'Sun', type: 'star',
  mass: SOLAR_DATA.sun.mass,
  realRadius: SOLAR_DATA.sun.realRadius,
  drawRadius: SOLAR_DATA.sun.drawRadius,
  color: SOLAR_DATA.sun.color,
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(0, 0, 0),
}, scene);
applyPlanetTexture(sun, SOLAR_DATA.sun.texture);
(sun.mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xfff5c0);
(sun.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
solar.add(sun);

// Sun glow as child of mesh so it always follows the sun
const sunGlow = createSunGlow(scene, new THREE.Vector3(0, 0, 0), sun.drawRadius);
scene.remove(sunGlow);
sun.mesh.add(sunGlow);
sunGlow.position.set(0, 0, 0);

// Planets
for (const pd of SOLAR_DATA.planets) {
  const pos = initialPosition(pd);          // SI meters
  const vel = keplerVelocity(pos, SOLAR_DATA.sun.mass, pd.inclination); // SI m/s
  const planet = new Body({
    name: pd.name, type: 'planet',
    mass: pd.mass,
    realRadius: pd.realRadius,
    drawRadius: pd.drawRadius,
    color: pd.color,
    position: pos,
    velocity: vel,
  }, scene);
  applyPlanetTexture(planet, pd.texture);
  planet.mesh.rotation.z = pd.axialTilt;
  if (pd.atmosphere) addAtmosphere(planet, pd.atmosphere);
  if (pd.hasRing) addSaturnRing(planet);
  solar.add(planet);
}

// Zero total system momentum so the center of mass stays at the origin
{
  const totalMom = new THREE.Vector3();
  let totalMass = 0;
  for (const b of solar.bodies) {
    totalMom.addScaledVector(b.velocity, b.mass);
    totalMass += b.mass;
  }
  const vCoM = totalMom.divideScalar(totalMass);
  for (const b of solar.bodies) b.velocity.sub(vCoM);
}

// Initial mesh sync so bodies appear at correct scene positions on frame 0
for (const b of solar.bodies) b.syncMesh();

// ── State ─────────────────────────────────────────────────────────────────
let speedMultiplier = 1;
let selectedBody: Body | null = null;
let placingType: BodyType | 'none' = 'none';
let followMode = false;
let artisticScale = true;
let simulatedDays = 0;

// Camera fly-to animation
interface FlyState { targetEnd: THREE.Vector3; camEnd: THREE.Vector3; targetStart: THREE.Vector3; camStart: THREE.Vector3; t: number; followOnLand: boolean; }
let flyState: FlyState | null = null;

// Camera follow — tracks body delta each frame
let followedBodyLastPos = new THREE.Vector3();

// ── Raycaster (kept for right-click delete) ───────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** Find the closest body to screen coords (px) within threshold pixels. */
function nearestBodyToScreen(cx: number, cy: number, threshold: number): Body | null {
  const hw = window.innerWidth  / 2;
  const hh = window.innerHeight / 2;
  let nearest: Body | null = null;
  let nearestDist = threshold;
  for (const body of solar.bodies) {
    const s = body.mesh.position.clone().project(camera);
    if (s.z > 1) continue; // behind camera
    const d = Math.hypot((s.x + 1) * hw - cx, (1 - s.y) * hh - cy);
    if (d < nearestDist) { nearestDist = d; nearest = body; }
  }
  return nearest;
}

// ── Toolbar ───────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('#toolbar button').forEach(btn => {
  btn.addEventListener('click', () => {
    placingType = (btn.dataset.type as BodyType | 'none') ?? 'none';
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Time controls ─────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('#time-controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    speedMultiplier = Number(btn.dataset.speed);
    document.querySelectorAll('#time-controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Scale toggle ──────────────────────────────────────────────────────────
const scaleToggle = document.getElementById('scale-toggle')!;
scaleToggle.addEventListener('click', () => {
  artisticScale = !artisticScale;
  scaleToggle.textContent = artisticScale ? '🔭 Artistic Scale' : '🔭 True Scale';
  for (const body of solar.bodies) {
    if (body.type === 'star' || body.type === 'blackhole') continue;
    const newR = artisticScale
      ? body.drawRadius
      : Math.max(0.05, metersToScene(body.realRadius) * 300);
    body.mesh.geometry.dispose();
    body.mesh.geometry = new THREE.SphereGeometry(newR, 24, 24);
  }
});

// ── Gravity grid toggle ───────────────────────────────────────────────────
const gridToggle = document.getElementById('grid-toggle')!;
gridToggle.addEventListener('click', () => {
  gravityGrid.mesh.visible = !gravityGrid.mesh.visible;
  gridToggle.classList.toggle('active', gravityGrid.mesh.visible);
});

// ── Click: select or place ────────────────────────────────────────────────
renderer.domElement.addEventListener('click', (e) => {
  if (placingType !== 'none') {
    placeBody(e.clientX, e.clientY);
    return;
  }

  const body = nearestBodyToScreen(e.clientX, e.clientY, 48);
  if (body) {
    selectedBody = body;
    followMode = false;
    followedBodyLastPos.copy(body.mesh.position);
    updateInfoPanel(body, solar.findStar()?.mass ?? 0);
    EventBus.emit('select:body', { body });
  } else {
    selectedBody = null;
    followMode = false;
    updateInfoPanel(null, 0);
    EventBus.emit('select:none', {});
  }
});

// ── Double-click: fly camera to body and lock follow ────────────────────
renderer.domElement.addEventListener('dblclick', (e) => {
  const body = nearestBodyToScreen(e.clientX, e.clientY, 60);
  if (!body) return;
  followMode = false;
  selectedBody = body;
  updateInfoPanel(body, solar.findStar()?.mass ?? 0);
  const zoom = Math.max(body.drawRadius * 12, 18);
  const dir = camera.position.clone().sub(controls.target).normalize();
  flyState = {
    targetStart: controls.target.clone(),
    camStart:    camera.position.clone(),
    targetEnd:   body.mesh.position.clone(),
    camEnd:      body.mesh.position.clone().addScaledVector(dir, zoom),
    followOnLand: true,
    t: 0,
  };
});

// ── Right-click: delete ───────────────────────────────────────────────────
renderer.domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(solar.bodies.map(b => b.mesh));
  if (hits.length > 0) {
    const body = hits[0].object.userData.body as Body;
    if (body.type !== 'star') {
      if (selectedBody === body) { selectedBody = null; updateInfoPanel(null, 0); }
      solar.remove(body);
    }
  }
});

// ── Hover tooltip — screen-space proximity (handles small planets reliably) ──
renderer.domElement.addEventListener('mousemove', (e) => {
  const body = nearestBodyToScreen(e.clientX, e.clientY, 48);
  if (body) showTooltip(body, e.clientX, e.clientY);
  else hideTooltip();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    followMode = selectedBody !== null && !followMode;
    if (followMode && selectedBody) followedBodyLastPos.copy(selectedBody.mesh.position);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBody && selectedBody.type !== 'star') {
    solar.remove(selectedBody);
    selectedBody = null;
    updateInfoPanel(null, 0);
  }
});

// ── Place body ────────────────────────────────────────────────────────────
let bodyCounter = 0;

const BODY_PRESETS: Record<string, { mass: number; realRadius: number; drawRadius: number; color: number }> = {
  planet:    { mass: 6e24,   realRadius: 6.4e6,  drawRadius: 1.0, color: 0x4fa3e0 },
  moon:      { mass: 7.3e22, realRadius: 1.74e6, drawRadius: 0.4, color: 0xbbbbbb },
  star:      { mass: 2e30,   realRadius: 7e8,    drawRadius: 5.0, color: 0xfff5c0 },
  asteroid:  { mass: 1e15,   realRadius: 5e4,    drawRadius: 0.2, color: 0x888888 },
  comet:     { mass: 1e13,   realRadius: 2e3,    drawRadius: 0.2, color: 0xaaddff },
  blackhole: { mass: 1e31,   realRadius: 3e9,    drawRadius: 2.0, color: 0x000000 },
};

function placeBody(screenX: number, screenY: number) {
  const vec = new THREE.Vector3(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1,
    0.5
  );
  vec.unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  const t = -camera.position.y / dir.y;
  if (!isFinite(t) || t < 0) return;
  const scenePos = camera.position.clone().addScaledVector(dir, t);
  scenePos.y = 0;

  // Convert scene units → SI meters for physics
  const worldPosSI = scenePos.clone().multiplyScalar(AU / 100);

  const type = placingType as BodyType;
  const preset = BODY_PRESETS[type];
  if (!preset) return;

  const star = solar.findStar();
  let vel = new THREE.Vector3();
  if (star && type !== 'star' && type !== 'blackhole' && type !== 'asteroid') {
    // Relative position from star in SI meters, then compute Kepler velocity in m/s
    vel = keplerVelocity(worldPosSI.clone().sub(star.position), star.mass);
    vel.add(star.velocity);
  }

  bodyCounter++;
  const body = new Body({
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${bodyCounter}`,
    type, ...preset,
    position: worldPosSI,
    velocity: vel,
  }, scene);

  if (type === 'blackhole') {
    buildBlackHoleVisuals(body);
    EventBus.emit('edu:blackhole', {});
  }

  if (type === 'star') {
    applyStarVisuals(body, scene);
    // Give this star its own light source
    const starLight = new THREE.PointLight(0xfff5c0, 2, 0, 0);
    body.mesh.add(starLight);
  }

  solar.add(body);
}

// ── Time display ──────────────────────────────────────────────────────────
const timeDisplay = document.getElementById('time-display')!;

// ── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animate ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const dt = BASE_TIMESTEP * speedMultiplier * delta;

  if (speedMultiplier > 0) {
    solar.update(dt);
    simulatedDays += dt / 86400;
  }

  // Planet self-rotation
  for (const body of solar.bodies) {
    if (body.type === 'planet' || body.type === 'star') {
      body.mesh.rotation.y += 0.002;
    }
  }

  // Spaghettification near black holes
  const blackholes = solar.bodies.filter(b => b.type === 'blackhole');
  if (blackholes.length > 0) {
    const toRemove: Body[] = [];
    for (const body of solar.bodies) {
      if (body.type === 'blackhole' || body.type === 'star') continue;
      for (const bh of blackholes) {
        if (spaghettify(body, bh)) {
          toRemove.push(body);
          break;
        }
      }
    }
    for (const b of toRemove) solar.remove(b);

    // Check black hole mergers
    for (let i = 0; i < blackholes.length; i++) {
      for (let j = i + 1; j < blackholes.length; j++) {
        const bh1 = blackholes[i], bh2 = blackholes[j];
        if (bh1.mesh.position.distanceTo(bh2.mesh.position) < bh1.drawRadius + bh2.drawRadius) {
          const totalMass = bh1.mass + bh2.mass;
          bh1.velocity.multiplyScalar(bh1.mass / totalMass).addScaledVector(bh2.velocity, bh2.mass / totalMass);
          bh1.mass = totalMass;
          bh1.drawRadius = Math.pow(Math.pow(bh1.drawRadius, 3) + Math.pow(bh2.drawRadius, 3), 1/3);
          spawnGravWaveRing(scene, bh1.mesh.position.clone());
          solar.remove(bh2);
        }
      }
    }
  }

  sunLight.position.copy(sun.mesh.position);

  // Camera fly-to animation (double-click focus)
  if (flyState) {
    // Keep target/cam endpoints anchored to the moving body
    if (selectedBody) {
      const zoom = Math.max(selectedBody.drawRadius * 12, 18);
      const dir = flyState.camEnd.clone().sub(flyState.targetEnd).normalize();
      flyState.targetEnd.copy(selectedBody.mesh.position);
      flyState.camEnd.copy(selectedBody.mesh.position).addScaledVector(dir, zoom);
    }
    flyState.t = Math.min(flyState.t + delta * 1.8, 1); // ~0.55 s
    const k = flyState.t < 0.5
      ? 2 * flyState.t * flyState.t                       // ease-in
      : 1 - Math.pow(-2 * flyState.t + 2, 2) / 2;        // ease-out
    controls.target.lerpVectors(flyState.targetStart, flyState.targetEnd, k);
    camera.position.lerpVectors(flyState.camStart,    flyState.camEnd,    k);
    if (flyState.t >= 1) {
      if (flyState.followOnLand && selectedBody) {
        followMode = true;
        followedBodyLastPos.copy(selectedBody.mesh.position);
      }
      flyState = null;
    }
  } else if (followMode && selectedBody) {
    // Translate camera and orbit target by the body's movement delta this frame
    const delta3 = selectedBody.mesh.position.clone().sub(followedBodyLastPos);
    controls.target.add(delta3);
    camera.position.add(delta3);
    followedBodyLastPos.copy(selectedBody.mesh.position);
  }
  if (selectedBody) updateInfoPanel(selectedBody, solar.findStar()?.mass ?? 0);

  const d = Math.floor(simulatedDays);
  timeDisplay.textContent = d < 730 ? `Day ${d.toLocaleString()}` : `Year ${(d / 365.25).toFixed(1)}`;

  // Gravity grid deformation
  if (gravityGrid.mesh.visible) gravityGrid.update(solar.bodies);

  // Lens distortion — update BH screen positions and toggle pass
  lensPass.enabled = blackholes.length > 0;
  if (lensPass.enabled) {
    const uvs    = lensPass.uniforms['bhUV'].value      as THREE.Vector2[];
    const strengths = lensPass.uniforms['bhStrength'].value as number[];
    for (let i = 0; i < 4; i++) {
      if (i < blackholes.length) {
        const p = blackholes[i].mesh.position.clone().project(camera);
        uvs[i].set((p.x + 1) / 2, (p.y + 1) / 2);
        strengths[i] = blackholes[i].drawRadius * blackholes[i].drawRadius * 0.00025;
      } else {
        strengths[i] = 0;
      }
    }
    lensPass.uniforms['bhCount'].value = Math.min(blackholes.length, 4);
  }

  controls.update();
  composer.render();
  // Grid overlay: rendered after post-processing so lens distortion never affects it
  if (gravityGrid.mesh.visible) {
    renderer.autoClear = false;
    renderer.render(overlayScene, camera);
    renderer.autoClear = true;
  }
}

animate();
