# Project instructions

Read `context.md` before changing mathematical behavior, interaction, visual design, or lecture scope.

## Product contract

This repository implements a focused, client-only visualization of how a spherical viewing-direction domain is parameterized as an equirectangular projection (ERP). Keep the experience centered on one textured mesh, one morph parameter `t`, a subordinate two-level latitude/longitude grid, and a topologically duplicated longitude seam that is emphasized only during opening.

The intermediate interpolation is explanatory only. Never describe or visually frame intermediate surfaces as a standard map projection. The mathematically meaningful endpoints are the sphere at `t=0` and ERP at `t=1`.

Update `context.md` in the same change whenever the audience, equations, parameterization, seam strategy, interaction, visual language, or milestone scope changes.

## Stack and commands

- Use React, strict TypeScript, Vite/vinext, and direct Three.js APIs.
- Use npm only; preserve `package-lock.json` and do not introduce another package manager.
- Keep `npm run dev`, `npm run lint`, `npm run test`, and `npm run build` working.
- Avoid `any`, non-null assertions, hidden mutation, and duplicate rendering architectures.

## Architecture

- Keep spherical sampling, ERP coordinates, seam duplication, interpolation, and grid construction in renderer-independent utilities where practical.
- Treat `t in [0,1]` as the only canonical mathematical state. Derive mesh positions, camera/control behavior, labels, and endpoint emphasis from it.
- Preserve a one-to-one association between every sampled `(lambda, phi)`, its texture coordinate, its spherical endpoint, and its ERP endpoint.
- Keep observer-camera navigation separate from mathematical state. Orbiting must never alter `t`.
- Return explicit invalid states and never send non-finite values or stale geometry to Three.js or the DOM.

## Mathematics

- Sample longitude `lambda in [-pi, pi]` and latitude `phi in [-pi/2, pi/2]`.
- At `t=0`, use `(cos(phi) sin(lambda), sin(phi), cos(phi) cos(lambda))`.
- At `t=1`, store `(lambda/pi, 2 phi/pi, 0)`, then apply a presentation-only horizontal scale of 2 so the displayed rectangle is exactly 2:1.
- Interpolate component-wise with `p(t) = (1-t) p_sphere + t p_ERP`.
- Duplicate seam vertices at `lambda=-pi` and `lambda=pi`; no triangle may cross the texture discontinuity.
- Use texture coordinates `u=(lambda+pi)/(2pi)` and `v=(phi+pi/2)/pi`, with image orientation handled explicitly at load time.
- Use enough tessellation for a smooth lecture-scale morph and make pole stretching legible through the coordinate grid.

## Interaction and accessibility

- Provide a labeled range input for `t`, Play/Pause, and Reset.
- Playback begins with a short world-x rotation of the sphere/grid while any manually orbited camera eases to the canonical front axis and `t=0`, pauses briefly, then unfolds once from sphere to ERP and stops. Reset hides the grid, and user scrubbing updates the scene immediately.
- Orbiting uses gentle inertial decay while mostly spherical and fades to disabled as the surface flattens.
- Respect reduced motion, visible keyboard focus, touch targets, narrow layouts, and WebGL fallback content.
- Announce the current morph value and conceptual state to assistive technology.

## Visual direction

- Use a clean, solid-black Apple-style educational canvas matching the Partial Derivatives Visualization, with restrained near-white typography and minimal chrome.
- Make the environment texture primary and the latitude/longitude grid clear but subordinate; reveal the duplicated seam only as an understated aid to the opening motion.
- Keep coordinate-axis annotations, endpoint titles, state pills, legends, and side panels out of the visible canvas.
- Do not show the vertex interpolation equation or orbit instructions on the canvas.
- Avoid scenery, heavy shadows, decorative effects, dense dashboards, and unrelated controls.

## Verification

- Unit-test endpoint equations, interpolation, texture coordinates, seam duplication, and finite geometry.
- Test slider, one-way playback completion, reset, reduced motion, orbit gating, WebGL fallback, and narrow layouts when those behaviors change.
- Before handoff, run lint, tests, a production build, and browser checks at desktop and phone widths.
