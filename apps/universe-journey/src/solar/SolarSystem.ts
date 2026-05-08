import * as THREE from 'three';
import { Body, type BodyType } from './Body';
import { rk4Step } from './physics';
import { AU, G } from './constants';
import { EventBus } from './solarEvents';

const POSITION_BOUND = 50 * AU; // bodies beyond 50 AU (in meters) are removed

// Mass thresholds for debris → asteroid → moon → planet promotion
const MASS_ASTEROID = 1e18;  // ~300 km rocky body
const MASS_MOON     = 5e21;  // ~1/1000 Moon
const MASS_PLANET   = 5e23;  // ~1/10 Earth

// Impact debris is spawned when a body is at least this much more massive than the impactor.
// Below this ratio bodies just merge (similar-size collision).
const IMPACT_MASS_RATIO = 20;

// Minimum relative velocity (m/s) before we treat a collision as a proper "impact".
// Below this, bodies are just touching gently and simply merge.
const IMPACT_MIN_REL_VEL = 300; // m/s

export class SolarSystem {
  bodies: Body[] = [];

  /**
   * Optional callback called when a significant impact happens (small body hits large body at
   * speed). Receives the surviving body, the absorbed impactor, and the relative velocity of the
   * impactor just before collision. The callback is responsible only for spawning debris — the
   * impactor will be removed by handleCollisions() automatically after the callback returns.
   */
  onImpact: ((survivor: Body, impactor: Body, relVel: THREE.Vector3) => void) | null = null;

  private scene: THREE.Scene;
  private seenImpact = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private collisionRadius(body: Body): number {
    return Math.max(body.realRadius, 1);
  }

  private mergedRadius(a: number, b: number, fraction = 1): number {
    return Math.pow(Math.pow(a, 3) + Math.pow(b, 3) * fraction, 1 / 3);
  }

  add(body: Body) {
    this.bodies.push(body);
  }

  update(dt: number) {
    if (this.bodies.length === 0) return;
    rk4Step(this.bodies, dt);
    for (const b of this.bodies) {
      b.syncMesh();
      b.updateTrail();
    }
    this.handleCollisions();
    this.cullDistant();
  }

  private handleCollisions() {
    const removed = new Set<Body>();

    for (let i = 0; i < this.bodies.length; i++) {
      const b1 = this.bodies[i];
      if (removed.has(b1) || !b1.collidable) continue;

      for (let j = i + 1; j < this.bodies.length; j++) {
        const b2 = this.bodies[j];
        if (removed.has(b2) || !b2.collidable) continue;

        // Compare in physical SI space. Rendering scale mode must not change physics.
        const dist = b1.position.distanceTo(b2.position);
        if (dist > this.collisionRadius(b1) + this.collisionRadius(b2)) continue;

        const [survivor, absorbed] = b1.mass >= b2.mass ? [b1, b2] : [b2, b1];
        const massRatio = survivor.mass / absorbed.mass;

        // Relative velocity of impactor with respect to target
        const relVel = absorbed.velocity.clone().sub(survivor.velocity);
        const relSpeed = relVel.length();

        const isImpact =
          massRatio >= IMPACT_MASS_RATIO &&
          relSpeed >= IMPACT_MIN_REL_VEL &&
          this.onImpact !== null &&
          survivor.type !== 'debris' && survivor.type !== 'asteroid';

        if (isImpact) {
          // ── Impact: spawn ejecta debris, survivor absorbs 30% of impactor mass ──
          this.onImpact!(survivor, absorbed, relVel);
          const absorbFrac = 0.3;
          survivor.mass += absorbed.mass * absorbFrac;
          survivor.realRadius = this.mergedRadius(survivor.realRadius, absorbed.realRadius, absorbFrac);
          survivor.drawRadius = this.mergedRadius(survivor.drawRadius, absorbed.drawRadius, absorbFrac);
          survivor.mesh.geometry.dispose();
          survivor.mesh.geometry = new THREE.SphereGeometry(survivor.drawRadius, 24, 24);

          if (!this.seenImpact) {
            this.seenImpact = true;
            EventBus.emit('edu:impact', { target: survivor, fragmentCount: 6 });
          }
        } else {
          // ── Simple merge: full momentum conservation ──
          const totalMass = survivor.mass + absorbed.mass;
          survivor.velocity.x = (survivor.velocity.x * survivor.mass + absorbed.velocity.x * absorbed.mass) / totalMass;
          survivor.velocity.y = (survivor.velocity.y * survivor.mass + absorbed.velocity.y * absorbed.mass) / totalMass;
          survivor.velocity.z = (survivor.velocity.z * survivor.mass + absorbed.velocity.z * absorbed.mass) / totalMass;
          survivor.mass = totalMass;
          survivor.realRadius = this.mergedRadius(survivor.realRadius, absorbed.realRadius);
          survivor.drawRadius = this.mergedRadius(survivor.drawRadius, absorbed.drawRadius);
          survivor.mesh.geometry.dispose();
          survivor.mesh.geometry = new THREE.SphereGeometry(survivor.drawRadius, 24, 24);
          this.promoteType(survivor);
        }

        removed.add(absorbed);
        absorbed.remove(this.scene);
      }
    }

    this.bodies = this.bodies.filter(b => !removed.has(b));
  }

  /**
   * Promote a body's type based on accumulated mass.
   * Gives accreted bodies a more accurate color and category.
   */
  private promoteType(body: Body) {
    const oldType = body.type;
    let newType: BodyType = body.type;

    if (body.type === 'debris' || body.type === 'asteroid' || body.type === 'comet') {
      if      (body.mass >= MASS_PLANET)   newType = 'planet';
      else if (body.mass >= MASS_MOON)     newType = 'moon';
      else if (body.mass >= MASS_ASTEROID) newType = 'asteroid';
      else                                 newType = 'debris';
    }

    if (newType !== oldType) {
      body.type = newType;
      const colorMap: Partial<Record<BodyType, number>> = {
        asteroid: 0x999988,
        moon:     0xbbbbbb,
        planet:   0x5599cc,
      };
      const col = colorMap[newType];
      if (col !== undefined) {
        (body.mesh.material as THREE.MeshStandardMaterial).color.setHex(col);
      }
      EventBus.emit('edu:accretion', { body });
    }
  }

  private cullDistant() {
    const toRemove: Body[] = [];
    for (const b of this.bodies) {
      if (b.type === 'star' || b.type === 'blackhole') continue;
      if (b.position.length() > POSITION_BOUND) {
        toRemove.push(b);
        EventBus.emit('edu:ejected', { body: b });
      }
    }
    for (const b of toRemove) {
      b.remove(this.scene);
      this.bodies = this.bodies.filter(x => x !== b);
    }
  }

  findStar(): Body | undefined {
    return this.bodies.find(b => b.type === 'star');
  }

  remove(body: Body) {
    body.remove(this.scene);
    this.bodies = this.bodies.filter(b => b !== body);
  }
}

/** Escape velocity (m/s) from a body's physical surface radius. */
export function escapeVelocity(body: Body): number {
  return Math.sqrt(2 * G * body.mass / Math.max(body.realRadius, 1));
}
