import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

import type { ErrorType, SheetSubmissionRow } from "@/types/sheets";

const EARTH_RADIUS_METERS = 6371e3;
const DEFAULT_CLUSTER_RADIUS_METERS = 5;

interface InternalMetadata {
  errors: ErrorType[];
  geotagStatus?: string;
  actualState?: string;
  actualLGA?: string;
  clusteredWith: Set<string>;
  proximityDistance: number;
}

interface DerivedRecord {
  row: SheetSubmissionRow;
  start?: Date;
  end?: Date;
  dateKey?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  deviceId?: string;
  username: string;
  metadata: InternalMetadata;
}

export interface SubmissionQualityMetadata {
  errors: ErrorType[];
  isValid: boolean;
  geotagStatus?: string;
  actualState?: string;
  actualLGA?: string;
  clusteredWithIds: string[];
  proximityDistanceMeters: number | null;
}

export type ProcessedSubmissionRow = SheetSubmissionRow & {
  qualityMetadata: SubmissionQualityMetadata;
};

export interface QualityCheckOptions {
  clusterRadiusMeters?: number;
  lgaBoundaries?: FeatureCollection<Geometry, Record<string, unknown>>;
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const parseDate = (value?: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const combineDateAndTime = (dateValue?: string, timeValue?: string): Date | undefined => {
  if (!dateValue) {
    return undefined;
  }

  const baseTime = timeValue && timeValue.trim().length > 0 ? timeValue : "00:00";
  const withoutZone = new Date(`${dateValue}T${baseTime}`);
  if (!Number.isNaN(withoutZone.getTime())) {
    return withoutZone;
  }

  const withZone = new Date(`${dateValue}T${baseTime}Z`);
  return Number.isNaN(withZone.getTime()) ? undefined : withZone;
};

const normalizePhone = (value?: string | number | null): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const stringValue =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? value.toString()
        : String(value ?? "");

  if (!stringValue) {
    return undefined;
  }

  const digits = stringValue.replace(/[^0-9+]/g, "");
  return digits.length > 0 ? digits : undefined;
};

const pushUniqueError = (metadata: InternalMetadata, error: ErrorType) => {
  if (!metadata.errors.includes(error)) {
    metadata.errors.push(error);
  }
};

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const isPointInPolygon = (
  point: Position,
  geometry: Polygon | MultiPolygon
): boolean => {
  if (geometry.type === "Polygon") {
    return isPointInSinglePolygon(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) =>
    isPointInSinglePolygon(point, polygon)
  );
};

const isPointInSinglePolygon = (
  point: Position,
  polygon: Position[][]
): boolean => {
  const [x, y] = point;
  const exterior = polygon[0] ?? [];
  let inside = false;

  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i, i += 1) {
    const [xi, yi] = exterior[i] ?? [0, 0];
    const [xj, yj] = exterior[j] ?? [0, 0];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  if (!inside) {
    return false;
  }

  for (let ringIndex = 1; ringIndex < polygon.length; ringIndex += 1) {
    const ring = polygon[ringIndex] ?? [];
    let inHole = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i] ?? [0, 0];
      const [xj, yj] = ring[j] ?? [0, 0];
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
      if (intersect) {
        inHole = !inHole;
      }
    }
    if (inHole) {
      return false;
    }
  }

  return true;
};

const resolveStartDate = (row: SheetSubmissionRow): Date | undefined => {
  return (
    parseDate(row.start) ??
    parseDate(row.starttime) ??
    combineDateAndTime(row["Submission Date"], row["Submission Time"])
  );
};

const resolveEndDate = (row: SheetSubmissionRow, start?: Date): Date | undefined => {
  const direct = parseDate(row.end) ?? parseDate(row.endtime);
  if (direct) {
    return direct;
  }
  if (start) {
    const durationMinutes = row["Interview Length (mins)"] ?? 0;
    const computed = new Date(start.getTime() + Math.max(durationMinutes, 0) * 60000);
    if (!Number.isNaN(computed.getTime())) {
      return computed;
    }
  }
  return undefined;
};

const getLatitude = (row: SheetSubmissionRow): number | undefined => {
  return (
    toFiniteNumber(row.Latitude) ?? toFiniteNumber(row["_A5. GPS Coordinates_latitude"])
  );
};

const getLongitude = (row: SheetSubmissionRow): number | undefined => {
  return (
    toFiniteNumber(row.Longitude) ?? toFiniteNumber(row["_A5. GPS Coordinates_longitude"])
  );
};

const resolveReportedPhone = (row: SheetSubmissionRow): string | undefined => {
  return (
    normalizePhone(row.Resp_No) ?? normalizePhone(row["Respondent phone number"])
  );
};

const resolveDeviceId = (row: SheetSubmissionRow): string | undefined => {
  return row.deviceid ?? row.username ?? row["A1. Enumerator ID"] ?? undefined;
};

const resolveUsername = (row: SheetSubmissionRow): string => {
  return (
    row.username ??
    row["Enumerator Name"] ??
    row["Interviewer Name"] ??
    row["A1. Enumerator ID"] ??
    "Unknown"
  );
};

const evaluateGeotag = (
  record: DerivedRecord,
  options: QualityCheckOptions
) => {
  const { lat, lng, row, metadata } = record;
  const { lgaBoundaries } = options;

  if (
    lat === undefined ||
    lng === undefined ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    !lgaBoundaries ||
    !Array.isArray(lgaBoundaries.features)
  ) {
    return;
  }

  const point: Position = [lng, lat];
  let matchedFeature: Feature<Geometry, Record<string, unknown>> | undefined;

  for (const feature of lgaBoundaries.features) {
    const geometry = feature.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
      continue;
    }

    if (isPointInPolygon(point, geometry as Polygon | MultiPolygon)) {
      matchedFeature = feature;
      break;
    }
  }

  if (!matchedFeature) {
    pushUniqueError(metadata, "Outside LGA Boundary");
    metadata.geotagStatus = "Not on map";
    return;
  }

  const properties = matchedFeature.properties ?? {};
  const actualState =
    (typeof properties.statename === "string" && properties.statename) ||
    (typeof properties.State === "string" && properties.State) ||
    undefined;
  const actualLga =
    (typeof properties.lganame === "string" && properties.lganame) ||
    (typeof properties.LGA === "string" && properties.LGA) ||
    undefined;

  metadata.actualState = actualState;
  metadata.actualLGA = actualLga;

  const reportedState = row.State?.toUpperCase();
  const reportedLga = row["A3. select the LGA"]?.toUpperCase();

  if (actualState && actualLga && reportedState && reportedLga) {
    const stateMatch = actualState.toUpperCase() === reportedState;
    const lgaMatch = actualLga.toUpperCase() === reportedLga;

    if (stateMatch && lgaMatch) {
      metadata.geotagStatus = "Within reported LGA";
      return;
    }

    if (stateMatch && !lgaMatch) {
      metadata.geotagStatus = "Within same state, different LGA";
      pushUniqueError(metadata, "Outside LGA Boundary");
      return;
    }

    metadata.geotagStatus = "Within different state";
    pushUniqueError(metadata, "Outside LGA Boundary");
    return;
  }

  metadata.geotagStatus = "Located";
};

export const applyQualityChecks = (
  submissions: SheetSubmissionRow[],
  options: QualityCheckOptions = {}
): ProcessedSubmissionRow[] => {
  const clusterRadius = options.clusterRadiusMeters ?? DEFAULT_CLUSTER_RADIUS_METERS;

  const phoneCounts = new Map<string, number>();
  const deviceSessions = new Map<string, Map<string, DerivedRecord[]>>();
  const recordsByUsername = new Map<string, DerivedRecord[]>();

  const records: DerivedRecord[] = submissions.map((row) => {
    const start = resolveStartDate(row);
    const end = resolveEndDate(row, start);
    const lat = getLatitude(row);
    const lng = getLongitude(row);
    const phone = resolveReportedPhone(row);
    const deviceId = resolveDeviceId(row);
    const username = resolveUsername(row);

    if (phone) {
      phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
    }

    const metadata: InternalMetadata = {
      errors: [],
      clusteredWith: new Set<string>(),
      proximityDistance: Number.POSITIVE_INFINITY,
    };

    const record: DerivedRecord = {
      row,
      start,
      end,
      lat,
      lng,
      phone,
      deviceId,
      username,
      metadata,
    };

    if (deviceId && start) {
      const dateKey = start.toISOString().split("T")[0] ?? undefined;
      record.dateKey = dateKey;
      const byDevice = deviceSessions.get(deviceId) ?? new Map<string, DerivedRecord[]>();
      if (!deviceSessions.has(deviceId)) {
        deviceSessions.set(deviceId, byDevice);
      }
      const byDate = byDevice.get(dateKey ?? "") ?? [];
      if (!byDevice.has(dateKey ?? "")) {
        byDevice.set(dateKey ?? "", byDate);
      }
      byDate.push(record);
    }

    const userRecords = recordsByUsername.get(username) ?? [];
    if (!recordsByUsername.has(username)) {
      recordsByUsername.set(username, userRecords);
    }
    userRecords.push(record);

    return record;
  });

  for (const byDevice of deviceSessions.values()) {
    for (const sessionRecords of byDevice.values()) {
      sessionRecords.sort((a, b) => {
        const aTime = a.start?.getTime() ?? 0;
        const bTime = b.start?.getTime() ?? 0;
        return aTime - bTime;
      });
    }
  }

  for (const record of records) {
    const { row, metadata, lat, lng, phone, deviceId, dateKey, start } = record;

    const hasGpsString = typeof row["A5. GPS Coordinates"] === "string" && row["A5. GPS Coordinates"]!.trim().length > 0;
    const hasCoordinates =
      lat !== undefined &&
      lng !== undefined &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);

    if (!hasGpsString && !hasCoordinates) {
      pushUniqueError(metadata, "Terminated");
      continue;
    }

    const duration = row["Interview Length (mins)"] ?? 0;
    if (duration < 10) {
      pushUniqueError(metadata, "Low LOI");
    }
    if (duration > 60) {
      pushUniqueError(metadata, "High LOI");
    }

    if (start) {
      const hour = start.getHours();
      if (hour < 7 || hour > 20) {
        pushUniqueError(metadata, "OddHour");
      }
    }

    if (phone && (phoneCounts.get(phone) ?? 0) > 1) {
      pushUniqueError(metadata, "DuplicatePhone");
    }

    if (deviceId && start && dateKey) {
      const dailySessions = deviceSessions.get(deviceId)?.get(dateKey);
      if (dailySessions && dailySessions.length > 1) {
        const index = dailySessions.indexOf(record);
        if (index > 0) {
          const previous = dailySessions[index - 1];
          const previousEnd =
            previous.end ??
            (previous.start
              ? new Date(
                  previous.start.getTime() +
                    Math.max(previous.row["Interview Length (mins)"] ?? 0, 0) * 60000
                )
              : undefined);
          if (previousEnd && !Number.isNaN(previousEnd.getTime())) {
            const diffMinutes = (start.getTime() - previousEnd.getTime()) / 60000;
            if (!Number.isNaN(diffMinutes)) {
              if (diffMinutes < 0) {
                pushUniqueError(metadata, "Interwoven");
              } else if (diffMinutes < 1) {
                pushUniqueError(metadata, "ShortGap");
              }
            }
          }
        }
      }
    }

    if (lat !== undefined && lng !== undefined) {
      evaluateGeotag(record, options);
    }
  }

  for (const recordsForUser of recordsByUsername.values()) {
    for (let i = 0; i < recordsForUser.length; i += 1) {
      const current = recordsForUser[i];
      const { lat: lat1, lng: lng1 } = current;
      if (
        lat1 === undefined ||
        lng1 === undefined ||
        Number.isNaN(lat1) ||
        Number.isNaN(lng1)
      ) {
        continue;
      }
      for (let j = i + 1; j < recordsForUser.length; j += 1) {
        const other = recordsForUser[j];
        const { lat: lat2, lng: lng2 } = other;
        if (
          lat2 === undefined ||
          lng2 === undefined ||
          Number.isNaN(lat2) ||
          Number.isNaN(lng2)
        ) {
          continue;
        }
        const distance = calculateDistance(lat1, lng1, lat2, lng2);
        if (distance <= clusterRadius) {
          current.metadata.clusteredWith.add(other.row["Submission ID"]);
          other.metadata.clusteredWith.add(current.row["Submission ID"]);
          current.metadata.proximityDistance = Math.min(
            current.metadata.proximityDistance,
            distance
          );
          other.metadata.proximityDistance = Math.min(
            other.metadata.proximityDistance,
            distance
          );
        }
      }
    }
  }

  for (const record of records) {
    if (record.metadata.clusteredWith.size > 0) {
      pushUniqueError(record.metadata, "ClusteredInterview");
    }
  }

  return records.map((record) => {
    const uniqueErrors = [...record.metadata.errors];
    const isValid = uniqueErrors.length === 0;
    const proximity = Number.isFinite(record.metadata.proximityDistance)
      ? record.metadata.proximityDistance
      : null;

    const baseRow: SheetSubmissionRow = {
      ...record.row,
      "Error Flags": uniqueErrors,
      "Approval Status": isValid ? "Approved" : "Not Approved",
      "Outcome Status": isValid ? "Valid" : "Invalid",
    };

    if (
      typeof (baseRow as Record<string, unknown>).Approval !== "string" ||
      !String((baseRow as Record<string, unknown>).Approval).trim()
    ) {
      (baseRow as Record<string, unknown>).Approval = isValid
        ? "Approved"
        : "Not Approved";
    }

    const qualityMetadata: SubmissionQualityMetadata = {
      errors: uniqueErrors,
      isValid,
      geotagStatus: record.metadata.geotagStatus,
      actualState: record.metadata.actualState,
      actualLGA: record.metadata.actualLGA,
      clusteredWithIds: Array.from(record.metadata.clusteredWith),
      proximityDistanceMeters: proximity,
    };

    return {
      ...baseRow,
      qualityMetadata,
    };
  });
};
