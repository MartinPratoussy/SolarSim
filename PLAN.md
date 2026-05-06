# SolarSim 3D — Project Plan

## Vision

An **interactive, educational 3D solar system sandbox** for students and the general public. Users explore real gravitational physics by placing bodies (planets, moons, suns, comets, black holes) and watching what happens — while the UI explains the physics in plain language as events unfold. Fun, destructive, and scientifically grounded.

## Problem & Approach

Rebuild the existing 2D pygame simulator as a full 3D, physics-accurate solar system simulator in the browser using **Three.js** (WebGL). The physics layer is owned entirely by JavaScript, making it straightforward to evolve from Newtonian → Post-Newtonian → General Relativistic without touching the renderer.

**Target audience:** Students / general public — accessible, fun, no prior physics knowledge needed.

**Deployment:** Web app (browser), shareable URL per sandbox state.

**Tech stack:**
- **Three.js** (vanilla) — 3D WebGL renderer
- **Vite** — dev server & bundler
- **TypeScript** — simulation logic
- **lil-gui** — lightweight controls panel
- **NASA/public-domain textures** — planet surfaces

**Physics roadmap:**
1. RK4 N-body Newtonian gravity
2. Post-Newtonian 1PN corrections (Mercury precession)
3. Full GR geodesics (later)
4. Ephemeris-matched positions from NASA Horizons (later)

---

## Phases & Todos

### Phase 1 — Project scaffold & 3D foundation
- [ ] Initialize Vite + TypeScript + Three.js project structure
- [ ] Create 3D scene: renderer, camera, lighting (point light at Sun + ambient)
- [ ] OrbitControls for pan/zoom/rotate camera
- [ ] Background starfield (icosphere or cube-mapped)

### Phase 2 — Newtonian N-body physics
- [ ] Implement RK4 integrator (replace current Euler)
- [ ] Body class: position (Vec3), velocity (Vec3), mass, radius, type
- [ ] Load real solar system data: Sun + 8 planets (masses, semi-major axes, eccentricities, inclinations)
- [ ] Compute initial orbital velocities from Kepler's 3rd law
- [ ] Orbit trail renderer (BufferGeometry line with rolling buffer)
- [ ] Collision detection & merging (carry over from current sim)

### Phase 3 — Visuals & polish
- [ ] Planet textures (NASA public domain PNGs mapped to spheres)
- [ ] Sun glow / corona effect (Sprite or custom shader)
- [ ] Atmospheric halo for Earth/gas giants (additive blending shader)
- [ ] Scale toggle: "artistic scale" (visible) vs "true scale" (correct proportions)
- [ ] Axial tilt per planet

### Phase 4 — Interactivity & Sandbox UX
- [ ] Time controls: pause, 1×, 10×, 100×, 1000× (days/sec)
- [ ] Click-to-select body → info panel (name, mass, velocity, distance from Sun)
- [ ] Follow-camera mode: lock view onto selected body
- [ ] **Sandbox toolbar**: buttons to place Planet / Moon / Sun / Comet / Asteroid / Black Hole
- [ ] Body placement: click in 3D space, auto-compute stable orbit or custom velocity
- [ ] Delete / remove body
- [ ] Body labels (sprites with names, toggle on/off)

### Phase 5 — Black Holes
- [ ] Black hole body type: Schwarzschild radius, accretion disk mesh, event horizon sphere
- [ ] Gravitational lensing post-process shader (screen-space distortion near black hole)
- [ ] Spaghettification: bodies crossing event horizon stretch and disappear
- [ ] Hawking radiation label (educational note, not physically simulated)
- [ ] Black hole merger: two black holes merge, mass combined, gravitational wave ring effect

### Phase 6 — Educational System
- [ ] Persistent side panel: physics explainer that updates based on selected body/event
  - Orbit selected → explains Kepler's laws, orbital period formula
  - Gravity selected → explains inverse-square law
  - Collision → explains conservation of momentum
  - Black hole selected → explains escape velocity, event horizon, time dilation
- [ ] Event-triggered popups: contextual cards that appear when notable events happen
  - First collision → popup explaining collision & momentum
  - Black hole placed → popup: "What is a black hole?"
  - Body ejected from system → popup: escape velocity explainer
  - Bodies close together → popup: tidal forces
- [ ] "Physics formula" toggle in panel: show/hide the equation behind the explanation
- [ ] Tooltip layer: hover over any body → mini tooltip (name, mass, speed)

### Phase 7 — Save & Share
- [ ] Serialize full system state (bodies, velocities, masses) to JSON
- [ ] Encode as base64 URL parameter (`?sim=...`)
- [ ] "Share" button → copy URL to clipboard
- [ ] "Load" on page open: parse URL param and restore state
- [ ] Preset gallery: a few named presets (Solar System, Rogue Black Hole, Binary Stars, etc.)

### Phase 8 — Moons & Minor Bodies
- [ ] Major moons: Earth's Moon, Galilean moons, Titan, Triton
- [ ] Asteroid belt: ~1000 instanced meshes with randomised orbital elements
- [ ] Comets: elongated orbit + procedural tail shader (direction away from Sun)

### Phase 9 — Relativistic physics
- [ ] Post-Newtonian 1PN correction term in force calculation
- [ ] Mercury perihelion precession visualization
- [ ] Toggle: Newtonian / Post-Newtonian / (future) full GR
- [ ] Gravitational time dilation display per body

### Phase 10 — Ephemeris (future)
- [ ] NASA Horizons API integration or pre-baked data files
- [ ] Date/time picker to set real sky positions

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Renderer | Three.js (vanilla) | Full control, no extra abstraction |
| Bundler | Vite + TypeScript | Fast HMR, type safety for physics code |
| Physics units | SI (meters, kg, seconds) | Match G = 6.674e-11 directly |
| Integration | RK4 | Far more stable than Euler for elliptical orbits |
| Distance scale | 1 AU = configurable pixel units | Artistic scale by default |
| Relativity | Pluggable force module | Swap Newtonian → 1PN without refactor |
| Black holes | Schwarzschild metric + visual tricks | Scientifically grounded, visually dramatic |
| Education | Event-triggered + persistent panel | Both discovery-driven and always-available |
| Save/share | JSON → base64 → URL param | No backend needed, instantly shareable |
