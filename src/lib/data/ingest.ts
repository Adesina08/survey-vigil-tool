import type { MapSubmission, ErrorType, QCStatus } from "@/types/submission";

const TRUTHY_VALUES = new Set([
  "approved",
  "valid",
  "true",
  "1",
  "yes",
  "y",
  "ok",
]);

const FALSY_VALUES = new Set([
  "not approved",
  "notapproved",
  "invalid",
  "false",
  "0",
  "no",
  "n",
  "cancelled",
  "force cancelled",
]);

const ERROR_TYPES: ErrorType[] = [
  "Low LOI",
  "High LOI",
  "OddHour",
  "DuplicatePhone",
  "Interwoven",
  "ShortGap",
  "Terminated",
  "Force Cancelled",
  "Outside LGA Boundary",
  "ClusteredInterview",
];

const STATUS_KEYS = [
  "qcStatus",
  "status",
  "qc_status",
  "approvalStatus",
  "Approval Status",
  "Approved",
  "approved",
  "valid",
];

const ID_KEYS = [
  "instanceID",
  "instance_id",
  "id",
  "ID",
  "_id",
  "_uuid",
  "uuid",
  "submissionId",
  "submission_id",
  "name",
];

const INTERVIEWER_ID_KEYS = [
  "interviewerId",
  "interviewer_id",
  "enumeratorId",
  "enumerator_id",
  "enumerator",
  "Enumerator ID",
];

const INTERVIEWER_NAME_KEYS = [
  "interviewerName",
  "interviewer_name",
  "enumeratorName",
  "enumerator_name",
  "enumerator",
  "Enumerator",
];

const LGA_KEYS = [
  "A3. select the LGA",
  "A3. select the LGA (text)",
  "lga",
  "LGA",
];

const STATE_KEYS = ["state", "State", "A2. select the state"];

const TIMESTAMP_KEYS = [
  "timestamp",
  "submissionTime",
  "endtime",
  "end",
  "starttime",
  "start",
  "_submission_time",
];

const DEVICE_ID_KEYS = ["deviceId", "device_id", "deviceid"];

const PHONE_KEYS = ["phone", "Phone", "respondent_phone", "phoneNumber"];

const START_TIME_KEYS = ["starttime", "start_time", "start", "Start"];

const END_TIME_KEYS = ["endtime", "end_time", "end", "End"];

const DURATION_KEYS = ["durationMinutes", "duration_minutes", "duration", "Duration"];

const ERROR_KEYS = ["errorTypes", "errors", "flags", "qcFlags", "qc_flags"];

const LAT_LNG_COMBINED_KEYS = ["gps", "coordinates", "location", "_geolocation"];

const LATITUDE_KEYS = [
  "_A5. GPS Coordinates_latitude",
  "Latitude",
  "latitude",
  "lat",
  "Lat",
];

const LONGITUDE_KEYS = [
  "_A5. GPS Coordinates_longitude",
  "Longitude",
  "longitude",
  "lng",
  "Lon",
  "long",
];

type Row = Record<string, unknown>;

type ReadCandidate<T> = (value: unknown) => T | null;

function pickFirst<T>(row: Row, keys: string[], reader: ReadCandidate<T>): T | null {
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = reader(row[key]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

const parseStringValue: ReadCandidate<string> = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
};

const parseNumberValue: ReadCandidate<number> = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const normalized = cleaned.replace(/[^0-9.+-]/g, "");
    if (!normalized) return null;
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export function readString(row: Row, keys: string[]): string | null {
  return pickFirst(row, keys, parseStringValue);
}

export function readNumber(row: Row, keys: string[]): number | null {
  return pickFirst(row, keys, parseNumberValue);
}

export function interpretApprovalStatus(row: Row): boolean | null {
  const statusValue = pickFirst<string | number | boolean>(
    row,
    STATUS_KEYS,
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
        return value > 0 ? true : null;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        if (TRUTHY_VALUES.has(normalized)) return true;
        if (FALSY_VALUES.has(normalized)) return false;
        if (normalized === "approved" || normalized === "valid") return true;
        if (normalized.includes("not") || normalized.includes("cancel")) return false;
      }
      return null;
    },
  );

  if (statusValue === null || statusValue === undefined) return null;
  if (typeof statusValue === "boolean") return statusValue;
  if (typeof statusValue === "number") {
    if (statusValue === 1) return true;
    if (statusValue === 0) return false;
    return statusValue > 0 ? true : null;
  }
  if (typeof statusValue === "string") {
    const normalized = statusValue.trim().toLowerCase();
    if (!normalized) return null;
    if (TRUTHY_VALUES.has(normalized)) return true;
    if (FALSY_VALUES.has(normalized)) return false;
    if (normalized.includes("not") || normalized.includes("cancel")) return false;
    return normalized.length > 0 ? true : null;
  }
  return null;
}

function parseCoordinate(value: unknown): number | null {
  const direct = parseNumberValue(value);
  if (direct !== null) return direct;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[;,\s]+/).filter(Boolean);
    if (parts.length === 1) {
      const numeric = Number.parseFloat(parts[0]);
      return Number.isFinite(numeric) ? numeric : null;
    }
  }
  return null;
}

function readLatLngPair(row: Row, latKey: string, lngKey: string): { lat: number | null; lng: number | null } {
  const lat = latKey in row ? parseCoordinate(row[latKey]) : null;
  const lng = lngKey in row ? parseCoordinate(row[lngKey]) : null;
  return { lat, lng };
}

export function extractLatLng(row: Row): { lat: number | null; lng: number | null } {
  const latLngPair = readLatLngPair(row, "_A5. GPS Coordinates_latitude", "_A5. GPS Coordinates_longitude");
  if (latLngPair.lat !== null || latLngPair.lng !== null) {
    return latLngPair;
  }

  for (let index = 0; index < LATITUDE_KEYS.length; index += 1) {
    const latKey = LATITUDE_KEYS[index];
    const lngKey = LONGITUDE_KEYS[index] ?? LONGITUDE_KEYS[LONGITUDE_KEYS.length - 1];
    if (latKey in row || lngKey in row) {
      const { lat, lng } = readLatLngPair(row, latKey, lngKey);
      if (lat !== null || lng !== null) {
        return { lat, lng };
      }
    }
  }

  for (const key of LAT_LNG_COMBINED_KEYS) {
    if (!(key in row)) continue;
    const value = row[key];
    if (Array.isArray(value)) {
      const [latValue, lngValue] = value;
      const lat = parseCoordinate(latValue);
      const lng = parseCoordinate(lngValue);
      if (lat !== null || lng !== null) {
        return { lat, lng };
      }
    }
    if (typeof value === "string") {
      const parts = value.split(/[;,]/).map((part) => part.trim());
      if (parts.length >= 2) {
        const lat = parseCoordinate(parts[0]);
        const lng = parseCoordinate(parts[1]);
        if (lat !== null || lng !== null) {
          return { lat, lng };
        }
      }
    }
  }

  return { lat: null, lng: null };
}

function normalizeError(value: string): ErrorType | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = ERROR_TYPES.find((item) => item.toLowerCase() === normalized.toLowerCase());
  return match ?? null;
}

function readErrorTypes(row: Row): ErrorType[] {
  const value = pickFirst<unknown>(row, ERROR_KEYS, (entry) => entry ?? null);
  if (!value) return [];

  if (Array.isArray(value)) {
    const errors = value
      .map((item) => (typeof item === "string" ? item : parseStringValue(item)))
      .filter((item): item is string => typeof item === "string");
    const normalized = errors
      .map((item) => normalizeError(item))
      .filter((item): item is ErrorType => Boolean(item));
    return Array.from(new Set(normalized));
  }

  if (typeof value === "string") {
    const items = value.split(/[|;,]/).map((item) => item.trim()).filter(Boolean);
    const normalized = items
      .map((item) => normalizeError(item))
      .filter((item): item is ErrorType => Boolean(item));
    return Array.from(new Set(normalized));
  }

  return [];
}

function resolveId(row: Row): string {
  const id = readString(row, ID_KEYS);
  if (id) return id;
  if ("id" in row && row.id != null) {
    return String(row.id);
  }
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `submission-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveStatus(value: boolean | null): QCStatus {
  if (value === true) return "approved";
  if (value === false) return "not_approved";
  return "approved";
}

export function normalizeRowToSubmission(row: Row): MapSubmission {
  const { lat, lng } = extractLatLng(row);
  const statusValue = interpretApprovalStatus(row);
  const interviewerId =
    readString(row, INTERVIEWER_ID_KEYS) ?? readString(row, INTERVIEWER_NAME_KEYS) ?? "Unknown";
  const interviewerName =
    readString(row, INTERVIEWER_NAME_KEYS) ?? readString(row, INTERVIEWER_ID_KEYS) ?? interviewerId;
  const lga = readString(row, LGA_KEYS) ?? "";
  const state = readString(row, STATE_KEYS) ?? "";
  const timestamp =
    readString(row, TIMESTAMP_KEYS) ?? new Date().toISOString();
  const deviceId = readString(row, DEVICE_ID_KEYS);
  const phone = readString(row, PHONE_KEYS);
  const starttime = readString(row, START_TIME_KEYS);
  const endtime = readString(row, END_TIME_KEYS);
  const durationMinutes = readNumber(row, DURATION_KEYS);

  return {
    id: resolveId(row),
    lat,
    lng,
    interviewerId,
    interviewerName,
    lga,
    state,
    errorTypes: readErrorTypes(row),
    timestamp,
    status: resolveStatus(statusValue),
    deviceId,
    phone,
    starttime,
    endtime,
    durationMinutes,
  };
}
