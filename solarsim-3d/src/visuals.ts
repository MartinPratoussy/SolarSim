import * as THREE from 'three';
import { Body } from './Body';

/** Create a starfield as a Points object on a large sphere */
export function createStarfield(scene: THREE.Scene) {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const radius = 15000;
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

export function createSunGlow(scene: THREE.Scene, position: THREE.Vector3, radius: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,   'rgba(255,255,200,0.9)');
  grad.addColorStop(0.3, 'rgba(255,200,50,0.5)');
  grad.addColorStop(0.7, 'rgba(255,120,0,0.15)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(radius * 8);
  sprite.position.copy(position);
  scene.add(sprite);
  return sprite;
}

// Shared texture loader
const loader = new THREE.TextureLoader();

export function applyPlanetTexture(body: Body, textureName: string) {
  const tex = loader.load(`/textures/${textureName}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = body.mesh.material as THREE.MeshStandardMaterial;
  mat.map = tex;
  mat.needsUpdate = true;
}

// Atmosphere halo shader
const atmosphereVert = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmosphereFrag = /* glsl */`
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
    gl_FragColor = vec4(glowColor, intensity * 0.7);
  }
`;

export function addAtmosphere(body: Body, color: THREE.Color) {
  const geo = new THREE.SphereGeometry(body.drawRadius * 1.18, 24, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: color } },
    vertexShader: atmosphereVert,
    fragmentShader: atmosphereFrag,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  body.mesh.add(new THREE.Mesh(geo, mat));
}

export function addSaturnRing(body: Body) {
  const tex = loader.load('/textures/saturn_ring.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.RingGeometry(body.drawRadius * 1.4, body.drawRadius * 2.6, 64);
  // Fix UVs so the alpha gradient maps radially
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv  = geo.attributes.uv as THREE.BufferAttribute;
  const v3  = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    uv.setXY(i, v3.length() / (body.drawRadius * 2.6), 0);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  body.mesh.add(ring);
}

export function buildBlackHoleVisuals(body: Body) {
  // Accretion disk
  const diskGeo = new THREE.TorusGeometry(body.drawRadius * 2.5, body.drawRadius * 0.6, 16, 64);
  const diskMat = new THREE.MeshBasicMaterial({ color: 0xff6000, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 4;
  body.mesh.add(disk);

  // Inner hot ring
  const innerGeo = new THREE.TorusGeometry(body.drawRadius * 1.6, body.drawRadius * 0.3, 16, 64);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = Math.PI / 4;
  body.mesh.add(inner);

  // Event horizon dark sprite
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0,    'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,1)');
  g.addColorStop(0.6,  'rgba(40,10,0,0.6)');
  g.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.setScalar(body.drawRadius * 4);
  body.mesh.add(sprite);
}

/** Stretch body toward black hole; returns true when it crosses event horizon */
export function spaghettify(body: Body, blackhole: Body): boolean {
  const dist = body.position.distanceTo(blackhole.position);
  const eventHorizon = blackhole.drawRadius * 3;
  if (dist < eventHorizon * 8) {
    const stretch = 1 + (1 - dist / (eventHorizon * 8)) * 4;
    body.mesh.scale.set(1 / stretch, 1 / stretch, stretch);
    body.mesh.lookAt(blackhole.position);
    const opacity = Math.max(0, (dist - eventHorizon) / (eventHorizon * 7));
    const mat = body.mesh.material as THREE.MeshStandardMaterial;
    mat.transparent = true;
    mat.opacity = opacity;
  }
  return dist < eventHorizon;
}

export function spawnGravWaveRing(scene: THREE.Scene, position: THREE.Vector3) {
  const rings: { mesh: THREE.Mesh; age: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.RingGeometry(0.1, 0.3, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff, side: THREE.DoubleSide, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    rings.push({ mesh, age: -i * 0.3 });
  }
  function animateRings() {
    let allDone = true;
    for (const r of rings) {
      r.age += 0.016;
      if (r.age < 0) { allDone = false; continue; }
      r.mesh.scale.setScalar(r.age * 80);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - r.age);
      if (r.age < 1.2) allDone = false;
    }
    if (!allDone) requestAnimationFrame(animateRings);
    else rings.forEach(r => { scene.remove(r.mesh); r.mesh.geometry.dispose(); });
  }
  animateRings();
}
