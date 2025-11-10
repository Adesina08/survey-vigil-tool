import {
  sheetSubmissions,
  sheetStateTargets,
  sheetStateAgeTargets,
  sheetStateGenderTargets,
  type SheetSubmissionRow,
  type SheetStateTargetRow,
  type SheetStateAgeTargetRow,
  type SheetStateGenderTargetRow,
  type ErrorType,
} from "@/data/sampleData";
import { applyQualityChecks, type ProcessedSubmissionRow } from "./qualityChecks";
import { normaliseHeaderKey } from "./googleSheets";

export type AnalysisRow = Record<string, unknown>;

interface MapSubmission {
  id: string;
  lat: number | null;
  lng: number | null;
  interviewerId: string;
  interviewerName: string;
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: "approved" | "not_approved";
}

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  latestSubmissionTime?: string | null;
  totalDenominator?: number;
}

interface StatusBreakdown {
  approved: number;
  notApproved: number;
}

interface QuotaLGARow {
  state: string;
  lga: string;
  target: number;
  achieved: number;
  balance: number;
}

interface QuotaLGAAgeRow extends QuotaLGARow {
  ageGroup: string;
}

interface QuotaLGAGenderRow extends QuotaLGARow {
  gender: string;
}

interface ProductivityRow {
  interviewer: string;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  oddHour: number;
  lowLOI: number;
  outsideLGA: number;
  duplicate: number;
  totalErrors: number;
}

interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
}

interface AchievementRow {
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface AchievementByStateRow extends AchievementRow {
  state: string;
}

interface AchievementByInterviewerRow extends AchievementRow {
  interviewer: string;
}

interface AchievementByLGARow extends AchievementRow {
  lga: string;
  state: string;
}

export interface LGACatalogEntry {
  state: string;
  lga: string;
  properties?: Record<string, unknown>;
}

export interface DashboardData {
  summary: SummaryData;
  statusBreakdown: StatusBreakdown;
  quotaProgress: number;
  quotaByLGA: QuotaLGARow[];
  quotaByLGAAge: QuotaLGAAgeRow[];
  quotaByLGAGender: QuotaLGAGenderRow[];
  mapSubmissions: MapSubmission[];
  userProductivity: ProductivityRow[];
  errorBreakdown: ErrorBreakdownRow[];
  achievements: {
    byState: AchievementByStateRow[];
    byInterviewer: AchievementByInterviewerRow[];
    byLGA: AchievementByLGARow[];
  };
  filters: {
    lgas: string[];
    interviewers: string[];
    errorTypes: string[];
  };
  lastUpdated: string;
  analysisRows: AnalysisRow[];
  lgaCatalog: LGACatalogEntry[];
}

const parseDate = (date: string, time: string) => new Date(`${date}T${time}:00Z`);

const incrementMap = (map: Map<string, number>, key: string, amount = 1) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const getNumber = (value: number | undefined | null) => (value ?? 0);

const extractCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getCoordinate = (row: SheetSubmissionRow, key: "lat" | "lng") => {
  const rawValue =
    key === "lat"
      ? row["_A5. GPS Coordinates_latitude"] ?? (row.Latitude as unknown)
      : row["_A5. GPS Coordinates_longitude"] ?? (row.Longitude as unknown);

  return extractCoordinate(rawValue);
};

const getLGA = (row: SheetSubmissionRow) => row["A3. select the LGA"] ?? row.LGA ?? "Unknown LGA";

const getInterviewerId = (row: SheetSubmissionRow) =>
  row["A1. Enumerator ID"] ?? row["Interviewer ID"] ?? "Unknown";

const getInterviewerName = (row: SheetSubmissionRow) =>
  row["Enumerator Name"] ?? row["Interviewer Name"] ?? getInterviewerId(row);

const getApprovalStatus = (row: SheetSubmissionRow) => {
  const status = row["Approval Status"] ?? row["Outcome Status"] ?? "Valid";
  return status === "Approved" || status === "Valid" ? "Approved" : "Not Approved";
};

interface DashboardDataInput {
  submissions: SheetSubmissionRow[];
  stateTargets?: SheetStateTargetRow[];
  stateAgeTargets?: SheetStateAgeTargetRow[];
  stateGenderTargets?: SheetStateGenderTargetRow[];
  analysisRows?: AnalysisRow[];
  lgaCatalog?: LGACatalogEntry[];
  totalSubmissionsOverride?: number;
  totalsDenominatorOverride?: number;
}

export const buildDashboardData = ({
  submissions,
  stateTargets = [],
  stateAgeTargets = [],
  stateGenderTargets = [],
  analysisRows,
  lgaCatalog = [],
  totalSubmissionsOverride,
  totalsDenominatorOverride,
}: DashboardDataInput): DashboardData => {
  const processedSubmissions: ProcessedSubmissionRow[] = applyQualityChecks(submissions);

  const derivedTotalSubmissions = processedSubmissions.length;
  const normaliseOverride = (value?: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(Math.round(value), 0)
      : null;

  const overrideTotal = normaliseOverride(totalSubmissionsOverride);
  const overrideDenominator = normaliseOverride(totalsDenominatorOverride);

  const totalSubmissions = overrideTotal ?? derivedTotalSubmissions;
  const totalDenominator = overrideDenominator ?? totalSubmissions;

  const approvedByState = new Map<string, number>();
  const approvedByStateAge = new Map<string, number>();
  const approvedByStateGender = new Map<string, number>();
  const totalsByState = new Map<string, number>();
  const notApprovedByState = new Map<string, number>();

  const totalsByInterviewer = new Map<string, number>();
  const approvedByInterviewer = new Map<string, number>();
  const notApprovedByInterviewer = new Map<string, number>();

  const totalsByLGA = new Map<string, number>();
  const approvedByLGA = new Map<string, number>();
  const notApprovedByLGA = new Map<string, number>();

  const totalsByLGAAge = new Map<string, number>();
  const approvedByLGAAge = new Map<string, number>();
  const notApprovedByLGAAge = new Map<string, number>();

  const totalsByLGAGender = new Map<string, number>();
  const approvedByLGAGender = new Map<string, number>();
  const notApprovedByLGAGender = new Map<string, number>();

  const totalsByStateAge = new Map<string, number>();
  const totalsByStateGender = new Map<string, number>();

  const interviewerNames = new Map<string, string>();

  const ageGroupSet = new Set<string>();
  const genderSet = new Set<string>();

  stateAgeTargets.forEach((row) => {
    if (row["Age Group"]) {
      ageGroupSet.add(row["Age Group"]);
    }
  });

  stateGenderTargets.forEach((row) => {
    if (row.Gender) {
      genderSet.add(row.Gender);
    }
  });

  const errorTypes: ErrorType[] = [
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
  const errorCounts = Object.fromEntries(
    errorTypes.map((type) => [type, 0])
  ) as Record<ErrorType, number>;

  const interviewerErrors = new Map<
    string,
    {
      oddHour: number;
      lowLOI: number;
      outsideLGA: number;
      duplicate: number;
    }
  >();

  const lgaSet = new Set<string>();
  const interviewerSet = new Set<string>();
  const errorTypeSet = new Set<string>();

  const mapSubmissions: Array<MapSubmission & { sortKey: number }> = [];
  let latestTimestamp = new Date(0);

  processedSubmissions.forEach((row) => {
    const state = row.State ?? "Unknown State";
    const ageGroup = row["Age Group"] ?? "Unknown";
    const gender = row.Gender ?? "Unknown";
    const interviewerId = getInterviewerId(row);
    const interviewerName = getInterviewerName(row);
    const lga = getLGA(row);
    const approvalStatus = getApprovalStatus(row);
    const errorFlags = row["Error Flags"] ?? [];

    const lat = getCoordinate(row, "lat");
    const lng = getCoordinate(row, "lng");
    const hasCoordinates =
      typeof lat === "number" &&
      typeof lng === "number" &&
      !(lat === 0 && lng === 0);
    const resolvedLat = hasCoordinates ? lat : null;
    const resolvedLng = hasCoordinates ? lng : null;

    const timestamp = parseDate(row["Submission Date"], row["Submission Time"]);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }

    lgaSet.add(lga);
    if (ageGroup) {
      ageGroupSet.add(ageGroup);
    }
    if (gender) {
      genderSet.add(gender);
    }
    interviewerSet.add(interviewerId);
    errorFlags.forEach((flag) => errorTypeSet.add(flag));

    incrementMap(totalsByState, state);
    incrementMap(totalsByInterviewer, interviewerId);
    incrementMap(totalsByLGA, `${state}|${lga}`);
    incrementMap(totalsByLGAAge, `${state}|${lga}|${ageGroup}`);
    incrementMap(totalsByLGAGender, `${state}|${lga}|${gender}`);
    incrementMap(totalsByStateAge, `${state}|${ageGroup}`);
    incrementMap(totalsByStateGender, `${state}|${gender}`);

    interviewerNames.set(interviewerId, interviewerName);
    const interviewerError = interviewerErrors.get(interviewerId) ?? {
      oddHour: 0,
      lowLOI: 0,
      outsideLGA: 0,
      duplicate: 0,
    };

    const isApproved = approvalStatus === "Approved";

    if (isApproved) {
      incrementMap(approvedByState, state);
      incrementMap(approvedByStateAge, `${state}|${ageGroup}`);
      incrementMap(approvedByStateGender, `${state}|${gender}`);
      incrementMap(approvedByInterviewer, interviewerId);
      incrementMap(approvedByLGA, `${state}|${lga}`);
      incrementMap(approvedByLGAAge, `${state}|${lga}|${ageGroup}`);
      incrementMap(approvedByLGAGender, `${state}|${lga}|${gender}`);
    } else {
      incrementMap(notApprovedByState, state);
      incrementMap(notApprovedByInterviewer, interviewerId);
      incrementMap(notApprovedByLGA, `${state}|${lga}`);
      incrementMap(notApprovedByLGAAge, `${state}|${lga}|${ageGroup}`);
      incrementMap(notApprovedByLGAGender, `${state}|${lga}|${gender}`);
    }

    errorFlags.forEach((errorType) => {
      errorCounts[errorType] = getNumber(errorCounts[errorType]) + 1;
      switch (errorType) {
        case "OddHour":
          interviewerError.oddHour += 1;
          break;
        case "Low LOI":
          interviewerError.lowLOI += 1;
          break;
        case "Outside LGA Boundary":
          interviewerError.outsideLGA += 1;
          break;
        case "DuplicatePhone":
          interviewerError.duplicate += 1;
          break;
        default:
          break;
      }
    });

    interviewerErrors.set(interviewerId, interviewerError);

    const metadata = row.qualityMetadata;

    mapSubmissions.push({
      id: row["Submission ID"],
      lat: resolvedLat,
      lng: resolvedLng,
      interviewerId,
      interviewerName,
      lga,
      state,
      errorTypes: errorFlags,
      timestamp: timestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: (metadata?.isValid ?? isApproved) ? "approved" : "not_approved",
      sortKey: timestamp.getTime(),
    });
  });

  const geofenceEntries = new Map<string, LGACatalogEntry>();
  lgaCatalog.forEach((entry) => {
    const state = entry.state.trim() || "Unknown State";
    const lga = entry.lga.trim() || "Unknown LGA";
    const key = `${state}|${lga}`;

    if (!geofenceEntries.has(key)) {
      geofenceEntries.set(key, {
        state,
        lga,
        properties: entry.properties ? { ...entry.properties } : undefined,
      });
    }

    lgaSet.add(lga);

    if (!totalsByLGA.has(key)) {
      totalsByLGA.set(key, 0);
    }
    if (!approvedByLGA.has(key)) {
      approvedByLGA.set(key, 0);
    }
    if (!notApprovedByLGA.has(key)) {
      notApprovedByLGA.set(key, 0);
    }
  });

  const allAgeGroups = Array.from(ageGroupSet);
  const allGenders = Array.from(genderSet);

  geofenceEntries.forEach((_, key) => {
    const [state, lga] = key.split("|");

    allAgeGroups.forEach((ageGroup) => {
      const ageKey = `${state}|${lga}|${ageGroup}`;
      if (!totalsByLGAAge.has(ageKey)) {
        totalsByLGAAge.set(ageKey, 0);
      }
      if (!approvedByLGAAge.has(ageKey)) {
        approvedByLGAAge.set(ageKey, 0);
      }
      if (!notApprovedByLGAAge.has(ageKey)) {
        notApprovedByLGAAge.set(ageKey, 0);
      }
    });

    allGenders.forEach((gender) => {
      const genderKey = `${state}|${lga}|${gender}`;
      if (!totalsByLGAGender.has(genderKey)) {
        totalsByLGAGender.set(genderKey, 0);
      }
      if (!approvedByLGAGender.has(genderKey)) {
        approvedByLGAGender.set(genderKey, 0);
      }
      if (!notApprovedByLGAGender.has(genderKey)) {
        notApprovedByLGAGender.set(genderKey, 0);
      }
    });
  });

  const totalApproved = [...approvedByState.values()].reduce((sum, value) => sum + value, 0);
  const totalNotApproved =
    overrideTotal !== null
      ? Math.max(totalSubmissions - totalApproved, 0)
      : Math.max(derivedTotalSubmissions - totalApproved, 0);

  const effectiveStateTargets =
    stateTargets.length > 0
      ? stateTargets
      : [...totalsByState.entries()].map(([state, total]) => ({
          State: state,
          "State Target": total,
        }));

  const effectiveStateAgeTargets =
    stateAgeTargets.length > 0
      ? stateAgeTargets
      : [...totalsByStateAge.entries()].map(([key, total]) => {
          const [state, ageGroup] = key.split("|");
          return {
            State: state,
            "Age Group": ageGroup,
            "Age Group Target": total,
          };
        });

  const effectiveStateGenderTargets =
    stateGenderTargets.length > 0
      ? stateGenderTargets
      : [...totalsByStateGender.entries()].map(([key, total]) => {
          const [state, gender] = key.split("|");
          return {
            State: state,
            Gender: gender as SheetStateGenderTargetRow["Gender"],
            "Gender Target": total,
          };
        });

  const overallTarget = effectiveStateTargets.reduce(
    (sum, row) => sum + row["State Target"],
    0
  );

  const approvalRate = totalDenominator > 0 ? (totalApproved / totalDenominator) * 100 : 0;
  const notApprovedRate = totalDenominator > 0 ? (totalNotApproved / totalDenominator) * 100 : 0;

  const quotaProgress = overallTarget > 0 ? (totalApproved / overallTarget) * 100 : 0;

  const quotaByLGAMap = new Map<string, QuotaLGARow>();
  totalsByLGA.forEach((total, key) => {
    const [state, lga] = key.split("|");
    const achieved = approvedByLGA.get(key) ?? 0;
    const balance = Math.max(total - achieved, 0);
    quotaByLGAMap.set(key, {
      state,
      lga,
      target: total,
      achieved,
      balance,
    });
  });

  const catalogOrderedLGAs: QuotaLGARow[] = [];
  geofenceEntries.forEach((entry, key) => {
    const existing = quotaByLGAMap.get(key);
    if (existing) {
      catalogOrderedLGAs.push(existing);
      quotaByLGAMap.delete(key);
      return;
    }

    catalogOrderedLGAs.push({
      state: entry.state,
      lga: entry.lga,
      target: 0,
      achieved: 0,
      balance: 0,
    });
  });

  const remainingLGAs = Array.from(quotaByLGAMap.values()).sort((a, b) => {
    const lgaComparison = a.lga.localeCompare(b.lga);
    if (lgaComparison !== 0) return lgaComparison;
    return a.state.localeCompare(b.state);
  });

  const lgaOrder = new Map<string, number>();
  catalogOrderedLGAs.forEach((row, index) => {
    lgaOrder.set(`${row.state}|${row.lga}`, index);
  });

  const quotaByLGA: QuotaLGARow[] = [...catalogOrderedLGAs, ...remainingLGAs];

  const quotaByLGAAge: QuotaLGAAgeRow[] = [...totalsByLGAAge.entries()]
    .map(([key, total]) => {
      const [state, lga, ageGroup] = key.split("|");
      const achieved = approvedByLGAAge.get(key) ?? 0;
      const balance = Math.max(total - achieved, 0);
      return {
        state,
        lga,
        ageGroup,
        target: total,
        achieved,
        balance,
      };
    })
    .sort((a, b) => {
      const orderA = lgaOrder.get(`${a.state}|${a.lga}`) ?? Number.MAX_SAFE_INTEGER;
      const orderB = lgaOrder.get(`${b.state}|${b.lga}`) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.ageGroup.localeCompare(b.ageGroup);
    });

  const quotaByLGAGender: QuotaLGAGenderRow[] = [...totalsByLGAGender.entries()]
    .map(([key, total]) => {
      const [state, lga, gender] = key.split("|");
      const achieved = approvedByLGAGender.get(key) ?? 0;
      const balance = Math.max(total - achieved, 0);
      return {
        state,
        lga,
        gender: gender as QuotaLGAGenderRow["gender"],
        target: total,
        achieved,
        balance,
      };
    })
    .sort((a, b) => {
      const orderA = lgaOrder.get(`${a.state}|${a.lga}`) ?? Number.MAX_SAFE_INTEGER;
      const orderB = lgaOrder.get(`${b.state}|${b.lga}`) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.gender.localeCompare(b.gender);
    });

  const userProductivity: ProductivityRow[] = [...totalsByInterviewer.entries()].map(([interviewerId, total]) => {
    const name = interviewerNames.get(interviewerId) ?? interviewerId;
    const errorStats = interviewerErrors.get(interviewerId) ?? {
      oddHour: 0,
      lowLOI: 0,
      outsideLGA: 0,
      duplicate: 0,
    };
    const approvedCount = approvedByInterviewer.get(interviewerId) ?? 0;
    const invalidCount = notApprovedByInterviewer.get(interviewerId) ?? Math.max(total - approvedCount, 0);

    return {
      interviewer: `${interviewerId} · ${name}`,
      totalSubmissions: total,
      validSubmissions: approvedCount,
      invalidSubmissions: invalidCount,
      oddHour: errorStats.oddHour,
      lowLOI: errorStats.lowLOI,
      outsideLGA: errorStats.outsideLGA,
      duplicate: errorStats.duplicate,
      totalErrors:
        errorStats.oddHour +
        errorStats.lowLOI +
        errorStats.outsideLGA +
        errorStats.duplicate,
    };
  });

  const totalErrorEvents = Object.entries(errorCounts).reduce((sum, [, value]) => sum + value, 0);
  const errorBreakdown: ErrorBreakdownRow[] = Object.entries(errorCounts).map(([label, count]) => ({
    errorType: label,
    count,
    percentage: totalErrorEvents > 0 ? (count / totalErrorEvents) * 100 : 0,
  }));

  const achievementsByState: AchievementByStateRow[] = [...totalsByState.entries()].map(([state, total]) => {
    const approved = approvedByState.get(state) ?? 0;
    const notApproved = notApprovedByState.get(state) ?? (total - approved);
    const computedTotal = approved + notApproved;

    return {
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
    };
  });

  const achievementsByInterviewer: AchievementByInterviewerRow[] = [...totalsByInterviewer.entries()].map(
    ([interviewerId, total]) => {
      const approved = approvedByInterviewer.get(interviewerId) ?? 0;
      const notApproved = notApprovedByInterviewer.get(interviewerId) ?? (total - approved);
      const interviewerLabel = `${interviewerId} · ${interviewerNames.get(interviewerId) ?? interviewerId}`;

      return {
        interviewer: interviewerLabel,
        total,
        approved,
        notApproved,
        percentageApproved: total > 0 ? (approved / total) * 100 : 0,
      };
    }
  );

  const achievementsByLGA: AchievementByLGARow[] = [...totalsByLGA.entries()].map(([key, total]) => {
    const [state, lga] = key.split("|");
    const approved = approvedByLGA.get(key) ?? 0;
    const notApproved = notApprovedByLGA.get(key) ?? (total - approved);
    const computedTotal = approved + notApproved;

    return {
      lga,
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
    };
  });

  const summary: SummaryData = {
    overallTarget,
    totalSubmissions,
    approvedSubmissions: totalApproved,
    approvalRate: Number(approvalRate.toFixed(1)),
    notApprovedSubmissions: totalNotApproved,
    notApprovedRate: Number(notApprovedRate.toFixed(1)),
    latestSubmissionTime: totalSubmissions > 0 ? latestTimestamp.toISOString() : null,
    totalDenominator,
  };

  const statusBreakdown: StatusBreakdown = {
    approved: totalApproved,
    notApproved: totalNotApproved,
  };

  const sortedMapSubmissions = mapSubmissions
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey, ...entry }) => entry);

  const lastUpdated = totalSubmissions > 0
    ? latestTimestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No data available";

  const normalizedRows: AnalysisRow[] =
    analysisRows ??
    submissions.map((row) => {
      const normalized: AnalysisRow = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof key !== "string" || key.length === 0) {
          return;
        }
        const normalizedKey = normaliseHeaderKey(key);
        if (!normalizedKey) {
          return;
        }
        const cleanedValue = Array.isArray(value)
          ? value.join(" | ")
          : value === undefined
            ? null
            : value;
        normalized[normalizedKey] = cleanedValue;
      });
      return normalized;
    });

  return {
    summary,
    statusBreakdown,
    quotaProgress: Number(quotaProgress.toFixed(1)),
    quotaByLGA,
    quotaByLGAAge,
    quotaByLGAGender,
    mapSubmissions: sortedMapSubmissions,
    userProductivity,
    errorBreakdown,
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer,
      byLGA: achievementsByLGA,
    },
    filters: {
      lgas:
        geofenceEntries.size > 0
          ? Array.from(
              new Set(
                Array.from(geofenceEntries.values()).map((entry) => entry.lga),
              ),
            ).sort((a, b) => a.localeCompare(b))
          : Array.from(lgaSet).sort(),
      interviewers: Array.from(interviewerSet).sort(),
      errorTypes: Array.from(errorTypeSet).sort(),
    },
    lastUpdated,
    analysisRows: normalizedRows,
    lgaCatalog: Array.from(geofenceEntries.values()).sort((a, b) =>
      a.lga.localeCompare(b.lga)
    ),
  };
};

export const dashboardData = buildDashboardData({
  submissions: sheetSubmissions,
  stateTargets: sheetStateTargets,
  stateAgeTargets: sheetStateAgeTargets,
  stateGenderTargets: sheetStateGenderTargets,
  lgaCatalog: [],
});
