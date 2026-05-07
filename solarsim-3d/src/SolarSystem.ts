import * as THREE from 'three';
import { Body } from './Body';
import { rk4Step } from './physics';
import { AU } from './constants';
import { metersToScene } from './Body';
import { EventBus } from './events';

const SCENE_BOUND = metersToScene(50 * AU); // bodies beyond 50 AU are removed

export class SolarSystem {
  bodies: Body[] = [];
  private scene: THREE.Scene;
  private seenEvents = new Set<string>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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

        const dist = b1.position.distanceTo(b2.position);
        const threshold = b1.drawRadius + b2.drawRadius;
        if (dist > threshold) continue;

        // Merge smaller into larger
        const [survivor, absorbed] = b1.mass >= b2.mass ? [b1, b2] : [b2, b1];
        const totalMass = survivor.mass + absorbed.mass;
        survivor.velocity.x = (survivor.velocity.x * survivor.mass + absorbed.velocity.x * absorbed.mass) / totalMass;
        survivor.velocity.y = (survivor.velocity.y * survivor.mass + absorbed.velocity.y * absorbed.mass) / totalMass;
        survivor.velocity.z = (survivor.velocity.z * survivor.mass + absorbed.velocity.z * absorbed.mass) / totalMass;
        survivor.mass = totalMass;
        survivor.drawRadius = Math.pow(
          Math.pow(survivor.drawRadius, 3) + Math.pow(absorbed.drawRadius, 3), 1 / 3
        );
        (survivor.mesh.geometry as THREE.SphereGeometry).dispose();
        survivor.mesh.geometry = new THREE.SphereGeometry(survivor.drawRadius, 24, 24);

        removed.add(absorbed);
        absorbed.remove(this.scene);

        // Fire educational event
        if (!this.seenEvents.has('collision')) {
          this.seenEvents.add('collision');
          EventBus.emit('edu:collision', { survivor });
        }
      }
    }

    this.bodies = this.bodies.filter(b => !removed.has(b));
  }

  private cullDistant() {
    const toRemove: Body[] = [];
    for (const b of this.bodies) {
      if (b.type === 'star' || b.type === 'blackhole') continue;
      if (b.position.length() > SCENE_BOUND) {
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
