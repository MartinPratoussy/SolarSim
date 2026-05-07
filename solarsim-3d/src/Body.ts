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
  private trailBuffer: Float32Array;
  private trailIndex = 0;
  private trailFull = false;

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
    this.mesh.position.copy(this.position);
    this.mesh.userData.body = this;
    scene.add(this.mesh);

    // Trail
    this.trailBuffer = new Float32Array(TRAIL_LENGTH * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailBuffer, 3));
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
    const idx = this.trailIndex * 3;
    this.trailBuffer[idx]     = this.position.x;
    this.trailBuffer[idx + 1] = this.position.y;
    this.trailBuffer[idx + 2] = this.position.z;
    this.trailIndex = (this.trailIndex + 1) % TRAIL_LENGTH;
    if (!this.trailFull && this.trailIndex === 0) this.trailFull = true;

    // Reorder buffer so it draws from oldest→newest
    const count = this.trailFull ? TRAIL_LENGTH : this.trailIndex;
    if (count > 1) {
      const ordered = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const src = ((this.trailIndex - count + i + TRAIL_LENGTH) % TRAIL_LENGTH) * 3;
        ordered[i * 3]     = this.trailBuffer[src];
        ordered[i * 3 + 1] = this.trailBuffer[src + 1];
        ordered[i * 3 + 2] = this.trailBuffer[src + 2];
      }
      (this.trailLine.geometry.attributes.position as THREE.BufferAttribute).array.set(ordered);
      (this.trailLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.trailLine.geometry.setDrawRange(0, count);
    }
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
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
