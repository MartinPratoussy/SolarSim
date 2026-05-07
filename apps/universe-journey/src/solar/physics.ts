import * as THREE from 'three';
import { G } from './constants';
import { Body } from './Body';

/** RK4 state for one body: [x, y, z, vx, vy, vz] */
type State = [number, number, number, number, number, number];

function derivative(state: State, fx: number, fy: number, fz: number, mass: number): State {
  return [state[3], state[4], state[5], fx / mass, fy / mass, fz / mass];
}

function addStates(a: State, b: State, scale: number): State {
  return [
    a[0] + b[0] * scale,
    a[1] + b[1] * scale,
    a[2] + b[2] * scale,
    a[3] + b[3] * scale,
    a[4] + b[4] * scale,
    a[5] + b[5] * scale,
  ];
}

function computeForces(bodies: Body[]): Map<Body, THREE.Vector3> {
  const forces = new Map<Body, THREE.Vector3>();
  for (const b of bodies) forces.set(b, new THREE.Vector3());

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const b1 = bodies[i], b2 = bodies[j];
      const dx = b2.position.x - b1.position.x;
      const dy = b2.position.y - b1.position.y;
      const dz = b2.position.z - b1.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 1e10) continue; // avoid singularity
      const dist = Math.sqrt(distSq);
      const force = (G * b1.mass * b2.mass) / distSq;
      const fx = (force / dist) * dx;
      const fy = (force / dist) * dy;
      const fz = (force / dist) * dz;
      forces.get(b1)!.x += fx;
      forces.get(b1)!.y += fy;
      forces.get(b1)!.z += fz;
      forces.get(b2)!.x -= fx;
      forces.get(b2)!.y -= fy;
      forces.get(b2)!.z -= fz;
    }
  }
  return forces;
}

/** Single RK4 integration step for all bodies */
export function rk4Step(bodies: Body[], dt: number) {
  const n = bodies.length;

  // Capture initial states
  const states: State[] = bodies.map(b => [
    b.position.x, b.position.y, b.position.z,
    b.velocity.x, b.velocity.y, b.velocity.z,
  ]);

  // k1: forces at t
  const f1 = computeForces(bodies);
  const k1: State[] = bodies.map((b, i) => {
    const f = f1.get(b)!;
    return derivative(states[i], f.x, f.y, f.z, b.mass);
  });

  // k2: move bodies to t + dt/2, recompute
  for (let i = 0; i < n; i++) {
    const s = addStates(states[i], k1[i], dt / 2);
    bodies[i].position.set(s[0], s[1], s[2]);
    bodies[i].velocity.set(s[3], s[4], s[5]);
  }
  const f2 = computeForces(bodies);
  const k2: State[] = bodies.map((b, i) => {
    const f = f2.get(b)!;
    return derivative(addStates(states[i], k1[i], dt / 2), f.x, f.y, f.z, b.mass);
  });

  // k3: move bodies to t + dt/2 using k2
  for (let i = 0; i < n; i++) {
    const s = addStates(states[i], k2[i], dt / 2);
    bodies[i].position.set(s[0], s[1], s[2]);
    bodies[i].velocity.set(s[3], s[4], s[5]);
  }
  const f3 = computeForces(bodies);
  const k3: State[] = bodies.map((b, i) => {
    const f = f3.get(b)!;
    return derivative(addStates(states[i], k2[i], dt / 2), f.x, f.y, f.z, b.mass);
  });

  // k4: move bodies to t + dt using k3
  for (let i = 0; i < n; i++) {
    const s = addStates(states[i], k3[i], dt);
    bodies[i].position.set(s[0], s[1], s[2]);
    bodies[i].velocity.set(s[3], s[4], s[5]);
  }
  const f4 = computeForces(bodies);
  const k4: State[] = bodies.map((b, i) => {
    const f = f4.get(b)!;
    return derivative(addStates(states[i], k3[i], dt), f.x, f.y, f.z, b.mass);
  });

  // Combine: final state = s0 + dt/6 * (k1 + 2k2 + 2k3 + k4)
  for (let i = 0; i < n; i++) {
    const s0 = states[i];
    const nx = s0[0] + (dt / 6) * (k1[i][0] + 2 * k2[i][0] + 2 * k3[i][0] + k4[i][0]);
    const ny = s0[1] + (dt / 6) * (k1[i][1] + 2 * k2[i][1] + 2 * k3[i][1] + k4[i][1]);
    const nz = s0[2] + (dt / 6) * (k1[i][2] + 2 * k2[i][2] + 2 * k3[i][2] + k4[i][2]);
    const nvx = s0[3] + (dt / 6) * (k1[i][3] + 2 * k2[i][3] + 2 * k3[i][3] + k4[i][3]);
    const nvy = s0[4] + (dt / 6) * (k1[i][4] + 2 * k2[i][4] + 2 * k3[i][4] + k4[i][4]);
    const nvz = s0[5] + (dt / 6) * (k1[i][5] + 2 * k2[i][5] + 2 * k3[i][5] + k4[i][5]);
    bodies[i].position.set(nx, ny, nz);
    bodies[i].velocity.set(nvx, nvy, nvz);
  }
}
