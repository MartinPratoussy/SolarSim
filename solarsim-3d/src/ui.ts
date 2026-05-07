import { Body } from './Body';
import { AU } from './constants';
import { EventBus } from './events';

// ── Info panel elements ──────────────────────────────────────────────────
const panel = document.getElementById('info-panel')!;
const infoName = document.getElementById('info-name')!;
const infoMass = document.getElementById('info-mass')!;
const infoSpeed = document.getElementById('info-speed')!;
const infoDist = document.getElementById('info-dist')!;
const infoPeriod = document.getElementById('info-period')!;
const infoEdu = document.getElementById('info-edu')!;
const infoFormula = document.getElementById('info-formula')!;
const formulaToggle = document.getElementById('formula-toggle')!;

// ── Popup elements ────────────────────────────────────────────────────────
const popup = document.getElementById('event-popup')!;
const popupTitle = document.getElementById('popup-title')!;
const popupBody = document.getElementById('popup-body')!;
const popupFormula = document.getElementById('popup-formula')!;
const popupClose = document.getElementById('popup-close')!;

// ── Tooltip ───────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip')!;

let formulaVisible = false;
let popupTimer: ReturnType<typeof setTimeout> | null = null;

formulaToggle.addEventListener('click', () => {
  formulaVisible = !formulaVisible;
  infoFormula.style.display = formulaVisible ? 'block' : 'none';
  formulaToggle.textContent = formulaVisible ? 'Hide formula' : 'Show formula';
});

popupClose.addEventListener('click', () => {
  popup.style.display = 'none';
  if (popupTimer) clearTimeout(popupTimer);
});

// ─────────────────────────────────────────────────────────────────────────
// Info for each body type
// ─────────────────────────────────────────────────────────────────────────
interface BodyEduInfo {
  edu: string;
  formula: string;
}

function getEduInfo(body: Body): BodyEduInfo {
  switch (body.type) {
    case 'star':
      return {
        edu: 'Stars are massive balls of plasma held together by gravity. Their enormous mass creates gravitational forces that keep planets in orbit around them.',
        formula: 'F = G·M·m / r²',
      };
    case 'planet':
      return {
        edu: `Planets follow elliptical orbits described by Kepler's First Law. The closer a planet is to its star, the faster it moves (Kepler's Second Law). Its orbital period scales with distance: T² ∝ a³.`,
        formula: 'T² = (4π²/GM) · a³',
      };
    case 'moon':
      return {
        edu: 'Moons are natural satellites held in orbit by a planet\'s gravity. The same laws that govern planetary orbits apply — moons follow Kepler\'s laws too.',
        formula: 'v = √(G·M / r)',
      };
    case 'asteroid':
      return {
        edu: 'Asteroids are rocky remnants from the early solar system. Most orbit in the asteroid belt between Mars and Jupiter, shaped by Jupiter\'s strong gravity.',
        formula: 'F = G·M·m / r²',
      };
    case 'comet':
      return {
        edu: 'Comets follow highly elliptical orbits. When close to the Sun, solar wind and radiation blow gas and dust away from the nucleus, forming the iconic tail.',
        formula: 'v_perihelion = √(G·M·(1+e)/(a(1-e)))',
      };
    case 'blackhole':
      return {
        edu: 'A black hole is a region of spacetime where gravity is so strong that nothing — not even light — can escape past the event horizon. Its radius is the Schwarzschild radius.',
        formula: 'r_s = 2GM / c²',
      };
    default:
      return { edu: 'A small fragment ejected during a collision.', formula: '' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Update the info panel for a selected body
// ─────────────────────────────────────────────────────────────────────────
export function updateInfoPanel(body: Body | null, centralMass: number) {
  if (!body) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';

  const speedMS = body.velocity.length(); // m/s
  const distM = body.position.length();   // meters
  const distAU = distM / AU;

  infoName.textContent = body.name;
  infoMass.textContent = `${body.mass.toExponential(2)} kg`;
  infoSpeed.textContent = `${(speedMS / 1000).toFixed(1)} km/s`;
  infoDist.textContent = distAU < 0.1
    ? `${(distM / 1000).toExponential(2)} km`
    : `${distAU.toFixed(3)} AU`;

  if (centralMass > 0 && body.type !== 'star' && body.type !== 'blackhole') {
    const T = body.orbitalPeriod(centralMass);
    const days = T / 86400;
    infoPeriod.textContent = days < 365
      ? `${days.toFixed(1)} days`
      : `${(days / 365.25).toFixed(2)} years`;
  } else {
    infoPeriod.textContent = '—';
  }

  const { edu, formula } = getEduInfo(body);
  infoEdu.textContent = edu;
  infoFormula.textContent = formula;
  infoFormula.style.display = formulaVisible ? 'block' : 'none';
  formulaToggle.style.display = formula ? 'inline' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────
// Event-triggered popups
// ─────────────────────────────────────────────────────────────────────────
interface PopupContent { title: string; body: string; formula?: string; }

function showPopup(content: PopupContent, duration = 8000) {
  popupTitle.textContent = content.title;
  popupBody.textContent = content.body;
  popupFormula.textContent = content.formula ?? '';
  popupFormula.style.display = content.formula ? 'block' : 'none';
  popup.style.display = 'block';
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => { popup.style.display = 'none'; }, duration);
}

EventBus.on('edu:collision', () => {
  showPopup({
    title: '💥 Collision! Conservation of Momentum',
    body: 'When two bodies collide and merge, momentum is conserved. The resulting body has the combined mass and a velocity that balances the momenta of both objects.',
    formula: 'p_total = m₁v₁ + m₂v₂  →  v_merge = p_total / (m₁+m₂)',
  });
});

EventBus.on('edu:ejected', () => {
  showPopup({
    title: '🚀 Body Ejected — Escape Velocity',
    body: 'This body gained enough speed to escape the system. Escape velocity is the minimum speed needed to break free from a gravitational field.',
    formula: 'v_escape = √(2GM / r)',
  });
});

EventBus.on('edu:blackhole', () => {
  showPopup({
    title: '⚫ Black Hole Detected',
    body: 'A black hole warps spacetime so severely that nothing — not even light — can escape from within its event horizon, whose radius is called the Schwarzschild radius.',
    formula: 'r_s = 2GM / c²',
  }, 12000);
});

// ─────────────────────────────────────────────────────────────────────────
// Tooltip on hover
// ─────────────────────────────────────────────────────────────────────────
export function showTooltip(body: Body, x: number, y: number) {
  const speedKms = (body.velocity.length() / 1000).toFixed(1);
  tooltip.innerHTML = `<b>${body.name}</b><br>${body.mass.toExponential(2)} kg &nbsp;·&nbsp; ${speedKms} km/s`;
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 14}px`;
  tooltip.style.top  = `${y - 10}px`;
}

export function hideTooltip() {
  tooltip.style.display = 'none';
}
