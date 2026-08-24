"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildProjectionMesh,
  displayScaleX,
  erpPosition,
  sphericalPosition,
} from "./projection-math";

type MorphLine = {
  geometry: THREE.BufferGeometry;
  sphere: Float32Array;
  erp: Float32Array;
};

const PLAYBACK_SECONDS = 3;
const INTRO_ALIGN_SECONDS = 0.9;
const INTRO_HOLD_SECONDS = 0.28;
const GRID_FADE_SECONDS = 0.9;
const GLOSS_FADE_SECONDS = 0.65;
const RESET_SECONDS = 1.25;
const SPHERE_GLOSS_OPACITY = 0.2;
const GRID_SURFACE_RADIUS = 1.006;
const INITIAL_THETA = 0;
const INITIAL_PHI = 0;
const INTRO_X_ROTATION = 0.76;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smootherstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function makeLineData(samples: ReadonlyArray<readonly [number, number]>) {
  const sphere = new Float32Array(samples.length * 3);
  const erp = new Float32Array(samples.length * 3);

  samples.forEach(([lambda, phi], index) => {
    const spherical = sphericalPosition(lambda, phi);
    sphere.set(
      [
        spherical[0] * GRID_SURFACE_RADIUS,
        spherical[1] * GRID_SURFACE_RADIUS,
        spherical[2] * GRID_SURFACE_RADIUS,
      ],
      index * 3,
    );
    const flat = erpPosition(lambda, phi);
    erp.set([flat[0], flat[1], 0.012], index * 3);
  });

  return { sphere, erp };
}

function updateMorphLine(line: MorphLine, amount: number) {
  const attribute = line.geometry.getAttribute("position");
  if (!(attribute instanceof THREE.BufferAttribute)) return;

  for (let index = 0; index < attribute.count; index += 1) {
    const offset = index * 3;
    attribute.setXYZ(
      index,
      line.sphere[offset] + (line.erp[offset] - line.sphere[offset]) * amount,
      line.sphere[offset + 1] +
        (line.erp[offset + 1] - line.sphere[offset + 1]) * amount,
      line.sphere[offset + 2] +
        (line.erp[offset + 2] - line.sphere[offset + 2]) * amount,
    );
  }

  attribute.needsUpdate = true;
}

export function ProjectionExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const playingRef = useRef(false);
  const gridRevealRef = useRef(0);
  const glossVisibilityRef = useRef(1);
  const presentationTiltRef = useRef(0);
  const introOrbitRef = useRef({
    active: false,
    elapsed: 0,
    startTilt: 0,
    startTheta: INITIAL_THETA,
    startPhi: INITIAL_PHI,
  });
  const playbackSegmentRef = useRef({ elapsed: 0, startT: 0 });
  const resetAnimationRef = useRef({
    active: false,
    elapsed: 0,
    startT: 0,
    startGridReveal: 0,
    startTheta: INITIAL_THETA,
    startPhi: INITIAL_PHI,
    startTilt: 0,
    startGlossVisibility: 1,
  });
  const beginResetRef = useRef<() => void>(() => undefined);
  const resetCameraImmediatelyRef = useRef<() => void>(() => undefined);
  const [t, setT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  const setMorph = useCallback((next: number) => {
    const clamped = clamp01(next);
    tRef.current = clamped;
    setT(clamped);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playingRef.current) {
      pause();
      return;
    }

    resetAnimationRef.current.active = false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gridRevealRef.current = 1;
      glossVisibilityRef.current = 0;
      setMorph(tRef.current < 0.5 ? 1 : 0);
      return;
    }

    playbackSegmentRef.current.elapsed = 0;
    playbackSegmentRef.current.startT = tRef.current;
    if (tRef.current <= 0.001) {
      introOrbitRef.current.active = true;
      introOrbitRef.current.elapsed = 0;
    }
    playingRef.current = true;
    setIsPlaying(true);
  }, [pause, setMorph]);

  const handleReset = useCallback(() => {
    pause();
    introOrbitRef.current.active = false;
    introOrbitRef.current.elapsed = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      resetAnimationRef.current.active = false;
      gridRevealRef.current = 0;
      glossVisibilityRef.current = 1;
      setMorph(0);
      resetCameraImmediatelyRef.current();
      return;
    }
    beginResetRef.current();
  }, [pause, setMorph]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      const failureFrame = requestAnimationFrame(() => setWebglSupported(false));
      return () => cancelAnimationFrame(failureFrame);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "projection-canvas";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.2, 2.2, 1.3, -1.3, 0.1, 20);
    const root = new THREE.Group();
    root.position.y = 0.16;
    scene.add(root);

    const meshData = buildProjectionMesh();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(meshData.spherePositions, 3),
    );
    geometry.setAttribute("uv", new THREE.BufferAttribute(meshData.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.morphAttributes.position = [
      new THREE.BufferAttribute(meshData.erpPositions, 3),
    ];
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: 0xb9b2a8,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.morphTargetInfluences = [0];
    root.add(mesh);

    const glossMaterial = new THREE.MeshBasicMaterial({
      color: 0x9bbbc4,
      transparent: true,
      opacity: SPHERE_GLOSS_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const glossMesh = new THREE.Mesh(geometry, glossMaterial);
    glossMesh.frustumCulled = false;
    glossMesh.morphTargetInfluences = [0];
    glossMesh.renderOrder = 2;
    glossMesh.scale.setScalar(1.006);
    root.add(glossMesh);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      `${import.meta.env.BASE_URL}burnt-warehouse-4k.webp`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = true;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
    );

    const minorGridMaterial = new THREE.LineBasicMaterial({
      color: 0x8fd0df,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const majorGridMaterial = new THREE.LineBasicMaterial({
      color: 0xa8dbe5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const centerGridMaterial = new THREE.LineBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const seamMaterial = new THREE.LineBasicMaterial({
      color: 0xf29b82,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const morphLines: MorphLine[] = [];

    const addMorphLine = (
      samples: ReadonlyArray<readonly [number, number]>,
      lineMaterial: THREE.LineBasicMaterial,
      renderOrder: number,
    ) => {
      const data = makeLineData(samples);
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(data.sphere.slice(), 3),
      );
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.frustumCulled = false;
      line.renderOrder = renderOrder;
      root.add(line);
      morphLines.push({ geometry: lineGeometry, ...data });
    };

    const curveSamples = 128;
    for (let degree = -90; degree <= 90; degree += 15) {
      const phi = (degree * Math.PI) / 180;
      const samples: Array<readonly [number, number]> = [];
      for (let index = 0; index <= curveSamples; index += 1) {
        samples.push([
          -Math.PI + (index / curveSamples) * 2 * Math.PI,
          phi,
        ]);
      }
      const latitudeMaterial =
        degree === 0
          ? centerGridMaterial
          : degree % 30 === 0
            ? majorGridMaterial
            : minorGridMaterial;
      addMorphLine(samples, latitudeMaterial, 3);
    }

    for (let degree = -165; degree <= 165; degree += 15) {
      const lambda = (degree * Math.PI) / 180;
      const samples: Array<readonly [number, number]> = [];
      for (let index = 0; index <= curveSamples / 2; index += 1) {
        samples.push([
          lambda,
          -Math.PI / 2 + (index / (curveSamples / 2)) * Math.PI,
        ]);
      }
      addMorphLine(
        samples,
        degree === 0
          ? centerGridMaterial
          : degree % 30 === 0
            ? majorGridMaterial
            : minorGridMaterial,
        3,
      );
    }

    for (const lambda of [-Math.PI, Math.PI]) {
      const seamSamples: Array<readonly [number, number]> = [];
      for (let index = 0; index <= curveSamples / 2; index += 1) {
        seamSamples.push([
          lambda,
          -Math.PI / 2 + (index / (curveSamples / 2)) * Math.PI,
        ]);
      }
      addMorphLine(seamSamples, seamMaterial, 4);
    }

    const orbit = {
      theta: INITIAL_THETA,
      phi: INITIAL_PHI,
      velocityTheta: 0,
      velocityPhi: 0,
      dragging: false,
      pointerId: -1,
      lastX: 0,
      lastY: 0,
    };

    resetCameraImmediatelyRef.current = () => {
      orbit.theta = INITIAL_THETA;
      orbit.phi = INITIAL_PHI;
      orbit.velocityTheta = 0;
      orbit.velocityPhi = 0;
      presentationTiltRef.current = 0;
    };

    beginResetRef.current = () => {
      const reset = resetAnimationRef.current;
      reset.active = true;
      reset.elapsed = 0;
      reset.startT = tRef.current;
      reset.startGridReveal = Math.max(
        smootherstep(0, 1, gridRevealRef.current),
        smootherstep(0, 0.18, tRef.current),
      );
      reset.startTheta = orbit.theta;
      reset.startPhi = orbit.phi;
      reset.startTilt = presentationTiltRef.current;
      reset.startGlossVisibility = glossVisibilityRef.current;
      gridRevealRef.current = 0;
      orbit.dragging = false;
      orbit.pointerId = -1;
      orbit.velocityTheta = 0;
      orbit.velocityPhi = 0;
      renderer.domElement.classList.remove("is-orbiting");
    };

    const beginIntroRotation = () => {
      introOrbitRef.current.startTilt = presentationTiltRef.current;
      introOrbitRef.current.startTheta =
        THREE.MathUtils.euclideanModulo(orbit.theta + Math.PI, Math.PI * 2) -
        Math.PI;
      introOrbitRef.current.startPhi = orbit.phi;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (tRef.current >= 0.82 || event.button !== 0) return;
      resetAnimationRef.current.active = false;
      orbit.dragging = true;
      orbit.pointerId = event.pointerId;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.classList.add("is-orbiting");
      pause();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!orbit.dragging || event.pointerId !== orbit.pointerId) return;
      const strength = 1 - smootherstep(0.45, 0.82, tRef.current);
      const deltaX = event.clientX - orbit.lastX;
      const deltaY = event.clientY - orbit.lastY;
      const thetaDelta = -deltaX * 0.006 * strength;
      const phiDelta = deltaY * 0.005 * strength;
      orbit.theta += thetaDelta;
      orbit.phi = THREE.MathUtils.clamp(
        orbit.phi + phiDelta,
        -1.05,
        1.05,
      );
      orbit.velocityTheta = thetaDelta;
      orbit.velocityPhi = phiDelta;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
    };

    const endPointer = (event: PointerEvent) => {
      if (event.pointerId !== orbit.pointerId) return;
      orbit.dragging = false;
      orbit.pointerId = -1;
      renderer.domElement.classList.remove("is-orbiting");
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", endPointer);
    renderer.domElement.addEventListener("pointercancel", endPointer);

    let viewportWidth = Math.max(1, Math.round(mount.clientWidth));
    let viewportHeight = Math.max(1, Math.round(mount.clientHeight));
    let viewportAspect = viewportWidth / viewportHeight;
    let renderedWidth = 0;
    let renderedHeight = 0;
    const resize = () => {
      viewportWidth = Math.max(1, Math.round(mount.clientWidth));
      viewportHeight = Math.max(1, Math.round(mount.clientHeight));
      viewportAspect = viewportWidth / viewportHeight;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frameId = 0;
    let previousTime = performance.now();
    const render = (time: number) => {
      if (
        viewportWidth !== renderedWidth ||
        viewportHeight !== renderedHeight
      ) {
        renderer.setSize(viewportWidth, viewportHeight, false);
        renderedWidth = viewportWidth;
        renderedHeight = viewportHeight;
      }

      const delta = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;

      let resetGridReveal: number | null = null;
      const reset = resetAnimationRef.current;
      if (reset.active) {
        reset.elapsed = Math.min(RESET_SECONDS, reset.elapsed + delta);
        const progress = reset.elapsed / RESET_SECONDS;
        const easedProgress = smootherstep(0, 1, progress);
        setMorph(THREE.MathUtils.lerp(reset.startT, 0, easedProgress));
        orbit.theta = THREE.MathUtils.lerp(
          reset.startTheta,
          INITIAL_THETA,
          easedProgress,
        );
        orbit.phi = THREE.MathUtils.lerp(
          reset.startPhi,
          INITIAL_PHI,
          easedProgress,
        );
        presentationTiltRef.current = THREE.MathUtils.lerp(
          reset.startTilt,
          0,
          easedProgress,
        );
        glossVisibilityRef.current = THREE.MathUtils.lerp(
          reset.startGlossVisibility,
          1,
          easedProgress,
        );
        resetGridReveal = reset.startGridReveal * (1 - easedProgress);
        if (progress >= 1) reset.active = false;
      }

      if (playingRef.current) {
        gridRevealRef.current = Math.min(
          1,
          gridRevealRef.current + delta / GRID_FADE_SECONDS,
        );
        glossVisibilityRef.current = Math.max(
          0,
          glossVisibilityRef.current - delta / GLOSS_FADE_SECONDS,
        );
        const intro = introOrbitRef.current;
        if (intro.active) {
          if (intro.elapsed === 0) beginIntroRotation();
          const introDuration = INTRO_ALIGN_SECONDS + INTRO_HOLD_SECONDS;
          intro.elapsed = Math.min(
            introDuration,
            intro.elapsed + delta,
          );
          const alignmentProgress = clamp01(
            intro.elapsed / INTRO_ALIGN_SECONDS,
          );
          const easedProgress = smootherstep(0, 1, alignmentProgress);
          presentationTiltRef.current = THREE.MathUtils.lerp(
            intro.startTilt,
            INTRO_X_ROTATION,
            easedProgress,
          );
          orbit.theta = THREE.MathUtils.lerp(
            intro.startTheta,
            INITIAL_THETA,
            easedProgress,
          );
          orbit.phi = THREE.MathUtils.lerp(
            intro.startPhi,
            INITIAL_PHI,
            easedProgress,
          );
          orbit.velocityTheta = 0;
          orbit.velocityPhi = 0;
          if (intro.elapsed >= introDuration) {
            intro.active = false;
            playbackSegmentRef.current.elapsed = 0;
            playbackSegmentRef.current.startT = tRef.current;
          }
        } else {
          const segment = playbackSegmentRef.current;
          const segmentDuration = Math.max(
            0.12,
            PLAYBACK_SECONDS * (1 - segment.startT),
          );
          segment.elapsed = Math.min(segmentDuration, segment.elapsed + delta);
          const progress = segment.elapsed / segmentDuration;
          const easedProgress = smootherstep(0, 1, progress);
          setMorph(
            THREE.MathUtils.lerp(segment.startT, 1, easedProgress),
          );
          if (progress >= 1) {
            playingRef.current = false;
            setIsPlaying(false);
          }
        }
      }

      const amount = tRef.current;
      const playbackReveal = smootherstep(0, 1, gridRevealRef.current);
      const morphReveal = smootherstep(0, 0.18, amount);
      const gridReveal =
        resetGridReveal ?? Math.max(playbackReveal, morphReveal);
      minorGridMaterial.opacity = 0.2 * gridReveal;
      majorGridMaterial.opacity = 0.34 * gridReveal;
      centerGridMaterial.opacity = 0.46 * gridReveal;
      seamMaterial.opacity =
        0.58 * gridReveal * (1 - 0.45 * smootherstep(0.62, 1, amount));
      const orbitStrength = 1 - smootherstep(0.45, 0.82, amount);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!orbit.dragging && !reducedMotion) {
        const frameScale = delta * 60;
        orbit.theta += orbit.velocityTheta * frameScale * orbitStrength;
        orbit.phi = THREE.MathUtils.clamp(
          orbit.phi + orbit.velocityPhi * frameScale * orbitStrength,
          -1.05,
          1.05,
        );
        const damping = Math.pow(0.88, frameScale);
        orbit.velocityTheta *= damping;
        orbit.velocityPhi *= damping;
      } else if (reducedMotion) {
        orbit.velocityTheta = 0;
        orbit.velocityPhi = 0;
      }

      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = amount;
      if (glossMesh.morphTargetInfluences) {
        glossMesh.morphTargetInfluences[0] = amount;
      }
      glossMaterial.opacity =
        SPHERE_GLOSS_OPACITY *
        glossVisibilityRef.current *
        (1 - smootherstep(0.08, 0.58, amount));
      root.scale.x = displayScaleX(amount);
      morphLines.forEach((line) => updateMorphLine(line, amount));

      const framing = smootherstep(0.18, 0.9, amount);
      const desiredHalfWidth = THREE.MathUtils.lerp(1.08, 2.06, framing);
      const desiredHalfHeight = 1.12;
      const halfHeight = Math.max(
        desiredHalfHeight,
        desiredHalfWidth / viewportAspect,
      );
      const desiredVerticalOffset = THREE.MathUtils.lerp(
        0.08,
        1.05,
        smootherstep(0.18, 0.88, amount),
      );
      const maximumSafeOffset = Math.max(0.12, halfHeight - 1.08);
      root.position.y = Math.min(
        desiredVerticalOffset,
        maximumSafeOffset,
      );
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * viewportAspect;
      camera.right = halfHeight * viewportAspect;
      camera.updateProjectionMatrix();

      const cameraReturn = smootherstep(0.42, 0.94, amount);
      root.rotation.x = presentationTiltRef.current * (1 - cameraReturn);
      const theta = orbit.theta * (1 - cameraReturn);
      const phi = orbit.phi * (1 - cameraReturn);
      const radius = 4.4;
      camera.position.set(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.sin(phi),
        radius * Math.cos(theta) * Math.cos(phi),
      );
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      root.updateMatrixWorld(true);

      renderer.domElement.classList.toggle("orbit-disabled", amount >= 0.82);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", endPointer);
      renderer.domElement.removeEventListener("pointercancel", endPointer);
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      glossMaterial.dispose();
      minorGridMaterial.dispose();
      majorGridMaterial.dispose();
      centerGridMaterial.dispose();
      seamMaterial.dispose();
      morphLines.forEach((line) => line.geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [pause, setMorph]);

  const stateDescription =
    t < 0.03
      ? "Spherical environment map"
      : t > 0.97
        ? "Equirectangular projection"
        : "Explanatory interpolation";

  return (
    <main className="experience-shell">
      <header className="lecture-header">
        <div>
          <h1>Sphere to Equirectangular Projection</h1>
          <p className="header-copy">Same world. Different coordinates.</p>
        </div>
      </header>

      <section className="projection-stage" aria-label="Interactive sphere to ERP visualization">
        <div ref={mountRef} className="canvas-mount">
          {!webglSupported && (
            <div className="webgl-fallback" role="status">
              WebGL is unavailable. The formulas and controls remain available,
              but this browser cannot render the interactive projection.
            </div>
          )}
        </div>

        <div className="control-deck">
          <button className="primary-control" type="button" onClick={handlePlayPause}>
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            {isPlaying ? "Pause" : "Play"}
          </button>

          <div className="slider-group">
            <label className="sr-only" htmlFor="morph-slider">Sphere to ERP morph</label>
            <input
              id="morph-slider"
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={t}
              aria-valuetext={`${stateDescription}, t equals ${t.toFixed(2)}`}
              onChange={(event) => {
                pause();
                resetAnimationRef.current.active = false;
                setMorph(Number(event.currentTarget.value));
              }}
            />
            <div className="range-endpoints" aria-hidden="true">
              <span>Sphere</span>
              <span>ERP</span>
            </div>
          </div>

          <button className="reset-control" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {stateDescription}. Morph value {t.toFixed(2)}.
      </p>
    </main>
  );
}
