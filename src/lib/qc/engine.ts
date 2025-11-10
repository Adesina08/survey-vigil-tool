import type { Feature, MultiPolygon, Polygon } from "geojson";

import { isPointInsideFeature } from "@/lib/geo/lgaBoundaries";
import type { ErrorType } from "@/types/submission";

export interface QualityRow {
  id: string;
  interviewStart: string;
  interviewEnd: string;
  durationSeconds?: number | null;
  interviewerId: string;
  deviceId?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lgaFeature?: Feature<Polygon | MultiPolygon> | null;
}

export interface QualityCheckOptions {
  clusterRadiusMeters?: number;
  meanDurationSeconds?: number | null;
  getFeatureForRow?: (
    row: QualityRow,
  ) => Feature<Polygon | MultiPolygon> | null | undefined;
}

export interface AnnotatedQualityRow extends QualityRow {
  flags: ErrorType[];
}

const DEFAULT_CLUSTER_RADIUS_METERS = 5;
const SHORT_GAP_SECONDS = 60;

const toDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePhoneNumber = (value: string): string => value.replace(/[^0-9+]/g, "");

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const computeMeanDuration = (rows: QualityRow[]): number | null => {
  const durations = rows
    .map((row) => row.durationSeconds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (durations.length === 0) return null;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return total / durations.length;
};

const ensureFeature = (
  row: QualityRow,
  options: QualityCheckOptions,
): Feature<Polygon | MultiPolygon> | null => {
  if (row.lgaFeature?.geometry) return row.lgaFeature;
  if (options.getFeatureForRow) {
    const feature = options.getFeatureForRow(row);
    if (feature?.geometry) return feature;
  }
  return null;
};

const uniqueFlags = (...flags: Array<ErrorType | null | undefined>) =>
  Array.from(new Set(flags.filter((flag): flag is ErrorType => Boolean(flag))));

export const applyQualityChecks = (
  rows: QualityRow[],
  options: QualityCheckOptions = {},
): AnnotatedQualityRow[] => {
  const meanDuration = options.meanDurationSeconds ?? computeMeanDuration(rows);
  const clusterRadius = options.clusterRadiusMeters ?? DEFAULT_CLUSTER_RADIUS_METERS;

  const phoneDirectory = new Map<string, string[]>();
  rows.forEach((row) => {
    if (!row.phone) return;
    const normalized = normalizePhoneNumber(row.phone);
    if (!normalized) return;
    const entries = phoneDirectory.get(normalized) ?? [];
    entries.push(row.id);
    phoneDirectory.set(normalized, entries);
  });

  const duplicatePhoneIds = new Set<string>();
  phoneDirectory.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => duplicatePhoneIds.add(id));
    }
  });

  const deviceGroups = new Map<string, Array<{ row: QualityRow; start: Date | null; end: Date | null }>>();
  rows.forEach((row) => {
    const deviceKey = (row.deviceId ?? row.interviewerId).toString();
    const start = toDate(row.interviewStart);
    const end = toDate(row.interviewEnd);
    const list = deviceGroups.get(deviceKey) ?? [];
    list.push({ row, start, end });
    deviceGroups.set(deviceKey, list);
  });

  const interwovenIds = new Set<string>();
  const shortGapIds = new Set<string>();

  deviceGroups.forEach((entries) => {
    const sorted = entries.sort((a, b) => {
      const timeA = a.start?.getTime() ?? 0;
      const timeB = b.start?.getTime() ?? 0;
      return timeA - timeB;
    });

    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1];
      if (!current.start || !previous.end) continue;

      if (previous.end.getTime() > current.start.getTime()) {
        interwovenIds.add(current.row.id);
        interwovenIds.add(previous.row.id);
      }

      const gapSeconds = (current.start.getTime() - previous.end.getTime()) / 1000;
      if (gapSeconds >= 0 && gapSeconds < SHORT_GAP_SECONDS) {
        shortGapIds.add(current.row.id);
      }
    }
  });

  const interviewerGroups = new Map<string, QualityRow[]>();
  rows.forEach((row) => {
    const list = interviewerGroups.get(row.interviewerId) ?? [];
    list.push(row);
    interviewerGroups.set(row.interviewerId, list);
  });

  const clusteredIds = new Set<string>();
  interviewerGroups.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      const a = group[i];
      if (typeof a.latitude !== "number" || typeof a.longitude !== "number") continue;
      for (let j = i + 1; j < group.length; j += 1) {
        const b = group[j];
        if (typeof b.latitude !== "number" || typeof b.longitude !== "number") continue;
        const distance = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
        if (distance <= clusterRadius) {
          clusteredIds.add(a.id);
          clusteredIds.add(b.id);
        }
      }
    }
  });

  return rows.map((row) => {
    const flags: ErrorType[] = [];
    const duration = row.durationSeconds ?? null;
    const startDate = toDate(row.interviewStart);

    if (meanDuration && duration && duration < meanDuration * 0.25) {
      flags.push("Low LOI");
    }

    if (meanDuration && duration && duration > meanDuration * 2) {
      flags.push("High LOI");
    }

    if (startDate) {
      const hour = startDate.getHours() + startDate.getMinutes() / 60;
      if (hour < 7 || hour > 20) {
        flags.push("OddHour");
      }
    }

    if (duplicatePhoneIds.has(row.id)) {
      flags.push("DuplicatePhone");
    }

    if (interwovenIds.has(row.id)) {
      flags.push("Interwoven");
    }

    if (shortGapIds.has(row.id)) {
      flags.push("ShortGap");
    }

    if (typeof row.latitude === "number" && typeof row.longitude === "number") {
      const feature = ensureFeature(row, options);
      if (feature && !isPointInsideFeature([row.longitude, row.latitude], feature)) {
        flags.push("Outside LGA Boundary");
      }
    }

    if (clusteredIds.has(row.id)) {
      flags.push("ClusteredInterview");
    }

    return {
      ...row,
      flags: uniqueFlags(...flags),
    };
  });
};
