# Sphere to Equirectangular Projection

## Purpose

This fourth-year computer vision lecture visualization explains that an equirectangular image is a two-dimensional parameterization of spherical viewing directions. A single 360-degree warehouse environment remains attached to a dense sampled `(lambda, phi)` domain while the geometry moves continuously from a unit sphere to a flat 2:1 rectangle.

The morph is a teaching device, not an additional map projection. Only the sphere and ERP endpoints carry standard mathematical meaning.

## First experience

The page opens with the title “Sphere to Equirectangular Projection” and the upright subtitle “Same world. Different coordinates.” above a large textured sphere on the same solid black field used by the Partial Derivatives Visualization. Sparse two-level latitude and longitude curves reveal the spherical coordinate cells. The duplicated longitude seam is revealed as playback begins so its opening helps explain the unwrap. The stage omits endpoint titles, explanatory cards, and a visible numeric `t`; a minimal fading control strip contains only Play/Pause, the morph scrubber, and Reset.

The initial viewpoint is exactly front-on: the camera sits on the positive z axis, looks toward the origin, and its optical axis is perpendicular to the screen. Dragging orbits only while the shape remains mostly spherical. Playback first rotates the sphere and grid about the world x axis while any manual observer orbit eases back to the canonical front axis, pauses briefly, and then carries `t` once from 0 to 1 with a calm explanatory unfold.

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

Texture coordinates stay fixed at `u=(lambda+pi)/(2pi)` and `v=(phi+pi/2)/pi`, with image orientation handled explicitly at texture upload. The left and right seam columns are separate vertices with `u=0` and `u=1`, respectively, so no face spans the longitude discontinuity. The specified normalized ERP coordinates each span `[-1,1]`; after vertex interpolation, a presentation-only horizontal scale of 2 restores the conventional 2:1 image aspect without changing the stored endpoint coordinates.

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
- The playback-intro x-axis model rotation is presentation state only and never changes `t` or the sampled spherical coordinates.

## Interaction

- Drag the slider or use its keyboard controls to set `t` precisely.
- Press Play at the spherical endpoint to begin with a deterministic 0.9-second canonicalization: the sphere and grid complete the same world-x rotation every time while the observer camera eases from any manually orbited pose back to zero azimuth and elevation along the shortest azimuth path. Thus the pre-unfold frame is identical whether playback starts from the default view or an arbitrary orbit. A 0.28-second hold makes that pose legible before a three-second geometric unfold finishes at ERP and pauses. All authored animation phases use quintic ease-in/ease-out timing, including canonicalization, unfolding, Reset, grid and seam opacity, metallic fade, framing, and camera gating, so no element starts or stops abruptly. Direct slider morphing also reveals the grid and seam progressively, so the construction never depends on playback.
- Drag the visualization to orbit with gentle inertial momentum while the representation is mostly spherical. Rotation sensitivity and momentum diminish during flattening and are fully disabled near ERP.
- Reset pauses playback, then uses a short ease-in/ease-out return that synchronizes the morph parameter, observer camera, and presentation tilt with the original spherical endpoint and camera pose while the coordinate grid dissolves away. Reduced-motion users receive the same reset state immediately.
- Coordinate-axis annotations, endpoint titles, and state pills stay hidden; the transforming grid supplies the coordinate correspondence visually.

## Visual direction

Use a spacious continuous solid-black composition with no border or rounded box around the visualization, matching the dark visual field of the Partial Derivatives Visualization. Near-white text and cool blue structural lines remain restrained. The supplied burnt-warehouse panorama supplies visual complexity and makes content continuity across the morph immediately apparent. A restrained cool silhouette sheen and tonal contrast give the resting sphere a metallic character without placing visible lighting hotspots across the panorama. This presentation treatment dissolves as soon as playback starts and also fades during direct slider morphing, so the moving surface and ERP endpoint remain unlit. Thin grid curves use a consistent 0.6% radial surface offset at the sphere endpoint and a small positive z offset at ERP, preventing depth-fighting gaps while preserving correct rear-hemisphere occlusion. The `phi=0` equator and `lambda=0` central meridian share one restrained highlight level, forming a stable reference cross that remains subordinate to the temporary seam emphasis. Near the ERP poles, longitude cells expand to the full width, making horizontal stretching obvious.

The interface uses a presentation-like 16:9 composition and one minimal single-row control strip with no surrounding card. The controls recede when idle. Geometry placement is morph- and aspect-aware: the sphere is roughly 15% larger than the earlier build and visually centered, while the wide ERP uses available vertical slack to shift upward and retain a guaranteed top margin. Portrait layouts size the stage from viewport width rather than stretching it to viewport height. The Sphere and ERP scrubber endpoints sit below the thumb with clear vertical separation and use slightly elevated size and contrast for lecture-hall readability. Keep coordinate-axis annotations, the interpolation equation, and orbit instructions out of the visible canvas so the texture, seam, and grid remain primary.

Resize observations only record the latest rounded viewport dimensions; the renderer applies a changed backing-store size once at the start of the next animation frame. This keeps live window resizing synchronized with drawing and avoids transient blank frames.

## Acceptance criteria

- The sphere and flat ERP endpoints match the stated equations.
- The same panorama content visibly travels with the mesh through the morph.
- The temporarily emphasized seam opens cleanly; no triangles stretch across `-pi/pi`.
- The ERP rectangle is visibly 2:1 and coordinate cells near both poles show strong horizontal stretching.
- Slider, one-way playback, pause, reset, orbit gating, responsive layout, reduced motion, and fallback behavior are understandable.
- The page explicitly states that intermediate shapes are explanatory interpolation only.
- Lint, tests, production build, and desktop/mobile browser checks pass.

## Deferred

Do not add alternate projections, cubemaps, panorama uploads, editable equations, saved state, guided quizzes, accounts, networking, or a server in this version.
