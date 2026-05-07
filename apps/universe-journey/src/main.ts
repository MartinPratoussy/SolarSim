import * as THREE from 'three';
import { EduPanel } from './EduPanel';
import { HUD } from './HUD';
import { ScaleManager } from './ScaleManager';
import { Scale1Quarks } from './scales/Scale1Quarks';
import { Scale2Nuclear } from './scales/Scale2Nuclear';
import { Scale3Atomic } from './scales/Scale3Atomic';
import { Scale4GasCloud } from './scales/Scale4GasCloud';
import { Scale5Stellar } from './scales/Scale5Stellar';
import { Scale6SolarSystem } from './scales/Scale6SolarSystem';

const container = document.getElementById('canvas-container');
const skipButton = document.getElementById('skip-btn');

if (!container || !skipButton) {
  throw new Error('Universe Journey bootstrap elements are missing.');
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
container.appendChild(renderer.domElement);

const scales = [
  new Scale1Quarks(),
  new Scale2Nuclear(),
  new Scale3Atomic(),
  new Scale4GasCloud(),
  new Scale5Stellar(),
  new Scale6SolarSystem(),
];

const scaleManager = new ScaleManager(scales, container, renderer);
new HUD(scaleManager);
new EduPanel();

skipButton.addEventListener('click', () => {
  scaleManager.skip();
});

scaleManager.start();

let previous = performance.now();
const frame = (now: number) => {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  scaleManager.currentScale.update(dt);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  scaleManager.currentScale.onResize(window.innerWidth, window.innerHeight);
});
