import { fetchGoogleSheetFromUrl, mapSheetRowsToSubmissions } from "../src/lib/googleSheets";
import { buildDashboardData, type DashboardData } from "../src/lib/dashboardData";
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
const GENDER_GROUPS = ["Male", "Female"] as const;
// -------------------------------------------

const GOOGLE_SHEETS_URL_MISSING_ERROR = "GOOGLE_SHEETS_URL not set";
const GOOGLE_SHEETS_FETCH_ERROR_MESSAGE =
  "Google Sheets URL not reachable or returned no rows. Ensure the sheet is published or publicly viewable.";

const resolveGoogleSheetsUrl = (): string => {
  const envUrl = process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL || "";
  return envUrl.trim();
};

/* ----------------- HELPERS ----------------- */
function toCleanString(v: unknown): string {
  return String(v ?? "").replace(/<[^>]*>/g, "").trim(); // strip HTML spans/tags from headers
}
function toNumberOrNull(v: unknown): number | null {
  const n = Number(toCleanString(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function bucketAge(value: unknown): SheetSubmissionRow["Age Group"] {
  const n = toNumberOrNull(value);
  if (n == null || n < 15) return "45+"; // keep within buckets but you can switch to "Unknown" if desired
  if (n <= 24) return "15-24";
  if (n <= 34) return "25-34";
  if (n <= 44) return "35-44";
  return "45+";
}
function normalizeGender(value: unknown): "Male" | "Female" {
  const raw = toCleanString(value).toLowerCase();
  if (raw === "male" || raw === "m") return "Male";
  if (raw === "female" || raw === "f") return "Female";
  // keep exactly two buckets as you requested
  return "Female";
}

const KNOWN_LGAS = new Set<string>([
  "Abeokuta North",
  "Abeokuta South",
  // add more here if needed
]);

function cleanLGA(v: unknown): string {
  const s = toCleanString(v);
  // Header-row leak detector: very long or many commas → junk
  if (s.split(",").length > 6 || s.length > 200) return "Unknown LGA";
  if (!s) return "Unknown LGA";
  // Prefer known whitelist if you want to be strict
  if (KNOWN_LGAS.size && KNOWN_LGAS.has(s)) return s;
  return s;
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

function coordsFromPacked(s: unknown): { lat: number | null; lng: number | null } {
  const parts = toCleanString(s).split(/\s+|,\s*/).map(Number).filter(Number.isFinite);
  return { lat: (parts[0] as number | undefined) ?? null, lng: (parts[1] as number | undefined) ?? null };
}

function looksLikeHeaderLeak(r: Record<string, any>): boolean {
  const lga = toCleanString(r["A3. select the LGA"] ?? r["A3"] ?? r["a3_select_the_lga"]);
  if (!lga) return false;
  if (lga.length > 200 || lga.includes("H1. Satisfaction with OGSTEP")) return true;
  return false;
}

/* ---------------- ENRICHMENT ---------------- */
function enrichSubmissionRows(rows: SheetSubmissionRow[]): SheetSubmissionRow[] {
  return rows
    .filter((r) => !looksLikeHeaderLeak(r))
    .map((r) => {
      const copy: any = { ...r };

      // Force single-state
      copy.State = OGUN_STATE_NAME;

      // LGA
      copy.LGA = cleanLGA(r["A3. select the LGA"] ?? (r as any)["A3"] ?? (r as any)["a3_select_the_lga"]);

      // Gender / Age
      copy.Gender = normalizeGender((r as any)["A7. Sex"] ?? (r as any)["A7"]);
      copy["Age Group"] = bucketAge((r as any)["A8. Age"] ?? (r as any)["A8"]);

      // Dates: prefer Kobo _submission_time, then today/start/end/A2. Date
      const dt =
        parseDateFlexible((r as any)["_submission_time"]) ||
        parseDateFlexible((r as any)["today"]) ||
        parseDateFlexible((r as any)["start"]) ||
        parseDateFlexible((r as any)["end"]) ||
        parseDateFlexible((r as any)["A2. Date"]) ||
        null;

      if (dt) {
        copy.today = dt.toISOString();
        if (r["start"]) {
          const s = parseDateFlexible(r["start"]);
          if (s) copy.start = s.toISOString();
        }
        if (r["end"]) {
          const e = parseDateFlexible(r["end"]);
          if (e) copy.end = e.toISOString();
        }
      }

      // GPS: prefer separate lat/long; else parse packed; else leave empty (NOT 0,0)
      let lat: number | null = null,
        lng: number | null = null;

      const latCol = (r as any)["_A5. GPS Coordinates_latitude"];
      const lngCol = (r as any)["_A5. GPS Coordinates_longitude"];

      if (latCol != null && lngCol != null) {
        lat = toNumberOrNull(latCol);
        lng = toNumberOrNull(lngCol);
      } else if ((r as any)["A5. GPS Coordinates"]) {
        const p = coordsFromPacked((r as any)["A5. GPS Coordinates"]);
        lat = p.lat;
        lng = p.lng;
      }

      if (lat != null && lng != null) {
        copy["_A5. GPS Coordinates_latitude"] = lat;
        copy["_A5. GPS Coordinates_longitude"] = lng;
        copy["A5. GPS Coordinates"] = `${lat}, ${lng}`;
      } else {
        delete copy["_A5. GPS Coordinates_latitude"];
        delete copy["_A5. GPS Coordinates_longitude"];
        copy["A5. GPS Coordinates"] = "";
      }

      return copy as SheetSubmissionRow;
    });
}

/* ----------------- TARGETS ----------------- */
function buildFallbackTargets() {
  const perAge = Math.round(OVERALL_STATE_TARGET / AGE_GROUPS.length);
  const perGender = Math.round(OVERALL_STATE_TARGET / GENDER_GROUPS.length);

  const stateTargets: SheetStateTargetRow[] = [
    { State: OGUN_STATE_NAME, "State Target": OVERALL_STATE_TARGET },
  ];
  const stateAgeTargets: SheetStateAgeTargetRow[] = AGE_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    "Age Group": g,
    "Age Group Target": perAge,
  }));
  const stateGenderTargets: SheetStateGenderTargetRow[] = GENDER_GROUPS.map((g) => ({
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

  // Map + enrich
  const submissions = mapSheetRowsToSubmissions(rawRows, { defaultState: OGUN_STATE_NAME });
  return enrichSubmissionRows(submissions);
};

export const loadDashboardData = async (): Promise<DashboardData> => {
  const submissions = await loadSubmissionRows();
  if (!submissions || submissions.length === 0) {
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }

  const { stateTargets, stateAgeTargets, stateGenderTargets } = buildFallbackTargets();

  return buildDashboardData({
    submissions,
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
    analysisRows: submissions,
  });
};
