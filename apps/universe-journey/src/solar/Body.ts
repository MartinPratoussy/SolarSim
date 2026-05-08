import * as THREE from 'three';
import { G, AU } from './constants';

export type BodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'comet' | 'blackhole' | 'debris';

export interface BodyOptions {
  name: string;
  type: BodyType;
  mass: number;         // kg
  realRadius: number;   // meters
  drawRadius: number;   // scene units (artistic)
  color: number;        // hex
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  collidable?: boolean;
}

const TRAIL_LENGTH = 600;

export class Body {
  name: string;
  type: BodyType;
  mass: number;
  realRadius: number;
  drawRadius: number;
  color: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  collidable: boolean;

  mesh: THREE.Mesh;
  trailLine: THREE.Line;
  private trailBuffer: Float32Array;   // ring buffer (SI scene positions)
  private trailDisplay: Float32Array;  // ordered for GPU, separate from ring buffer
  private trailIndex = 0;
  private trailFull = false;
  private readonly trailScratch = new THREE.Vector3();

  constructor(opts: BodyOptions, scene: THREE.Scene) {
    this.name = opts.name;
    this.type = opts.type;
    this.mass = opts.mass;
    this.realRadius = opts.realRadius;
    this.drawRadius = opts.drawRadius;
    this.color = opts.color;
    this.position = opts.position.clone();
    this.velocity = opts.velocity.clone();
    this.collidable = opts.collidable ?? true;

    // Mesh
    const geo = opts.type === 'blackhole'
      ? new THREE.SphereGeometry(opts.drawRadius, 32, 32)
      : new THREE.SphereGeometry(opts.drawRadius, 24, 24);
    const mat = opts.type === 'blackhole'
      ? new THREE.MeshBasicMaterial({ color: 0x000000 })
      : new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.7, metalness: 0.1 });
    this.mesh = new THREE.Mesh(geo, mat);
    // Do NOT copy this.position (SI meters) directly to mesh — syncMesh handles conversion
    this.mesh.userData.body = this;
    scene.add(this.mesh);

    // Trail — ring buffer is separate from the GPU display buffer to avoid corruption
    this.trailBuffer  = new Float32Array(TRAIL_LENGTH * 3);
    this.trailDisplay = new Float32Array(TRAIL_LENGTH * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailDisplay, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: 0.4,
    });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    // Don't show trails for very small debris
    if (opts.type !== 'debris') scene.add(this.trailLine);
  }

  updateTrail() {
    const sx = metersToScene(this.position.x);
    const sy = metersToScene(this.position.y);
    const sz = metersToScene(this.position.z);

    // Write to ring buffer
    const idx = this.trailIndex * 3;
    this.trailBuffer[idx]     = sx;
    this.trailBuffer[idx + 1] = sy;
    this.trailBuffer[idx + 2] = sz;
    this.trailIndex = (this.trailIndex + 1) % TRAIL_LENGTH;
    if (!this.trailFull && this.trailIndex === 0) this.trailFull = true;

    this.remapTrail();
  }

  remapTrail(mapper?: (position: THREE.Vector3) => void) {
    // Build display buffer in chronological order (oldest → newest)
    const count = this.trailFull ? TRAIL_LENGTH : this.trailIndex;
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const src = ((this.trailIndex - count + i + TRAIL_LENGTH) % TRAIL_LENGTH) * 3;
        this.trailScratch.set(
          this.trailBuffer[src],
          this.trailBuffer[src + 1],
          this.trailBuffer[src + 2],
        );
        mapper?.(this.trailScratch);
        this.trailDisplay[i * 3] = this.trailScratch.x;
        this.trailDisplay[i * 3 + 1] = this.trailScratch.y;
        this.trailDisplay[i * 3 + 2] = this.trailScratch.z;
      }
      (this.trailLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.trailLine.geometry.setDrawRange(0, count);
    }
  }

  syncMesh() {
    this.mesh.position.set(
      metersToScene(this.position.x),
      metersToScene(this.position.y),
      metersToScene(this.position.z),
    );
  }

  /** Orbital period around a central body of mass M (seconds) */
  orbitalPeriod(centralMass: number): number {
    const r = this.position.length();
    return 2 * Math.PI * Math.sqrt((r * r * r) / (G * centralMass));
  }

  remove(scene: THREE.Scene) {
    scene.remove(this.mesh);
    scene.remove(this.trailLine);
    this.mesh.geometry.dispose();
    this.trailLine.geometry.dispose();
  }
}

/** Compute initial circular-orbit velocity perpendicular to position, in the XZ plane */
export function keplerVelocity(
  pos: THREE.Vector3,
  centralMass: number,
  inclination = 0
): THREE.Vector3 {
  const r = pos.length();
  const speed = Math.sqrt(G * centralMass / r);
  // Perpendicular in XZ plane, then tilt by inclination
  const angle = Math.atan2(pos.z, pos.x);
  const vx = -Math.sin(angle) * speed;
  const vz =  Math.cos(angle) * speed;
  const vy =  Math.sin(inclination) * speed;
  return new THREE.Vector3(vx, vy, vz);
}

/** Convert meters to scene units (1 AU = 100 scene units) */
export function metersToScene(m: number): number {
  return (m / AU) * 100;
}
