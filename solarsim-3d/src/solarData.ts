import * as THREE from 'three';
import { AU } from './constants';
import { metersToScene } from './Body';

/** Real solar system data. Distances in meters, masses in kg, radii in meters. */
export interface PlanetData {
  name: string;
  mass: number;
  realRadius: number;
  semiMajorAxis: number;   // meters
  eccentricity: number;
  inclination: number;     // radians
  color: number;
  drawRadius: number;      // artistic scene units
}

export const SOLAR_DATA = {
  sun: {
    name: 'Sun',
    mass: 1.989e30,
    realRadius: 6.957e8,
    color: 0xFFF5C0,
    drawRadius: 5,
  },

  planets: [
    {
      name: 'Mercury',
      mass: 3.301e23,
      realRadius: 2.44e6,
      semiMajorAxis: 0.387 * AU,
      eccentricity: 0.206,
      inclination: 0.122, // rad
      color: 0xb5b5b5,
      drawRadius: 0.5,
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
    },
  ] as PlanetData[],
};

/** Build a THREE.Vector3 position at perihelion for a given planet */
export function initialPosition(planet: PlanetData): THREE.Vector3 {
  const r = planet.semiMajorAxis * (1 - planet.eccentricity);
  const sceneR = metersToScene(r);
  // Place in XZ plane, tilted by inclination
  return new THREE.Vector3(
    sceneR,
    sceneR * Math.sin(planet.inclination),
    0
  );
}
