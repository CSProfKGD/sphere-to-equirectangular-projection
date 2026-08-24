export type Vec3 = readonly [number, number, number];

export type ProjectionMeshData = {
  spherePositions: Float32Array;
  erpPositions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  longitudeSegments: number;
  latitudeSegments: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function sphericalPosition(lambda: number, phi: number): Vec3 {
  const cosPhi = Math.cos(phi);
  return [
    cosPhi * Math.sin(lambda),
    Math.sin(phi),
    cosPhi * Math.cos(lambda),
  ];
}

export function erpPosition(lambda: number, phi: number): Vec3 {
  return [lambda / Math.PI, (2 * phi) / Math.PI, 0];
}

export function textureCoordinate(lambda: number, phi: number) {
  return {
    u: (lambda + Math.PI) / (2 * Math.PI),
    v: (phi + Math.PI / 2) / Math.PI,
  };
}

export function interpolatePosition(
  sphere: Vec3,
  erp: Vec3,
  amount: number,
): Vec3 {
  const t = clamp01(amount);
  return [
    sphere[0] + (erp[0] - sphere[0]) * t,
    sphere[1] + (erp[1] - sphere[1]) * t,
    sphere[2] + (erp[2] - sphere[2]) * t,
  ];
}

/**
 * The requested ERP coordinates are normalized to [-1, 1] on both axes.
 * A presentation-only horizontal scale restores the conventional 2:1 image
 * aspect without changing the endpoint coordinates stored in the mesh.
 */
export function displayScaleX(amount: number) {
  return 1 + clamp01(amount);
}

export function buildProjectionMesh(
  longitudeSegments = 192,
  latitudeSegments = 96,
): ProjectionMeshData {
  if (longitudeSegments < 3 || latitudeSegments < 2) {
    throw new RangeError("Projection mesh resolution is too low.");
  }

  const columns = longitudeSegments + 1;
  const rows = latitudeSegments + 1;
  const vertexCount = columns * rows;
  const spherePositions = new Float32Array(vertexCount * 3);
  const erpPositions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let latitudeIndex = 0; latitudeIndex < rows; latitudeIndex += 1) {
    const phi = -Math.PI / 2 + (latitudeIndex / latitudeSegments) * Math.PI;

    for (
      let longitudeIndex = 0;
      longitudeIndex < columns;
      longitudeIndex += 1
    ) {
      const lambda =
        -Math.PI + (longitudeIndex / longitudeSegments) * 2 * Math.PI;
      const vertexIndex = latitudeIndex * columns + longitudeIndex;
      const positionOffset = vertexIndex * 3;
      const uvOffset = vertexIndex * 2;
      const sphere = sphericalPosition(lambda, phi);
      const erp = erpPosition(lambda, phi);
      const uv = textureCoordinate(lambda, phi);

      spherePositions.set(sphere, positionOffset);
      erpPositions.set(erp, positionOffset);
      uvs.set([uv.u, uv.v], uvOffset);
    }
  }

  const indices = new Uint32Array(longitudeSegments * latitudeSegments * 6);
  let indexOffset = 0;

  for (
    let latitudeIndex = 0;
    latitudeIndex < latitudeSegments;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < longitudeSegments;
      longitudeIndex += 1
    ) {
      const lowerLeft = latitudeIndex * columns + longitudeIndex;
      const lowerRight = lowerLeft + 1;
      const upperLeft = lowerLeft + columns;
      const upperRight = upperLeft + 1;
      indices.set(
        [lowerLeft, lowerRight, upperLeft, lowerRight, upperRight, upperLeft],
        indexOffset,
      );
      indexOffset += 6;
    }
  }

  return {
    spherePositions,
    erpPositions,
    uvs,
    indices,
    longitudeSegments,
    latitudeSegments,
  };
}
