# Sphere to Equirectangular Projection

## Purpose

This fourth-year computer vision lecture visualization explains that an equirectangular image is a two-dimensional parameterization of spherical viewing directions. A single 360-degree warehouse environment remains attached to a dense sampled `(lambda, phi)` domain while the geometry moves continuously from a unit sphere to a flat 2:1 rectangle.

The morph is a teaching device, not an additional map projection. Only the sphere and ERP endpoints carry standard mathematical meaning.

## First experience

The page opens on a large textured sphere against the same solid black field used by the Partial Derivatives Visualization. Fine latitude and longitude curves reveal the spherical coordinate cells; a contrasting warm seam marks the duplicated boundaries at `lambda=-pi` and `lambda=pi`. A compact title and short endpoint-aware explanation sit above the visualization. The lower control rail contains the morph slider, Play/Pause, and Reset.

The initial viewpoint is slightly elevated and off-axis so the spherical volume, grid curvature, and seam are all visible. Dragging orbits only while the shape remains mostly spherical. Playback carries `t` from 0 to 1 and back with a smooth explanatory tempo.

## Mathematical behavior

For longitude `lambda in [-pi, pi]` and latitude `phi in [-pi/2, pi/2]`, the spherical endpoint is

```text
x = cos(phi) sin(lambda)
y = sin(phi)
z = cos(phi) cos(lambda)
```

and the ERP endpoint is

```text
x_ERP = lambda / pi
y_ERP = 2 phi / pi
z_ERP = 0.
```

Every vertex interpolates with

```text
p(t) = (1-t) p_sphere + t p_ERP,  t in [0,1].
```

Texture coordinates stay fixed at `u=(lambda+pi)/(2pi)` and `v=(phi+pi/2)/pi`. The left and right seam columns are separate vertices with `u=0` and `u=1`, respectively, so no face spans the longitude discontinuity. The specified normalized ERP coordinates each span `[-1,1]`; after vertex interpolation, a presentation-only horizontal scale of 2 restores the conventional 2:1 image aspect without changing the stored endpoint coordinates.

## State and invariants

The only canonical mathematical state is:

```ts
type ProjectionState = { t: number };
```

Playback direction and playing status are interaction state rather than mathematical state. For every valid `t`:

- Each vertex retains its original `(lambda, phi)` and UV coordinates.
- Geometry is the component-wise interpolation of its two endpoints.
- A presentation transform changes only the horizontal display aspect from 1 at the sphere to 2 at ERP.
- The two seam columns remain topologically disconnected.
- No generated position is non-finite.
- Camera interaction changes presentation only.

## Interaction

- Drag the slider or use its keyboard controls to set `t` precisely.
- Press Play to animate toward ERP, then back toward the sphere in a continuous ping-pong loop; Pause freezes the current value.
- Drag the visualization to orbit while the representation is mostly spherical. Rotation sensitivity diminishes during flattening and is fully disabled near ERP.
- Reset returns to the initial spherical endpoint, camera pose, and paused state.
- Labels transition from “Spherical environment map” to “Equirectangular projection (ERP)” while longitude, latitude, and seam annotations remain tied to the construction.

## Visual direction

Use a spacious solid-black composition with near-white text, cool blue structural lines, and a restrained coral seam accent, matching the dark visual field of the Partial Derivatives Visualization. The supplied burnt-warehouse panorama supplies visual complexity and makes content continuity across the morph immediately apparent. Thin grid lines sit just above the mesh and use modest opacity. Near the ERP poles, longitude cells expand to the full width, making horizontal stretching obvious.

The interface uses one compact floating control rail rather than panels or dashboards. Labels should feel like lecture annotations: precise, quiet, and positioned near the relevant geometry.

## Acceptance criteria

- The sphere and flat ERP endpoints match the stated equations.
- The same panorama content visibly travels with the mesh through the morph.
- The seam opens cleanly; no triangles stretch across `-pi/pi`.
- The ERP rectangle is visibly 2:1 and coordinate cells near both poles show strong horizontal stretching.
- Slider, ping-pong playback, pause, reset, orbit gating, responsive layout, reduced motion, and fallback behavior are understandable.
- The page explicitly states that intermediate shapes are explanatory interpolation only.
- Lint, tests, production build, and desktop/mobile browser checks pass.

## Deferred

Do not add alternate projections, cubemaps, panorama uploads, editable equations, saved state, guided quizzes, accounts, networking, or a server in this version.
