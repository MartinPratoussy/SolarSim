---
title: 'Build universe-journey educational app'
type: 'feature'
created: '2026-05-07T00:00:00Z'
status: 'done'
context: []
baseline_commit: 'a757f67637e320d5b6bc5ef165444ba5e5550d9d'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** SolarSim lacks the guided origin-story experience that teaches how matter and stars emerge across physical scales before the solar-system sandbox begins. The project needs a new standalone Vite + TypeScript + Three.js app that presents six connected mini-simulations from quarks through stellar ignition and hands the player off to SolarSim.

**Approach:** Build a new `universe-journey` app with a shared event bus, HUD, educational panel, and scale manager, then implement six self-contained scale modules that each own their scene, camera, interactions, equations, and completion logic while maintaining a cohesive deep-space visual style.

## Boundaries & Constraints

**Always:** Create the app inside `universe-journey/` with the requested file structure; use Vite + TypeScript + Three.js; keep each scale self-contained behind the shared `IScale` interface; include the specified DOM overlays, educational copy, equations, toasts, and handoff to `solarsim-3d/index.html`; keep particle counts within the provided performance caps; install dependencies and verify with TypeScript and build commands.

**Ask First:** Any change outside the new app directory other than BMAD implementation artifacts; replacing the requested six-scale flow with a different narrative structure; adding new dependencies beyond the requested Vite/TypeScript/Three.js toolchain.

**Never:** Modify the existing `solarsim-3d` app; omit a scale, educational panel, or progress/toast/HUD behavior; leave placeholder simulations or broken transitions; use untyped event wiring that defeats strict TypeScript.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full journey | Player progresses or skips across scales 1-6 | The app updates the HUD, educational content, scene lifecycle, and action bar correctly for each scale, then offers a SolarSim launch handoff | Scale transitions fade cleanly and dispose prior listeners/meshes |
| Particle cap reached | Player repeatedly spawns quarks, nucleons, electrons, or atoms | The relevant scale refuses to exceed its cap while keeping the simulation responsive and educational UI intact | Ignore extra spawn requests and log or toast only if useful |
| Key milestone | A major event occurs such as proton/neutron formation, helium formation, gas collapse, or fusion ignition | The app appends an educational event entry and shows a toast describing the milestone | Milestone handlers must guard against duplicate completion events |
| Resize / revisit | The browser resizes or the player skips between scales | Active cameras and renderer sizing stay correct, overlays update, and disposed scales stop handling input | Dispose listeners, DOM overlays, and temporary meshes before the next scale starts |

</frozen-after-approval>

## Code Map

- `universe-journey/index.html` -- static shell containing the canvas, HUD, educational panel, action bar, toast, and progress bar containers.
- `universe-journey/styles/main.css` -- shared deep-space visual system for HUD, panel, toast, gauges, overlays, and transition polish.
- `universe-journey/src/main.ts` -- app bootstrap, renderer lifecycle, scale registration, animation loop, and resize handling.
- `universe-journey/src/EventBus.ts` -- typed event emitter shared by HUD, educational panel, progress UI, and scale milestones.
- `universe-journey/src/ScaleManager.ts` -- scale transitions, scene ownership handoff, completion sequencing, and fade overlay management.
- `universe-journey/src/HUD.ts` -- scale dot state, current label, skip button behavior, and progress visibility updates.
- `universe-journey/src/EduPanel.ts` -- educational text updates, event log appends, toast display, and progress bar syncing.
- `universe-journey/src/scales/Scale1Quarks.ts` -- quark spawning, confinement dynamics, hadron detection, gluon lines, and proton/neutron completion.
- `universe-journey/src/scales/Scale2Nuclear.ts` -- nucleon interactions with Yukawa-style forces, deuterium/helium formation, and binding-energy feedback.
- `universe-journey/src/scales/Scale3Atomic.ts` -- orbital visuals, electron capture, excitation/decay photons, and neutral atom completion.
- `universe-journey/src/scales/Scale4GasCloud.ts` -- gas cloud particle simulation, Jeans instability progress, gravity toggle, and collapse trigger.
- `universe-journey/src/scales/Scale5Stellar.ts` -- 3D stellar collapse, temperature/pressure gauges, ignition flash, and HR diagram widget.
- `universe-journey/src/scales/Scale6Handoff.ts` -- final star/debris animation, completion card, and SolarSim launch link.
- `universe-journey/package.json` / `tsconfig.json` / `vite.config.ts` -- requested toolchain and build configuration.

## Tasks & Acceptance

**Execution:**
- [x] `universe-journey/package.json`, `universe-journey/tsconfig.json`, `universe-journey/vite.config.ts`, `universe-journey/index.html` -- scaffold the new Vite app shell and required entrypoints -- establishes the standalone app.
- [x] `universe-journey/styles/main.css`, `universe-journey/src/HUD.ts`, `universe-journey/src/EduPanel.ts`, `universe-journey/src/EventBus.ts`, `universe-journey/src/ScaleManager.ts`, `universe-journey/src/main.ts` -- implement shared UI, typed events, transitions, and bootstrap logic -- provides a reusable framework for all scales.
- [x] `universe-journey/src/scales/Scale1Quarks.ts`, `Scale2Nuclear.ts`, `Scale3Atomic.ts`, `Scale4GasCloud.ts`, `Scale5Stellar.ts`, `Scale6Handoff.ts` -- implement six end-to-end simulations with the requested equations, interactions, milestones, and completion behavior -- delivers the educational experience.
- [x] `universe-journey/package-lock.json` -- install dependencies in the new app -- makes the project runnable.
- [x] `universe-journey` build outputs -- verify the app with TypeScript and production build commands -- confirms the delivered app is working.

**Acceptance Criteria:**
- Given the player loads `universe-journey/index.html`, when the app starts, then a Three.js scene, right-side educational panel, top HUD, bottom action bar, toast container, and scale transition flow are visible and styled in a cohesive dark space theme.
- Given the player interacts with each scale, when they spawn or manipulate matter, then the simulation demonstrates the intended qualitative physics, displays the requested equations and hints, and logs milestone events with matching toast notifications.
- Given the player completes or skips scales, when the scale changes, then the prior scene is disposed, the new scene initializes cleanly with the correct camera type and contextual controls, and the HUD dots/labels reflect progress.
- Given the player reaches the gas cloud and stellar stages, when Jeans collapse and fusion ignition occur, then the progress/gauge overlays respond in real time and the app transitions to the next stage without duplicate completion triggers.
- Given the player reaches the final stage, when the completion card appears, then it offers a working launch path to `solarsim-3d/index.html` while the final educational summary remains visible.

## Design Notes

Use orthographic cameras for scales 1-4 so the player reads them as diagrammatic 2D fields, then switch to perspective cameras in scales 5-6 to make stellar collapse and the planetary-disk handoff feel expansive. Keep the visual language consistent by combining soft neon emissive materials, subtle starfields, translucent panels, and DOM overlays that mirror the existing SolarSim aesthetic without altering the original app.

Favor lightweight qualitative physics over strict realism where necessary: pairwise softening, tuned constants, capped particle counts, and milestone detectors should create believable emergent behavior while staying smooth in the browser. Each scale should own its own scene graph, listeners, and DOM add-ons so disposal is reliable during skip/advance transitions.

## Verification

**Commands:**
- `cd /workspaces/SolarSim/universe-journey && npm install` -- expected: dependencies install successfully and `package-lock.json` is created.
- `cd /workspaces/SolarSim/universe-journey && npx tsc --noEmit` -- expected: strict TypeScript passes with zero errors.
- `cd /workspaces/SolarSim/universe-journey && npm run build` -- expected: Vite production build succeeds.

## Suggested Review Order

**App bootstrap & lifecycle**

- Start here to understand renderer setup, scale registration, and animation ownership.
  [`main.ts:19`](../../universe-journey/src/main.ts#L19)

- Follow scale transitions, fade handling, and completion auto-advance logic.
  [`ScaleManager.ts:13`](../../universe-journey/src/ScaleManager.ts#L13)

**Shared interface & UI shell**

- Review the persistent HUD, event log, toast, and overlay styling language.
  [`main.css:1`](../../universe-journey/styles/main.css#L1)

- Confirm typed event wiring into educational content and progress updates.
  [`EduPanel.ts:3`](../../universe-journey/src/EduPanel.ts#L3)

**Scale simulations**

- Inspect quark confinement, baryon detection, and milestone completion guards.
  [`Scale1Quarks.ts:41`](../../universe-journey/src/scales/Scale1Quarks.ts#L41)

- Inspect Jeans-instability progress, collapse trigger, and particle-cap handling.
  [`Scale4GasCloud.ts:8`](../../universe-journey/src/scales/Scale4GasCloud.ts#L8)

- Inspect stellar gauges, ignition threshold, and HR diagram overlay updates.
  [`Scale5Stellar.ts:8`](../../universe-journey/src/scales/Scale5Stellar.ts#L8)

- Finish with the final card, debris disk, and SolarSim handoff link.
  [`Scale6Handoff.ts:13`](../../universe-journey/src/scales/Scale6Handoff.ts#L13)
