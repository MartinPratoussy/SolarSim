import * as THREE from 'three';
import { AU } from './constants';

/** Real solar system data. Distances in meters, masses in kg, radii in meters. */
export interface PlanetData {
  name: string;
  mass: number;
  realRadius: number;
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;     // radians
  color: number;
  drawRadius: number;
  texture: string;
  axialTilt: number;       // radians
  atmosphere?: THREE.Color;
  hasRing?: boolean;
}

export const SOLAR_DATA = {
  sun: {
    name: 'Sun',
    mass: 1.989e30,
    realRadius: 6.957e8,
    color: 0xFFF5C0,
    drawRadius: 5,
    texture: 'sun.jpg',
  },

  planets: [
    {
      name: 'Mercury',
      mass: 3.301e23,
      realRadius: 2.44e6,
      semiMajorAxis: 0.387 * AU,
      eccentricity: 0.206,
      inclination: 0.122,
      color: 0xb5b5b5,
      drawRadius: 0.5,
      texture: 'mercury.jpg',
      axialTilt: 0.001,
    },
    {
      name: 'Venus',
      mass: 4.867e24,
      realRadius: 6.051e6,
      semiMajorAxis: 0.723 * AU,
      eccentricity: 0.007,
      inclination: 0.059,
      color: 0xe8cda0,
      drawRadius: 0.9,
      texture: 'venus.jpg',
      axialTilt: 3.096,
      atmosphere: new THREE.Color(0xffcc66),
    },
    {
      name: 'Earth',
      mass: 5.972e24,
      realRadius: 6.371e6,
      semiMajorAxis: 1.0 * AU,
      eccentricity: 0.017,
      inclination: 0.0,
      color: 0x4fa3e0,
      drawRadius: 1.0,
      texture: 'earth.jpg',
      axialTilt: 0.409,
      atmosphere: new THREE.Color(0x4488ff),
    },
    {
      name: 'Mars',
      mass: 6.39e23,
      realRadius: 3.39e6,
      semiMajorAxis: 1.524 * AU,
      eccentricity: 0.093,
      inclination: 0.032,
      color: 0xc1440e,
      drawRadius: 0.7,
      texture: 'mars.jpg',
      axialTilt: 0.440,
      atmosphere: new THREE.Color(0xff8855),
    },
    {
      name: 'Jupiter',
      mass: 1.898e27,
      realRadius: 7.149e7,
      semiMajorAxis: 5.203 * AU,
      eccentricity: 0.049,
      inclination: 0.023,
      color: 0xc88b3a,
      drawRadius: 3.5,
      texture: 'jupiter.jpg',
      axialTilt: 0.054,
      atmosphere: new THREE.Color(0xcc9966),
    },
    {
      name: 'Saturn',
      mass: 5.683e26,
      realRadius: 6.026e7,
      semiMajorAxis: 9.537 * AU,
      eccentricity: 0.057,
      inclination: 0.043,
      color: 0xe4d191,
      drawRadius: 2.8,
      texture: 'saturn.jpg',
      axialTilt: 0.466,
      hasRing: true,
    },
    {
      name: 'Uranus',
      mass: 8.681e25,
      realRadius: 2.536e7,
      semiMajorAxis: 19.19 * AU,
      eccentricity: 0.046,
      inclination: 0.013,
      color: 0x7de8e8,
      drawRadius: 1.8,
      texture: 'uranus.jpg',
      axialTilt: 1.706,
      atmosphere: new THREE.Color(0x55ddcc),
    },
    {
      name: 'Neptune',
      mass: 1.024e26,
      realRadius: 2.462e7,
      semiMajorAxis: 30.07 * AU,
      eccentricity: 0.010,
      inclination: 0.031,
      color: 0x3f54ba,
      drawRadius: 1.7,
      texture: 'neptune.jpg',
      axialTilt: 0.494,
      atmosphere: new THREE.Color(0x3355ff),
    },
  ] as PlanetData[],
};

/** Returns initial perihelion position in SI meters */
export function initialPosition(planet: PlanetData): THREE.Vector3 {
  const r = planet.semiMajorAxis * (1 - planet.eccentricity); // meters
  return new THREE.Vector3(r, r * Math.sin(planet.inclination), 0);
}
