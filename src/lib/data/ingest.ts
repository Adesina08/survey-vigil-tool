import type { MapSubmission, QCStatus } from "@/types/submission";

export const readNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(/,/g, "."));
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const readString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
};

const APPROVED_VALUES = new Set([
  "approved",
  "valid",
  "true",
  "1",
  "yes",
  "ok",
]);

const NOT_APPROVED_VALUES = new Set([
  "not approved",
  "invalid",
  "false",
  "0",
  "no",
  "cancelled",
]);

export const interpretApprovalStatus = (value: unknown): QCStatus => {
  const normalized = readString(value).toLowerCase();
  if (APPROVED_VALUES.has(normalized)) return "approved";
  if (NOT_APPROVED_VALUES.has(normalized)) return "not_approved";
  return normalized.includes("not") || normalized.includes("cancel") ? "not_approved" : "approved";
};

const parseCoordinatePair = (value: unknown): [number | null, number | null] => {
  if (Array.isArray(value)) {
    const [latRaw, lngRaw] = value;
    return [readNumber(latRaw), readNumber(lngRaw)];
  }

  const stringValue = readString(value);
  if (!stringValue) return [null, null];

  const parts = stringValue.split(/[;,]/).map((part) => part.trim());
  if (parts.length >= 2) {
    const lat = readNumber(parts[0]);
    const lng = readNumber(parts[1]);
    return [lat, lng];
  }

  return [null, null];
};

const gpsPrefixes = ["_A5. GPS Coordinates", "gps", "geolocation"];

const resolveField = (record: Record<string, unknown>, candidates: string[]): unknown => {
  for (const candidate of candidates) {
    if (candidate in record) {
      return record[candidate];
    }
  }
  return undefined;
};

export const extractCoordinates = (record: Record<string, unknown>): [number | null, number | null] => {
  const latitudeCandidates = ["Latitude", "latitude", "lat", "Lat"];
  const longitudeCandidates = ["Longitude", "longitude", "lng", "Lon", "long"];

  const latValue = resolveField(record, latitudeCandidates);
  const lngValue = resolveField(record, longitudeCandidates);
  const pairValue = resolveField(record, ["coordinates", "location", "gps"]);

  if (latValue !== undefined || lngValue !== undefined) {
    return [readNumber(latValue), readNumber(lngValue)];
  }

  if (pairValue !== undefined) {
    return parseCoordinatePair(pairValue);
  }

  for (const prefix of gpsPrefixes) {
    const latKey = `${prefix}_latitude`;
    const lngKey = `${prefix}_longitude`;
    if (latKey in record || lngKey in record) {
      return [readNumber(record[latKey]), readNumber(record[lngKey])];
    }
  }

  return [null, null];
};

const parseErrorTypes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readString(entry))
      .filter((entry) => entry.length > 0);
  }

  const stringValue = readString(value);
  if (!stringValue) return [];

  return stringValue
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

interface NormalizeOptions {
  idField?: string;
  statusField?: string;
  interviewerIdField?: string;
  interviewerNameField?: string;
  stateField?: string;
  lgaField?: string;
  errorField?: string;
  timestampField?: string;
}

export interface NormalizedDataset {
  submissions: MapSubmission[];
  interviewers: string[];
  errorTypes: string[];
}

export const buildNormalizedDataset = (
  rows: Array<Record<string, unknown>>,
  options: NormalizeOptions = {},
): NormalizedDataset => {
  const submissions: MapSubmission[] = [];
  const interviewerSet = new Set<string>();
  const errorTypeSet = new Set<string>();

  rows.forEach((row, index) => {
    const [lat, lng] = extractCoordinates(row);
    const statusValue = options.statusField ? row[options.statusField] : row.status ?? row.qcStatus;
    const status = interpretApprovalStatus(statusValue);
    const idRaw = options.idField ? row[options.idField] : row.instanceID ?? row.id ?? index + 1;
    const id = readString(idRaw) || `submission-${index + 1}`;
    const interviewerIdValue = options.interviewerIdField ? row[options.interviewerIdField] : row.interviewerId ?? row.enumeratorId;
    const interviewerId = readString(interviewerIdValue) || "Unknown";
    const interviewerNameValue = options.interviewerNameField ? row[options.interviewerNameField] : row.interviewerName ?? row.enumeratorName;
    const interviewerName = readString(interviewerNameValue);
    const stateValue = options.stateField ? row[options.stateField] : row.state ?? row.State;
    const lgaValue = options.lgaField ? row[options.lgaField] : row.lga ?? row.LGA;
    const timestampValue = options.timestampField ? row[options.timestampField] : row.timestamp ?? row.start ?? row.end;
    const errorValue = options.errorField ? row[options.errorField] : row.errorTypes ?? row.errors ?? row.flags;

    const errorTypes = parseErrorTypes(errorValue);
    errorTypes.forEach((error) => errorTypeSet.add(error));

    submissions.push({
      id,
      lat,
      lng,
      interviewerId,
      interviewerName,
      state: readString(stateValue) || "Unknown",
      lga: readString(lgaValue) || "Unknown",
      errorTypes,
      timestamp: readString(timestampValue) || new Date().toISOString(),
      status,
    });

    interviewerSet.add(interviewerId);
  });

  return {
    submissions,
    interviewers: Array.from(interviewerSet).sort((a, b) => a.localeCompare(b)),
    errorTypes: Array.from(errorTypeSet).sort((a, b) => a.localeCompare(b)),
  };
};
