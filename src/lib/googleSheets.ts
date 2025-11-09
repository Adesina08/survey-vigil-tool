import type {
  AgeGroup,
  ApprovalStatus,
  ErrorType,
  Gender,
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "@/data/sampleData";

const GVIZ_PREFIX = "google.visualization.Query.setResponse(";
const GVIZ_SUFFIX = ");";

interface GVizColumn {
  id: string;
  label: string;
}

interface GVizCell {
  v?: unknown;
  f?: string;
}

interface GVizRow {
  c: GVizCell[];
}

interface GVizResponse {
  status: string;
  table: {
    cols: GVizColumn[];
    rows: GVizRow[];
  };
}

const parseGVizResponse = (rawText: string): Record<string, unknown>[] => {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith(GVIZ_PREFIX) || !trimmed.endsWith(GVIZ_SUFFIX)) {
    throw new Error("Unexpected Google Sheets response format");
  }

  const jsonText = trimmed.slice(GVIZ_PREFIX.length, -GVIZ_SUFFIX.length);
  const parsed = JSON.parse(jsonText) as GVizResponse;

  if (parsed.status !== "ok") {
    throw new Error("Google Sheets request failed");
  }

  const headers = parsed.table.cols.map((column, index) => {
    const baseLabel = column.label?.trim() ?? column.id?.trim();
    return baseLabel && baseLabel.length > 0 ? baseLabel : `Column ${index + 1}`;
  });

  return parsed.table.rows.map((row) => {
    const record: Record<string, unknown> = {};

    row.c.forEach((cell, index) => {
      const header = headers[index] ?? `Column ${index + 1}`;
      record[header] = parseGVizCellValue(cell);
    });

    return record;
  });
};

const parseGVizCellValue = (cell?: GVizCell): unknown => {
  if (!cell || cell.v === null || cell.v === undefined) {
    return null;
  }

  const rawValue = cell.v;

  if (typeof rawValue === "string") {
    if (rawValue.startsWith("Date(") && rawValue.endsWith(")")) {
      const isoDate = convertGVizDate(rawValue);
      return isoDate ?? cell.f ?? null;
    }
    return rawValue;
  }

  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return rawValue;
  }

  if (cell.f) {
    return cell.f;
  }

  return rawValue;
};

const convertGVizDate = (value: string): string | null => {
  const match = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if (!match) {
    return null;
  }

  const [year, month, day, hour = "0", minute = "0", second = "0"] = match
    .slice(1)
    .map((part) => Number.parseInt(part ?? "0", 10));

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

interface FetchSheetOptions {
  spreadsheetId: string;
  sheetName?: string;
  query?: string;
}

export const fetchGoogleSheetRows = async ({
  spreadsheetId,
  sheetName,
  query,
}: FetchSheetOptions): Promise<Record<string, unknown>[]> => {
  const params = new URLSearchParams({
    tqx: "out:json",
  });

  if (sheetName) {
    params.set("sheet", sheetName);
  }

  if (query) {
    params.set("tq", query);
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
  }

  const rawText = await response.text();
  return parseGVizResponse(rawText);
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || value instanceof Date) {
    return `${value}`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    if (cleaned.length === 0) {
      return undefined;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

const parseDateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

const padNumber = (value: number): string => value.toString().padStart(2, "0");

const formatDatePart = (date: Date): string => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
};

const formatTimePart = (date: Date): string => {
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  return `${hours}:${minutes}`;
};

const determineAgeGroup = (age?: number): AgeGroup => {
  if (typeof age !== "number" || Number.isNaN(age) || age <= 0) {
    return "Unknown";
  }

  if (age < 26) return "18-25";
  if (age < 36) return "26-35";
  if (age < 46) return "36-45";
  return "46+";
};

const normaliseAgeGroupLabel = (value: string): AgeGroup => {
  const formatted = value.trim();
  const allowed: AgeGroup[] = ["18-25", "26-35", "36-45", "46+", "Unknown"];
  return allowed.includes(formatted as AgeGroup) ? (formatted as AgeGroup) : "Unknown";
};

const normaliseGender = (value: unknown): Gender => {
  const text = toStringValue(value).toLowerCase();
  if (text === "male" || text === "m") {
    return "Male";
  }
  if (text === "female" || text === "f") {
    return "Female";
  }
  return "Unknown";
};

const parseErrorFlags = (value: unknown): ErrorType[] => {
  const allowed: ErrorType[] = [
    "OddHour",
    "Low LOI",
    "High LOI",
    "Outside LGA Boundary",
    "DuplicatePhone",
    "Interwoven",
    "ShortGap",
    "ClusteredInterview",
    "Terminated",
  ];

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => toStringValue(entry))
      .filter((entry): entry is ErrorType => allowed.includes(entry as ErrorType));
  }

  const text = toStringValue(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((entry): entry is ErrorType => allowed.includes(entry as ErrorType));
};

const parseCoordinatePair = (
  value: string
): { lat: number; lng: number } | undefined => {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(/[\s,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 2) {
    return undefined;
  }

  const lat = Number.parseFloat(parts[0]);
  const lng = Number.parseFloat(parts[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return undefined;
  }

  return { lat, lng };
};

interface SubmissionMappingOptions {
  defaultState?: string;
}

export const mapSheetRowsToSubmissions = (
  rows: Record<string, unknown>[],
  { defaultState }: SubmissionMappingOptions = {}
): SheetSubmissionRow[] => {
  return rows
    .map((row) => {
      const submissionId =
        toStringValue(row["Submission ID"]) ||
        toStringValue(row["_id"]) ||
        toStringValue(row["_uuid"]) ||
        `${Date.now()}`;

      const startDate = parseDateValue(row["start"]) ?? parseDateValue(row["Submission Start"]);
      const endDate = parseDateValue(row["end"]) ?? parseDateValue(row["Submission End"]);
      const startIso = startDate?.toISOString();
      const endIso = endDate?.toISOString();

      const submissionDateSource =
        parseDateValue(row["Submission Date"]) ??
        parseDateValue(row["A2. Date"]) ??
        parseDateValue(row.today) ??
        startDate ??
        endDate;

      const submissionDateString = submissionDateSource
        ? formatDatePart(submissionDateSource)
        : "";
      const submissionTimeString = startDate
        ? formatTimePart(startDate)
        : submissionDateSource
        ? formatTimePart(submissionDateSource)
        : "";

      const enumeratorId = toStringValue(row["A1. Enumerator ID"]) || "Unknown";
      const enumeratorName =
        toStringValue(row["Enumerator Name"]) ||
        toStringValue(row["Interviewer Name"]) ||
        enumeratorId;
      const username =
        toStringValue(row.username) ||
        toStringValue(row["username"]) ||
        enumeratorId;

      const state = toStringValue(row.State) || defaultState || "Unknown State";
      const lga = toStringValue(row["A3. select the LGA"]) || toStringValue(row.LGA) || "Unknown LGA";

      const age = toNumberValue(row["A8. Age"]) ?? toNumberValue(row["Age"]);
      const ageGroup = determineAgeGroup(age);

      const gender = normaliseGender(row["A7. Sex"] ?? row["Gender"]);

      const deviceid =
        toStringValue(row.deviceid) ||
        toStringValue(row.deviceId) ||
        toStringValue(row.DeviceID) ||
        undefined;
      const imei = toStringValue(row.imei) || undefined;
      const subscriberid = toStringValue(row.subscriberid) || undefined;
      const simserial = toStringValue(row.simserial) || undefined;

      const respondentPhone =
        toStringValue(row["Respondent phone number"]) ||
        toStringValue(row.Resp_No) ||
        toStringValue(row["Phone Number"]) ||
        undefined;

      const approvalRaw = toStringValue(
        row["Approval Status"] ?? row["Outcome Status"] ?? row["A6. Consent to participate"]
      ).toLowerCase();
      const approvalStatus: ApprovalStatus =
        approvalRaw.includes("not") || approvalRaw === "no" || approvalRaw === "0" || approvalRaw === "false"
          ? "Not Approved"
          : "Approved";

      const interviewLength = (() => {
        const explicit = toNumberValue(row["Interview Length (mins)"]);
        if (typeof explicit === "number") {
          return Math.max(Math.round(explicit), 0);
        }

        if (startDate && endDate) {
          const diff = Math.max(0, endDate.getTime() - startDate.getTime());
          return Math.round(diff / 60000);
        }

        return 0;
      })();

      const latitude =
        toNumberValue(row["_A5. GPS Coordinates_latitude"]) ??
        toNumberValue(row["latitude"]) ??
        toNumberValue(row["Latitude"]);
      const longitude =
        toNumberValue(row["_A5. GPS Coordinates_longitude"]) ??
        toNumberValue(row["longitude"]) ??
        toNumberValue(row["Longitude"]);

      const coordinatesText = toStringValue(row["A5. GPS Coordinates"]);
      const parsedCoordinates =
        (!latitude || !longitude) && coordinatesText
          ? parseCoordinatePair(coordinatesText)
          : undefined;

      const resolvedLatitude = latitude ?? parsedCoordinates?.lat;
      const resolvedLongitude = longitude ?? parsedCoordinates?.lng;

      const errorFlags = parseErrorFlags(row["Error Flags"]);

      const submission: SheetSubmissionRow = {
        "Submission ID": submissionId,
        "Submission Date": submissionDateString,
        "Submission Time": submissionTimeString,
        start: startIso,
        end: endIso,
        starttime: startIso,
        endtime: endIso,
        "A1. Enumerator ID": enumeratorId,
        "Enumerator Name": enumeratorName,
        "Interviewer ID": enumeratorId,
        "Interviewer Name": enumeratorName,
        username,
        State: state,
        "A3. select the LGA": lga,
        LGA: lga,
        deviceid,
        imei,
        subscriberid,
        simserial,
        "Age Group": ageGroup,
        Gender: gender,
        "Approval Status": approvalStatus,
        "Error Flags": errorFlags,
        "Interview Length (mins)": interviewLength,
        Resp_No: respondentPhone,
        "Respondent phone number": respondentPhone,
        "A5. GPS Coordinates": coordinatesText || undefined,
        "_A5. GPS Coordinates_latitude": resolvedLatitude ?? 0,
        "_A5. GPS Coordinates_longitude": resolvedLongitude ?? 0,
      };

      if (resolvedLatitude !== undefined) {
        submission.Latitude = resolvedLatitude;
      }
      if (resolvedLongitude !== undefined) {
        submission.Longitude = resolvedLongitude;
      }

      return submission;
    })
    .filter((row) => row["Submission ID"].length > 0);
};

export const mapSheetRowsToStateTargets = (
  rows: Record<string, unknown>[]
): SheetStateTargetRow[] =>
  rows
    .map((row) => {
      const state = toStringValue(row.State);
      const target = toNumberValue(row["State Target"] ?? row.Target);
      if (!state || target === undefined) {
        return null;
      }
      return { State: state, "State Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateTargetRow => entry !== null);

export const mapSheetRowsToStateAgeTargets = (
  rows: Record<string, unknown>[]
): SheetStateAgeTargetRow[] =>
  rows
    .map((row) => {
      const state = toStringValue(row.State);
      const ageGroup = normaliseAgeGroupLabel(toStringValue(row["Age Group"] ?? row.Group));
      const target = toNumberValue(row["Age Group Target"] ?? row.Target);
      if (!state || !ageGroup || target === undefined) {
        return null;
      }
      return { State: state, "Age Group": ageGroup, "Age Group Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateAgeTargetRow => entry !== null);

export const mapSheetRowsToStateGenderTargets = (
  rows: Record<string, unknown>[]
): SheetStateGenderTargetRow[] =>
  rows
    .map((row) => {
      const state = toStringValue(row.State);
      const gender = normaliseGender(row.Gender ?? row.Group);
      const target = toNumberValue(row["Gender Target"] ?? row.Target);
      if (!state || !gender || target === undefined) {
        return null;
      }
      return { State: state, Gender: gender, "Gender Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateGenderTargetRow => entry !== null);
