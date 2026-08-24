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

const PLAYBACK_SECONDS = 8;
const INITIAL_THETA = 0.58;
const INITIAL_PHI = 0.2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

function makeLineData(samples: ReadonlyArray<readonly [number, number]>) {
  const sphere = new Float32Array(samples.length * 3);
  const erp = new Float32Array(samples.length * 3);

  samples.forEach(([lambda, phi], index) => {
    sphere.set(sphericalPosition(lambda, phi), index * 3);
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
  const directionRef = useRef<1 | -1>(1);
  const resetCameraRef = useRef<() => void>(() => undefined);
  const [t, setT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [textureReady, setTextureReady] = useState(false);

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

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMorph(tRef.current < 0.5 ? 1 : 0);
      return;
    }

    if (tRef.current >= 1) directionRef.current = -1;
    if (tRef.current <= 0) directionRef.current = 1;
    playingRef.current = true;
    setIsPlaying(true);
  }, [pause, setMorph]);

  const handleReset = useCallback(() => {
    pause();
    directionRef.current = 1;
    setMorph(0);
    resetCameraRef.current();
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

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/burnt-warehouse-4k.webp",
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        setTextureReady(true);
      },
      undefined,
      () => setTextureReady(false),
    );

    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x8fd0df,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const equatorMaterial = new THREE.LineBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const seamMaterial = new THREE.LineBasicMaterial({
      color: 0xff725f,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
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
      addMorphLine(samples, degree === 0 ? equatorMaterial : gridMaterial, 3);
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
      addMorphLine(samples, gridMaterial, 3);
    }

    for (const lambda of [-Math.PI, Math.PI]) {
      const samples: Array<readonly [number, number]> = [];
      for (let index = 0; index <= curveSamples / 2; index += 1) {
        samples.push([
          lambda,
          -Math.PI / 2 + (index / (curveSamples / 2)) * Math.PI,
        ]);
      }
      addMorphLine(samples, seamMaterial, 5);
    }

    const orbit = {
      theta: INITIAL_THETA,
      phi: INITIAL_PHI,
      dragging: false,
      pointerId: -1,
      lastX: 0,
      lastY: 0,
    };

    resetCameraRef.current = () => {
      orbit.theta = INITIAL_THETA;
      orbit.phi = INITIAL_PHI;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (tRef.current >= 0.82 || event.button !== 0) return;
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
      const strength = 1 - smoothstep(0.45, 0.82, tRef.current);
      orbit.theta -= (event.clientX - orbit.lastX) * 0.006 * strength;
      orbit.phi = THREE.MathUtils.clamp(
        orbit.phi + (event.clientY - orbit.lastY) * 0.005 * strength,
        -1.05,
        1.05,
      );
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

    let viewportAspect = 1;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      viewportAspect = width / height;
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frameId = 0;
    let previousTime = performance.now();
    const render = (time: number) => {
      const delta = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;

      if (playingRef.current) {
        let next = tRef.current + (delta / PLAYBACK_SECONDS) * directionRef.current;
        if (next >= 1) {
          next = 1;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        setMorph(next);
      }

      const amount = tRef.current;
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = amount;
      root.scale.x = displayScaleX(amount);
      morphLines.forEach((line) => updateMorphLine(line, amount));

      const framing = smoothstep(0.18, 0.9, amount);
      const desiredHalfWidth = THREE.MathUtils.lerp(1.28, 2.14, framing);
      const desiredHalfHeight = 1.24;
      const halfHeight = Math.max(
        desiredHalfHeight,
        desiredHalfWidth / viewportAspect,
      );
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * viewportAspect;
      camera.right = halfHeight * viewportAspect;
      camera.updateProjectionMatrix();

      const cameraReturn = smoothstep(0.42, 0.94, amount);
      const theta = orbit.theta * (1 - cameraReturn);
      const phi = orbit.phi * (1 - cameraReturn);
      const radius = 4.4;
      camera.position.set(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.sin(phi),
        radius * Math.cos(theta) * Math.cos(phi),
      );
      camera.lookAt(0, 0, 0);
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
      gridMaterial.dispose();
      equatorMaterial.dispose();
      seamMaterial.dispose();
      morphLines.forEach((line) => line.geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [pause, setMorph]);

  const sphereOpacity = 1 - smoothstep(0.32, 0.7, t);
  const erpOpacity = smoothstep(0.3, 0.68, t);
  const orbitStrength = Math.round(
    (1 - smoothstep(0.45, 0.82, t)) * 100,
  );
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
          <p className="eyebrow">Viewing-direction domain · Interactive lecture figure</p>
          <h1>Sphere <span aria-hidden="true">→</span> ERP</h1>
        </div>
        <p className="header-copy">
          One panorama, two parameterizations. Follow each viewing direction
          from the sphere into a flat equirectangular image.
        </p>
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

        <div className="stage-topline" aria-hidden="true">
          <span className="state-chip">{stateDescription}</span>
          <span className="seam-key"><i />Seam: −π ↔ π</span>
        </div>

        <div
          className="endpoint-label endpoint-sphere"
          style={{ opacity: sphereOpacity }}
        >
          <span>t = 0</span>
          <strong>Spherical environment map</strong>
        </div>
        <div
          className="endpoint-label endpoint-erp"
          style={{ opacity: erpOpacity }}
        >
          <span>t = 1</span>
          <strong>Equirectangular projection (ERP)</strong>
        </div>

        <span className="axis-label longitude-label" style={{ opacity: erpOpacity }}>
          Longitude (λ)
        </span>
        <span className="axis-label latitude-label" style={{ opacity: erpOpacity }}>
          Latitude (φ)
        </span>

        <div className="equation-card" aria-label="Vertex interpolation equation">
          <span>vertex interpolation</span>
          <code>p(t) = (1 − t)p<sub>sphere</sub> + tp<sub>ERP</sub></code>
        </div>

        <div className="orbit-hint" aria-hidden="true">
          <span className="orbit-icon">↻</span>
          {orbitStrength > 0 ? `Drag to orbit · ${orbitStrength}%` : "Front view locked"}
        </div>

        <div className="control-deck">
          <button className="primary-control" type="button" onClick={handlePlayPause}>
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            {isPlaying ? "Pause" : "Play"}
          </button>

          <div className="slider-group">
            <div className="slider-heading">
              <label htmlFor="morph-slider">Morph parameter <i>t</i></label>
              <output htmlFor="morph-slider">{t.toFixed(2)}</output>
            </div>
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
                setMorph(Number(event.currentTarget.value));
              }}
            />
            <div className="range-endpoints" aria-hidden="true">
              <span>0 · Sphere</span>
              <span>1 · ERP</span>
            </div>
          </div>

          <button className="reset-control" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </section>

      <footer className="concept-note">
        <span className="note-index">01</span>
        <p>
          <strong>Read the endpoints.</strong> The intermediate surface is only
          an explanatory interpolation—not a standard map projection. Distortion
          becomes strongest near the poles as converging spherical cells open
          across the full ERP width.
        </p>
        <span className={`texture-status ${textureReady ? "is-ready" : ""}`}>
          {textureReady ? "HDR panorama ready" : "Loading panorama…"}
        </span>
      </footer>

      <p className="sr-only" aria-live="polite">
        {stateDescription}. Morph value {t.toFixed(2)}.
      </p>
    </main>
  );
}
