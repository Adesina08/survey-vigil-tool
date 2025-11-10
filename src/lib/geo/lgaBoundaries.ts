import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

export interface LgaBoundaryFeature {
  feature: Feature<Polygon | MultiPolygon, Record<string, unknown>>;
  centroid: [number, number];
  name: string;
}

const boundaryCache = new Map<string, Promise<LgaBoundaryFeature[]>>();

const DEFAULT_BOUNDARY_PATH = "/ogun-lga.geojson";

const COORD_EPSILON = 1e-9;

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

const ringAreaAndCentroid = (ring: Position[]): { area: number; cx: number; cy: number } => {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  const signedArea = area / 2;
  if (Math.abs(signedArea) < COORD_EPSILON) {
    const fallback = ring[0] ?? [0, 0];
    return { area: 0, cx: fallback[0], cy: fallback[1] };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;
  return { area: signedArea, cx, cy };
};

const polygonCentroid = (coordinates: Position[][]): [number, number] => {
  let totalArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  coordinates.forEach((ring, index) => {
    if (ring.length < 4) return;
    const { area, cx, cy } = ringAreaAndCentroid(ring);
    // Outer ring contributes positively, inner rings (holes) negatively
    const signedArea = index === 0 ? area : -area;
    totalArea += signedArea;
    centroidX += cx * signedArea;
    centroidY += cy * signedArea;
  });

  if (Math.abs(totalArea) < COORD_EPSILON) {
    const fallback = coordinates[0]?.[0] ?? [0, 0];
    return [fallback[1], fallback[0]];
  }

  return [centroidY / totalArea, centroidX / totalArea];
};

const multiPolygonCentroid = (coordinates: Position[][][]): [number, number] => {
  let totalArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  coordinates.forEach((polygon) => {
    const [lat, lng] = polygonCentroid(polygon);
    const { area } = ringAreaAndCentroid(polygon[0] ?? []);
    const weight = Math.abs(area);
    totalArea += weight;
    centroidX += lng * weight;
    centroidY += lat * weight;
  });

  if (totalArea === 0) {
    const fallback = coordinates[0]?.[0]?.[0] ?? [0, 0];
    return [fallback[1], fallback[0]];
  }

  return [centroidY / totalArea, centroidX / totalArea];
};

export const getFeatureCentroid = (
  feature: Feature<Polygon | MultiPolygon, Record<string, unknown>>,
): [number, number] => {
  const geometry = feature.geometry;
  if (!geometry) return [0, 0];

  if (geometry.type === "Polygon") {
    return polygonCentroid(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return multiPolygonCentroid(geometry.coordinates);
  }

  return [0, 0];
};

const fetchGeoJson = async (
  path: string,
): Promise<FeatureCollection<Geometry, Record<string, unknown>>> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load LGA boundaries from ${path}`);
  }

  return (await response.json()) as FeatureCollection<Geometry, Record<string, unknown>>;
};

const extractFeatureName = (
  feature: Feature<Geometry, Record<string, unknown>>,
): string => {
  const properties = feature.properties ?? {};
  const potentialKeys = ["lganame", "LGA", "name", "Name", "NAME_1", "ADM2_EN"];
  for (const key of potentialKeys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "Unknown";
};

export const loadLgaBoundaries = async (
  path: string = DEFAULT_BOUNDARY_PATH,
): Promise<LgaBoundaryFeature[]> => {
  if (typeof window === "undefined") {
    return [];
  }

  if (!boundaryCache.has(path)) {
    boundaryCache.set(
      path,
      (async () => {
        const geoJson = await fetchGeoJson(path);
        const features = ensureArray(geoJson.features ?? []);

        return features
          .filter(
            (feature): feature is Feature<Polygon | MultiPolygon, Record<string, unknown>> =>
              feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon",
          )
          .map((feature) => ({
            feature,
            centroid: getFeatureCentroid(feature),
            name: extractFeatureName(feature),
          }));
      })(),
    );
  }

  return boundaryCache.get(path)!;
};

const pointInRing = (point: [number, number], ring: Position[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + COORD_EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (point: [number, number], polygon: Position[][]): boolean => {
  if (polygon.length === 0) return false;
  const isInsideOuter = pointInRing(point, polygon[0]);
  if (!isInsideOuter) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) {
      return false;
    }
  }
  return true;
};

export const isPointInsideFeature = (
  lngLat: [number, number],
  feature: Feature<Polygon | MultiPolygon, Record<string, unknown>>,
): boolean => {
  const geometry = feature.geometry;
  if (!geometry) return false;

  const point: [number, number] = [lngLat[0], lngLat[1]];

  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
};
