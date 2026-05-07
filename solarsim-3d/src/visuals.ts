import * as THREE from 'three';

/** Create a starfield as a Points object on a large sphere */
export function createStarfield(scene: THREE.Scene) {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const radius = 15000;

  for (let i = 0; i < count; i++) {
    // Uniform distribution on a sphere
    const theta = Math.random() * 2 * Math.PI;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
  });

  scene.add(new THREE.Points(geo, mat));
}

/** Add a glow sprite behind the Sun mesh */
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
