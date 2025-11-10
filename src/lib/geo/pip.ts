import type { MultiPolygon, Polygon, Position } from "geojson";

const isPointInRing = ([px, py]: [number, number], ring: Position[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if ((yi > py) !== (yj > py)) {
      const xIntersect = ((py - yi) * (xj - xi)) / (yj - yi) + xi;
      if (px < xIntersect) inside = !inside;
    }
  }
  return inside;
};

const normalizeRing = (ring: Position[]): Position[] => {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
};

const polygonContainsPoint = (point: [number, number], polygon: Polygon): boolean => {
  const [outer, ...holes] = polygon.coordinates.map((ring) => normalizeRing(ring as Position[]));
  if (!outer || outer.length < 4) return false;
  if (!isPointInRing(point, outer)) return false;
  for (const hole of holes) {
    if (hole.length >= 4 && isPointInRing(point, hole)) {
      return false;
    }
  }
  return true;
};

export function isPointInFeature([lng, lat]: [number, number], geom: Polygon | MultiPolygon): boolean {
  if (geom.type === "Polygon") {
    return polygonContainsPoint([lng, lat], geom);
  }

  return geom.coordinates.some((polygon) =>
    polygonContainsPoint([lng, lat], { type: "Polygon", coordinates: polygon }),
  );
}

type CentroidAccumulator = {
  area: number;
  cx: number;
  cy: number;
};

const addRingContribution = (ring: Position[], acc: CentroidAccumulator): void => {
  const normalized = normalizeRing(ring);
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let i = 0; i < normalized.length - 1; i += 1) {
    const [x0, y0] = normalized[i] as [number, number];
    const [x1, y1] = normalized[i + 1] as [number, number];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    centroidX += (x0 + x1) * cross;
    centroidY += (y0 + y1) * cross;
  }

  if (signedArea === 0) return;
  const area = signedArea / 2;
  acc.area += area;
  acc.cx += centroidX;
  acc.cy += centroidY;
};

const polygonCentroid = (polygon: Polygon, acc: CentroidAccumulator): void => {
  const [outer, ...holes] = polygon.coordinates as Position[][];
  if (!outer || outer.length < 4) return;
  addRingContribution(outer, acc);
  for (const hole of holes) {
    addRingContribution(hole, acc);
  }
};

const collectPositions = (geom: Polygon | MultiPolygon): [number, number][] => {
  const positions: [number, number][] = [];
  if (geom.type === "Polygon") {
    geom.coordinates.forEach((ring) => {
      ring.forEach((pos) => {
        const [x, y] = pos as [number, number];
        if (Number.isFinite(x) && Number.isFinite(y)) {
          positions.push([x, y]);
        }
      });
    });
    return positions;
  }

  geom.coordinates.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach((pos) => {
        const [x, y] = pos as [number, number];
        if (Number.isFinite(x) && Number.isFinite(y)) {
          positions.push([x, y]);
        }
      });
    });
  });
  return positions;
};

export function featureCentroid(geom: Polygon | MultiPolygon): [number, number] {
  const acc: CentroidAccumulator = { area: 0, cx: 0, cy: 0 };

  if (geom.type === "Polygon") {
    polygonCentroid(geom, acc);
  } else {
    geom.coordinates.forEach((polygon) => {
      polygonCentroid({ type: "Polygon", coordinates: polygon }, acc);
    });
  }

  if (acc.area !== 0) {
    return [acc.cx / (6 * acc.area), acc.cy / (6 * acc.area)];
  }

  const positions = collectPositions(geom);
  if (positions.length === 0) {
    return [0, 0];
  }
  const sum = positions.reduce<{
    x: number;
    y: number;
  }>(
    (memo, [x, y]) => ({ x: memo.x + x, y: memo.y + y }),
    { x: 0, y: 0 },
  );
  return [sum.x / positions.length, sum.y / positions.length];
}
