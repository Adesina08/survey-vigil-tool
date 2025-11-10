import type { MapSubmission, ErrorType } from "@/types/submission";
import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

import { isPointInFeature } from "@/lib/geo/pip";

export interface QCOptions {
  clusterRadiusMeters?: number; // default 5
  lgaGeo?: FeatureCollection<Geometry, Record<string, unknown>>; // optional LGA shapes
}

export interface QCAnnotated extends MapSubmission {
  autoFlags: ErrorType[];
  geotagStatus?: "inside" | "outside" | "unknown";
  actualLGA?: string;
  clusterWithIds: string[];
  proximityDistanceMeters: number | null;
}

export function applyQualityChecks(rows: MapSubmission[], options: QCOptions = {}): QCAnnotated[] {
  const clusterRadius = options.clusterRadiusMeters ?? 5;

  const durations = rows
    .map((row) => row.durationMinutes)
    .filter((duration): duration is number => typeof duration === "number" && Number.isFinite(duration) && duration > 0);

  const meanDuration = durations.length
    ? durations.reduce((total, value) => total + value, 0) / durations.length
    : null;

  const normalizePhone = (value: string): string => value.replace(/[^0-9+]/g, "");

  const duplicatePhones = new Map<string, string[]>();
  rows.forEach((row) => {
    if (!row.phone) return;
    const normalized = normalizePhone(row.phone);
    if (!normalized) return;
    const list = duplicatePhones.get(normalized) ?? [];
    list.push(row.id);
    duplicatePhones.set(normalized, list);
  });

  const duplicatePhoneIds = new Set<string>();
  duplicatePhones.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => duplicatePhoneIds.add(id));
    }
  });

  const parseDate = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toTimestamp = (row: MapSubmission) => parseDate(row.starttime ?? row.timestamp);
  const toEnd = (row: MapSubmission) => parseDate(row.endtime ?? row.timestamp);

  const deviceBuckets = new Map<string, Array<{ row: MapSubmission; start: Date | null; end: Date | null }>>();
  rows.forEach((row) => {
    const key = row.deviceId ?? row.interviewerId;
    const bucket = deviceBuckets.get(key) ?? [];
    bucket.push({ row, start: toTimestamp(row), end: toEnd(row) });
    deviceBuckets.set(key, bucket);
  });

  const interwovenIds = new Set<string>();
  const shortGapIds = new Set<string>();

  deviceBuckets.forEach((entries) => {
    entries.sort((a, b) => {
      const aTime = a.start?.getTime() ?? 0;
      const bTime = b.start?.getTime() ?? 0;
      return aTime - bTime;
    });

    for (let i = 1; i < entries.length; i += 1) {
      const previous = entries[i - 1];
      const current = entries[i];
      if (previous.end && current.start && previous.end > current.start) {
        interwovenIds.add(previous.row.id);
        interwovenIds.add(current.row.id);
      }
      if (previous.end && current.start) {
        const gapMinutes = (current.start.getTime() - previous.end.getTime()) / 60000;
        if (gapMinutes >= 0 && gapMinutes < 1) {
          shortGapIds.add(current.row.id);
        }
      }
    }
  });

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const haversine = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const dLat = toRadians(b[0] - a[0]);
    const dLng = toRadians(b[1] - a[1]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const lat1 = toRadians(a[0]);
    const lat2 = toRadians(b[0]);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  };

  const interviewerBuckets = new Map<string, MapSubmission[]>();
  rows.forEach((row) => {
    const bucket = interviewerBuckets.get(row.interviewerId) ?? [];
    bucket.push(row);
    interviewerBuckets.set(row.interviewerId, bucket);
  });

  const clusteredIds = new Map<string, Set<string>>();
  const proximityDistance = new Map<string, number>();

  interviewerBuckets.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      const first = group[i];
      if (typeof first.lat !== "number" || typeof first.lng !== "number") continue;
      for (let j = i + 1; j < group.length; j += 1) {
        const second = group[j];
        if (typeof second.lat !== "number" || typeof second.lng !== "number") continue;
        const distance = haversine([first.lat, first.lng], [second.lat, second.lng]);
        const existingFirst = proximityDistance.get(first.id);
        const existingSecond = proximityDistance.get(second.id);
        if (existingFirst === undefined || distance < existingFirst) {
          proximityDistance.set(first.id, distance);
        }
        if (existingSecond === undefined || distance < existingSecond) {
          proximityDistance.set(second.id, distance);
        }
        if (distance <= clusterRadius) {
          const firstSet = clusteredIds.get(first.id) ?? new Set<string>();
          firstSet.add(second.id);
          clusteredIds.set(first.id, firstSet);

          const secondSet = clusteredIds.get(second.id) ?? new Set<string>();
          secondSet.add(first.id);
          clusteredIds.set(second.id, secondSet);
        }
      }
    }
  });

  const lgaFeatures = options.lgaGeo?.features ?? [];
  const normalizeName = (value: string | number | undefined | null) =>
    typeof value === "string" ? value.trim().toLowerCase() : typeof value === "number" ? String(value) : "";

  const featureLookup = new Map<string, Polygon | MultiPolygon>();
  const featureName = new Map<Polygon | MultiPolygon, string>();

  lgaFeatures.forEach((feature) => {
    if (!feature.geometry) return;
    const geometry = feature.geometry as Polygon | MultiPolygon;
    const properties = feature.properties ?? {};
    const names = [
      properties.LGA,
      properties.lga,
      properties.name,
      properties.NAME,
      properties.LGAName,
      properties.lga_name,
    ];
    const displayNameCandidate = names.find((value) => typeof value === "string" && value.trim().length > 0);
    const displayName = typeof displayNameCandidate === "string" ? displayNameCandidate.trim() : undefined;
    names
      .map((value) => normalizeName(value))
      .filter((value) => value.length > 0)
      .forEach((value) => {
        featureLookup.set(value, geometry);
        if (displayName) {
          featureName.set(geometry, displayName);
        }
      });
  });

  const findGeometryByPoint = (lng: number, lat: number): { geometry: Polygon | MultiPolygon; name: string | undefined } | null => {
    for (const feature of lgaFeatures) {
      if (!feature.geometry) continue;
      const geometry = feature.geometry as Polygon | MultiPolygon;
      if (isPointInFeature([lng, lat], geometry)) {
        return { geometry, name: featureName.get(geometry) };
      }
    }
    return null;
  };

  return rows.map((row) => {
    const autoFlags: ErrorType[] = [];

    if (meanDuration && row.durationMinutes && row.durationMinutes < meanDuration * 0.25) {
      autoFlags.push("Low LOI");
    }
    if (meanDuration && row.durationMinutes && row.durationMinutes > meanDuration * 2) {
      autoFlags.push("High LOI");
    }

    const startDate = parseDate(row.starttime ?? row.timestamp);
    if (startDate) {
      const hour = startDate.getHours();
      if (hour < 7 || hour > 20) {
        autoFlags.push("OddHour");
      }
    }

    if (duplicatePhoneIds.has(row.id)) {
      autoFlags.push("DuplicatePhone");
    }

    if (interwovenIds.has(row.id)) {
      autoFlags.push("Interwoven");
    }

    if (shortGapIds.has(row.id)) {
      autoFlags.push("ShortGap");
    }

    let geotagStatus: "inside" | "outside" | "unknown" | undefined = "unknown";
    let actualLGA: string | undefined;

    if (typeof row.lat === "number" && typeof row.lng === "number" && lgaFeatures.length > 0) {
      const expectedKey = normalizeName(row.lga);
      const expectedGeometry = expectedKey ? featureLookup.get(expectedKey) : undefined;
      const inExpected = expectedGeometry
        ? isPointInFeature([row.lng, row.lat], expectedGeometry)
        : undefined;

      const located = findGeometryByPoint(row.lng, row.lat);
      if (located) {
        actualLGA = located.name ?? actualLGA;
      }

      if (inExpected === true) {
        geotagStatus = "inside";
      } else if (inExpected === false) {
        geotagStatus = "outside";
        autoFlags.push("Outside LGA Boundary");
      } else {
        geotagStatus = "unknown";
      }
    }

    if (clusteredIds.has(row.id)) {
      autoFlags.push("ClusteredInterview");
    }

    const clusterWithIds = Array.from(clusteredIds.get(row.id) ?? new Set<string>());
    const proximityDistanceMeters = proximityDistance.has(row.id)
      ? proximityDistance.get(row.id) ?? null
      : clusterWithIds.length > 0
      ? clusterRadius
      : null;

    return {
      ...row,
      autoFlags: Array.from(new Set(autoFlags)),
      geotagStatus,
      actualLGA,
      clusterWithIds,
      proximityDistanceMeters: proximityDistanceMeters ?? null,
    };
  });
}
