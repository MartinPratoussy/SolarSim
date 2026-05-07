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

/** Extra encyclopedic data shown in the info panel. Optional — user-placed bodies won't have it. */
export interface BodyDetails {
  gravity: number;      // m/s² surface gravity
  tempC: string;        // surface/cloud temp description
  moons: number;
  funFact: string;
  wikiUrl: string;
}

export const BODY_DETAILS: Record<string, BodyDetails> = {
  Sun: {
    gravity: 274,
    tempC: '5,778 K (surface)',
    moons: 8,
    funFact: 'The Sun contains 99.86% of the total mass of the Solar System. Its core reaches 15 million °C where hydrogen fuses into helium.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Sun',
  },
  Mercury: {
    gravity: 3.7,
    tempC: '−180 °C to +430 °C',
    moons: 0,
    funFact: 'A day on Mercury (sunrise to sunrise) is longer than its year. Its enormous temperature swings are due to virtually no atmosphere.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Mercury_(planet)',
  },
  Venus: {
    gravity: 8.87,
    tempC: '+465 °C (avg)',
    moons: 0,
    funFact: 'Venus rotates backwards relative to most planets and is the hottest planet — its thick CO₂ atmosphere traps heat via a runaway greenhouse effect.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Venus',
  },
  Earth: {
    gravity: 9.81,
    tempC: '+15 °C (avg)',
    moons: 1,
    funFact: 'Earth is the densest planet and the only one known to harbor life. Its large Moon stabilises the axial tilt that keeps our climate stable.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Earth',
  },
  Mars: {
    gravity: 3.72,
    tempC: '−65 °C (avg)',
    moons: 2,
    funFact: 'Olympus Mons on Mars is the tallest volcano in the Solar System at 21.9 km — nearly 3× the height of Everest.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Mars',
  },
  Jupiter: {
    gravity: 24.79,
    tempC: '−110 °C (cloud top)',
    moons: 95,
    funFact: 'Jupiter\'s Great Red Spot is an anticyclonic storm that has raged for over 350 years. Jupiter acts as a gravitational shield, deflecting many comets.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Jupiter',
  },
  Saturn: {
    gravity: 10.44,
    tempC: '−140 °C (cloud top)',
    moons: 146,
    funFact: 'Saturn\'s rings are mostly water-ice and rock, only 10–100 m thick but spanning 282,000 km. Saturn is the least dense planet — it would float on water.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Saturn',
  },
  Uranus: {
    gravity: 8.69,
    tempC: '−195 °C (avg)',
    moons: 27,
    funFact: 'Uranus orbits on its side with an axial tilt of 98°, likely caused by a massive ancient collision. It emits almost no internal heat.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Uranus',
  },
  Neptune: {
    gravity: 11.15,
    tempC: '−200 °C (avg)',
    moons: 16,
    funFact: 'Neptune has the fastest winds in the Solar System — up to 2,100 km/h. It was the first planet predicted mathematically before it was observed.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Neptune',
  },
};

/** Generic Wikipedia links for user-placed body types */
export const TYPE_WIKI: Record<string, string> = {
  star:      'https://en.wikipedia.org/wiki/Star',
  planet:    'https://en.wikipedia.org/wiki/Planet',
  moon:      'https://en.wikipedia.org/wiki/Natural_satellite',
  asteroid:  'https://en.wikipedia.org/wiki/Asteroid',
  comet:     'https://en.wikipedia.org/wiki/Comet',
  blackhole: 'https://en.wikipedia.org/wiki/Black_hole',
  debris:    'https://en.wikipedia.org/wiki/Accretion_(astrophysics)',
};

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
