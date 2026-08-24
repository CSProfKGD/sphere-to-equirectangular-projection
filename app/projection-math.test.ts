import { describe, expect, it } from "vitest";
import {
  buildProjectionMesh,
  displayScaleX,
  erpPosition,
  interpolatePosition,
  sphericalPosition,
  textureCoordinate,
} from "./projection-math";

describe("projection endpoints", () => {
  it("evaluates the specified spherical coordinates", () => {
    expect(sphericalPosition(0, 0)).toEqual([0, 0, 1]);
    expect(sphericalPosition(Math.PI / 2, 0)[0]).toBeCloseTo(1);
    expect(sphericalPosition(0, Math.PI / 2)[1]).toBeCloseTo(1);
  });

  it("evaluates the normalized ERP coordinates", () => {
    expect(erpPosition(-Math.PI, -Math.PI / 2)).toEqual([-1, -1, 0]);
    expect(erpPosition(Math.PI, Math.PI / 2)).toEqual([1, 1, 0]);
    expect(displayScaleX(1)).toBe(2);
  });

  it("interpolates and clamps the explanatory morph", () => {
    expect(interpolatePosition([0, 0, 1], [1, 1, 0], 0.5)).toEqual([
      0.5, 0.5, 0.5,
    ]);
    expect(interpolatePosition([0, 0, 1], [1, 1, 0], 2)).toEqual([1, 1, 0]);
  });

  it("maps the seam to distinct texture edges", () => {
    expect(textureCoordinate(-Math.PI, 0).u).toBe(0);
    expect(textureCoordinate(Math.PI, 0).u).toBe(1);
    expect(textureCoordinate(0, -Math.PI / 2).v).toBe(0);
    expect(textureCoordinate(0, Math.PI / 2).v).toBe(1);
  });
});

describe("seam-safe mesh", () => {
  it("duplicates the seam and never wraps an index across it", () => {
    const longitudeSegments = 8;
    const latitudeSegments = 4;
    const mesh = buildProjectionMesh(longitudeSegments, latitudeSegments);
    const columns = longitudeSegments + 1;

    expect(mesh.spherePositions.length / 3).toBe(
      columns * (latitudeSegments + 1),
    );

    for (let row = 0; row <= latitudeSegments; row += 1) {
      const left = row * columns;
      const right = left + longitudeSegments;
      expect(mesh.spherePositions[left * 3]).toBeCloseTo(
        mesh.spherePositions[right * 3],
      );
      expect(mesh.uvs[left * 2]).toBe(0);
      expect(mesh.uvs[right * 2]).toBe(1);
    }

    for (let offset = 0; offset < mesh.indices.length; offset += 3) {
      const triangleColumns = [
        mesh.indices[offset] % columns,
        mesh.indices[offset + 1] % columns,
        mesh.indices[offset + 2] % columns,
      ];
      expect(Math.max(...triangleColumns) - Math.min(...triangleColumns)).toBeLessThanOrEqual(1);
    }

    expect(Array.from(mesh.spherePositions).every(Number.isFinite)).toBe(true);
    expect(Array.from(mesh.erpPositions).every(Number.isFinite)).toBe(true);
  });
});
