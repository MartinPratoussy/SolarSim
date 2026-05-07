# SolarSim

An interactive, educational physics sandbox — from the smallest quarks to a full solar system.

## Apps

| App | Path | Description |
|---|---|---|
| **Universe Journey** | `apps/universe-journey/` | Scale journey from quarks → nuclear → atomic → stellar ignition (6 interactive simulations) |
| **Solar System** | `apps/solar-system/` | 3D N-body gravitational sandbox — place stars, planets, black holes, watch chaos unfold |

## Getting started

```bash
# Universe Journey
cd apps/universe-journey
npm install
npm run dev      # → http://localhost:5173

# Solar System
cd apps/solar-system
npm install
npm run dev      # → http://localhost:5173
```

## Tech stack

Both apps share the same stack: **Vite + TypeScript + Three.js**

- Real physics equations (Cornell potential, Yukawa, RK4 N-body, Jeans instability…)
- Educational panels with live event logs and physics formulas
- No backend — runs entirely in the browser


Install with:

```bash
pip install pygame pygame_gui
```

## ▶️ How to run
```bash
python main.py
```

