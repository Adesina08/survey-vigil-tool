// server/dashboard.ts
import { readFile } from "node:fs/promises";
import { fetchGoogleSheetFromUrl, mapSheetRowsToSubmissions } from "../src/lib/googleSheets";
import {
  buildDashboardData,
  type DashboardData,
  type LGACatalogEntry,
} from "../src/lib/dashboardData";
import type { FeatureCollection } from "geojson";
import type {
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "../src/data/sampleData";

// ----------- SINGLE-STATE CONFIG -----------
const OGUN_STATE_NAME = "Ogun State";
const OVERALL_STATE_TARGET = 2000;

const AGE_GROUPS = ["15-24", "25-34", "35-44", "45+"] as const;
// -------------------------------------------

const GOOGLE_SHEETS_URL_MISSING_ERROR = "GOOGLE_SHEETS_URL not set";
const GOOGLE_SHEETS_FETCH_ERROR_MESSAGE =
  "Google Sheets URL not reachable or returned no rows. Ensure the sheet is published or publicly viewable.";

const resolveGoogleSheetsUrl = (): string => {
  const envUrl = process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL || "";
  return envUrl.trim();
};

const GEOJSON_PATH = "../public/ogun-lga.geojson";

const normalizeStateName = (state: unknown): string => {
  const value = String(state ?? "").trim();
  if (!value) return OGUN_STATE_NAME;
  if (value.toLowerCase() === "ogun") return OGUN_STATE_NAME;
  return value;
};

const normalizeLgaName = (lga: unknown): string => {
  const value = String(lga ?? "").trim();
  return value || "Unknown LGA";
};

const loadLgaCatalog = async (): Promise<LGACatalogEntry[]> => {
  try {
    const file = await readFile(new URL(GEOJSON_PATH, import.meta.url), "utf8");
    const collection = JSON.parse(file) as FeatureCollection;
    const seen = new Map<string, LGACatalogEntry>();

    for (const feature of collection.features ?? []) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const state = normalizeStateName(
        properties["statename"] ?? properties["state"] ?? properties["State"]
      );
      const lga = normalizeLgaName(
        properties["lganame"] ?? properties["lga"] ?? properties["LGA"]
      );

      const key = `${state}|${lga}`;
      if (!seen.has(key)) {
        seen.set(key, {
          state,
          lga,
          properties: Object.keys(properties).length > 0 ? { ...properties } : {},
        });
      }
    }

    return Array.from(seen.values());
  } catch (error) {
    console.error("Failed to load LGA GeoJSON catalog", error);
    return [];
  }
};

/* ----------------- HELPERS ----------------- */
function toCleanString(v: unknown): string {
  return String(v ?? "").replace(/<[^>]*>/g, "").trim();
}
function toNumberOrNull(v: unknown): number | null {
  const n = Number(toCleanString(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
// Excel serial → Date (days since 1899-12-30)
function fromExcelSerial(n: unknown): Date | null {
  const num = typeof n === "number" ? n : Number(String(n).match(/^\d{3,5}/)?.[0]);
  if (!Number.isFinite(num)) return null;
  const ms = (num - 25569) * 86400000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}
function parseDateFlexible(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = toCleanString(v);
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const serial = fromExcelSerial(s);
  return serial ?? null;
}

function bucketAge(value: unknown): SheetSubmissionRow["Age Group"] {
  const n = toNumberOrNull(value);
  if (n == null || n < 15) return "45+"; // keep within defined buckets (change to "Unknown" if you prefer)
  if (n <= 24) return "15-24";
  if (n <= 34) return "25-34";
  if (n <= 44) return "35-44";
  return "45+";
}
type PresentGender = "Male" | "Female";
function normalizeGender(value: unknown): PresentGender | null {
  const raw = toCleanString(value).toLowerCase();
  if (raw === "male" || raw === "m") return "Male";
  if (raw === "female" || raw === "f") return "Female";
  return null; // << do NOT bucket into a default — only keep genders that truly exist
}

const KNOWN_LGAS = new Set<string>([
  "Abeokuta North",
  "Abeokuta South",
  // add more if needed
]);
function cleanLGA(v: unknown): string {
  const s = toCleanString(v);
  if (!s) return "Unknown LGA";
  if (s.length > 200 || s.split(",").length > 6) return "Unknown LGA"; // kill header-leaks
  if (KNOWN_LGAS.size && KNOWN_LGAS.has(s)) return s;
  return s;
}

/* ---------------- ENRICHMENT ---------------- */
function enrichSubmissionRows(rows: SheetSubmissionRow[]): SheetSubmissionRow[] {
  return rows.map((r) => {
    const copy: any = { ...r };

    // Force single-state
    copy.State = OGUN_STATE_NAME;

    // LGA
    const lgaRaw = (r as any)["A3. select the LGA"] ?? (r as any)["A3"] ?? (r as any)["a3_select_the_lga"];
    copy["A3. select the LGA"] = cleanLGA(lgaRaw);
    copy.LGA = copy["A3. select the LGA"];

    // Gender — only keep Male/Female if present; else leave undefined (so it won't display)
    const g = normalizeGender((r as any)["A7. Sex"] ?? (r as any)["A7"]);
    if (g) copy.Gender = g; else delete copy.Gender;

    // Age group
    copy["Age Group"] = bucketAge((r as any)["A8. Age"] ?? (r as any)["A8"]);

    // Dates (normalize to help lastUpdated and analysis rows)
    const dt =
      parseDateFlexible((r as any)["_submission_time"]) ||
      parseDateFlexible((r as any)["today"]) ||
      parseDateFlexible((r as any)["start"]) ||
      parseDateFlexible((r as any)["end"]) ||
      parseDateFlexible((r as any)["A2. Date"]) ||
      null;

    if (dt) {
      copy._submission_time = dt.toISOString();
      copy.today = dt.toISOString();
      copy["Submission Date"] = dt.toISOString().slice(0, 10);
      copy["Submission Time"] = dt.toTimeString().slice(0, 5);
      const s = parseDateFlexible((r as any)["start"]);
      const e = parseDateFlexible((r as any)["end"]);
      if (s) copy.start = s.toISOString();
      if (e) copy.end = e.toISOString();
    } else {
      copy["Submission Date"] = "";
      copy["Submission Time"] = "";
    }

    // MAP COORDINATES: use ONLY these two columns per your spec
    // LAT:  _A5. GPS Coordinates_latitude
    // LNG:  _A5. GPS Coordinates_longitude
    const lat = toNumberOrNull((r as any)["_A5. GPS Coordinates_latitude"]);
    const lng = toNumberOrNull((r as any)["_A5. GPS Coordinates_longitude"]);

    if (lat != null && lng != null && Math.abs(lat) > 0 && Math.abs(lng) > 0) {
      copy["_A5. GPS Coordinates_latitude"] = lat;
      copy["_A5. GPS Coordinates_longitude"] = lng;
      // Optional: keep string form too
      copy["A5. GPS Coordinates"] = `${lat}, ${lng}`;
    } else {
      // hide 0,0 or missing points
      delete copy["_A5. GPS Coordinates_latitude"];
      delete copy["_A5. GPS Coordinates_longitude"];
      copy["A5. GPS Coordinates"] = "";
    }

    return copy as SheetSubmissionRow;
  });
}

/* ----------------- TARGETS ----------------- */
// Build gender targets ONLY for genders present in the data
function buildFallbackTargets(presentGenders: PresentGender[]) {
  const stateTargets: SheetStateTargetRow[] = [
    { State: OGUN_STATE_NAME, "State Target": OVERALL_STATE_TARGET },
  ];

  // Age targets (still divide equally across defined age groups)
  const perAge = Math.round(OVERALL_STATE_TARGET / AGE_GROUPS.length);
  const stateAgeTargets: SheetStateAgeTargetRow[] = AGE_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    "Age Group": g,
    "Age Group Target": perAge,
  }));

  // Gender targets only for genders we actually saw
  const denom = Math.max(1, presentGenders.length);
  const perGender = Math.round(OVERALL_STATE_TARGET / denom);
  const stateGenderTargets: SheetStateGenderTargetRow[] = presentGenders.map((g) => ({
    State: OGUN_STATE_NAME,
    Gender: g,
    "Gender Target": perGender,
  }));

  return { stateTargets, stateAgeTargets, stateGenderTargets };
}

/* ----------------- LOADERS ----------------- */
export const loadSubmissionRows = async (): Promise<SheetSubmissionRow[]> => {
  const googleSheetsUrl = resolveGoogleSheetsUrl();
  if (!googleSheetsUrl) throw new Error(GOOGLE_SHEETS_URL_MISSING_ERROR);

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = await fetchGoogleSheetFromUrl(googleSheetsUrl);
  } catch (error) {
    console.error("Failed to fetch Google Sheets data:", error);
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }
  if (!rawRows || rawRows.length === 0) throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);

  const submissions = mapSheetRowsToSubmissions(rawRows, { defaultState: OGUN_STATE_NAME });
  return enrichSubmissionRows(submissions);
};

export const loadDashboardData = async (): Promise<DashboardData> => {
  const submissions = await loadSubmissionRows();
  if (!submissions || submissions.length === 0) {
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }

  const lgaCatalog = await loadLgaCatalog();

  // Derive genders present from the data (Male/Female only)
  const genderSet = new Set<PresentGender>();
  for (const row of submissions as any[]) {
    const g = row.Gender as PresentGender | undefined;
    if (g === "Male" || g === "Female") genderSet.add(g);
  }
  const presentGenders = Array.from(genderSet);

  const { stateTargets, stateAgeTargets, stateGenderTargets } = buildFallbackTargets(presentGenders);

  return buildDashboardData({
    submissions,
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
    analysisRows: submissions,
    lgaCatalog,
  });
};
