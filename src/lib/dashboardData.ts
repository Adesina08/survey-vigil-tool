import {
  sheetSubmissions,
  sheetStateTargets,
  sheetStateAgeTargets,
  sheetStateGenderTargets,
  type SheetSubmissionRow,
  type ErrorType,
} from "@/data/sampleData";

const ERROR_LABELS: Record<ErrorType, string> = {
  "Odd Hour": "Odd Hour",
  "Low LOI": "Low LOI",
  "Outside LGA": "Outside LGA Boundary",
  Duplicate: "Duplicate Phone",
};

const STATUS_LABELS = {
  Valid: "valid" as const,
  Invalid: "invalid" as const,
  Terminated: "terminated" as const,
};

type StatusKey = keyof typeof STATUS_LABELS;

interface MapSubmission {
  id: string;
  lat: number;
  lng: number;
  interviewer: string;
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: "valid" | "invalid" | "terminated";
}

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  validSubmissions: number;
  validPercentage: number;
  invalidSubmissions: number;
  invalidPercentage: number;
  forceApproved: number;
  forceCancelled: number;
  terminated: number;
}

interface StatusBreakdown {
  valid: number;
  invalid: number;
  terminated: number;
}

interface QuotaRow {
  state: string;
  target: number;
  achieved: number;
  balance: number;
}

interface QuotaAgeRow extends QuotaRow {
  ageGroup: string;
}

interface QuotaGenderRow extends QuotaRow {
  gender: string;
}

interface ProductivityRow {
  interviewer: string;
  totalSubmissions: number;
  oddHour: number;
  lowLOI: number;
  outsideLGA: number;
  duplicate: number;
  terminated: number;
  totalErrors: number;
}

interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
}

interface AchievementRow {
  total: number;
  valid: number;
  invalid: number;
  percentageValid: number;
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

interface DashboardData {
  summary: SummaryData;
  statusBreakdown: StatusBreakdown;
  quotaProgress: number;
  quotaByState: QuotaRow[];
  quotaByStateAge: QuotaAgeRow[];
  quotaByStateGender: QuotaGenderRow[];
  mapSubmissions: MapSubmission[];
  userProductivity: ProductivityRow[];
  errorBreakdown: ErrorBreakdownRow[];
  achievements: {
    byState: AchievementByStateRow[];
    byInterviewer: AchievementByInterviewerRow[];
    byLGA: AchievementByLGARow[];
  };
  lastUpdated: string;
}

const parseDate = (date: string, time: string) => new Date(`${date}T${time}:00Z`);

const incrementMap = (map: Map<string, number>, key: string, amount = 1) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const buildDashboardData = (): DashboardData => {
  const totalSubmissions = sheetSubmissions.length;

  const validByState = new Map<string, number>();
  const validByStateAge = new Map<string, number>();
  const validByStateGender = new Map<string, number>();
  const totalsByState = new Map<string, number>();
  const invalidByState = new Map<string, number>();
  const terminatedByState = new Map<string, number>();

  const totalsByInterviewer = new Map<string, number>();
  const validByInterviewer = new Map<string, number>();
  const invalidByInterviewer = new Map<string, number>();

  const totalsByLGA = new Map<string, number>();
  const validByLGA = new Map<string, number>();
  const invalidByLGA = new Map<string, number>();
  const terminatedByLGA = new Map<string, number>();

  const interviewerNames = new Map<string, string>();

  const errorCounts: Record<string, number> = {
    "Odd Hour": 0,
    "Low LOI": 0,
    "Outside LGA Boundary": 0,
    "Duplicate Phone": 0,
    Terminated: 0,
  };

  const interviewerErrors = new Map<
    string,
    {
      oddHour: number;
      lowLOI: number;
      outsideLGA: number;
      duplicate: number;
      terminated: number;
    }
  >();

  let forceApproved = 0;
  let forceCancelled = 0;

  const mapSubmissions: Array<MapSubmission & { sortKey: number }> = [];
  let latestTimestamp = new Date(0);

  sheetSubmissions.forEach((row) => {
    const state = row.State;
    const ageGroup = row["Age Group"];
    const gender = row.Gender;
    const interviewerId = row["Interviewer ID"];
    const interviewerName = row["Interviewer Name"];
    const lgaKey = `${state}|${row.LGA}`;
    const status = row["Outcome Status"] as StatusKey;

    const timestamp = parseDate(row["Submission Date"], row["Submission Time"]);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }

    incrementMap(totalsByState, state);
    incrementMap(totalsByInterviewer, interviewerId);
    incrementMap(totalsByLGA, lgaKey);

    interviewerNames.set(interviewerId, interviewerName);
    const interviewerError = interviewerErrors.get(interviewerId) ?? {
      oddHour: 0,
      lowLOI: 0,
      outsideLGA: 0,
      duplicate: 0,
      terminated: 0,
    };

    if (status === "Valid") {
      incrementMap(validByState, state);
      incrementMap(validByStateAge, `${state}|${ageGroup}`);
      incrementMap(validByStateGender, `${state}|${gender}`);
      incrementMap(validByInterviewer, interviewerId);
      incrementMap(validByLGA, lgaKey);
    }

    if (status === "Invalid") {
      incrementMap(invalidByState, state);
      incrementMap(invalidByInterviewer, interviewerId);
      incrementMap(invalidByLGA, lgaKey);
    }

    if (status === "Terminated" || row.Terminated === "Yes") {
      incrementMap(terminatedByState, state);
      incrementMap(terminatedByLGA, lgaKey);
      interviewerError.terminated += 1;
      errorCounts.Terminated += 1;
    }

    if (row["Force Approved"] === "Yes") {
      forceApproved += 1;
    }

    if (row["Force Cancelled"] === "Yes") {
      forceCancelled += 1;
    }

    (Object.entries(ERROR_LABELS) as Array<[ErrorType, string]>).forEach(([errorKey, label]) => {
      const column = `${errorKey} Flag` as keyof SheetSubmissionRow;
      if (row[column] === "Yes") {
        errorCounts[label] += 1;
        switch (errorKey) {
          case "Odd Hour":
            interviewerError.oddHour += 1;
            break;
          case "Low LOI":
            interviewerError.lowLOI += 1;
            break;
          case "Outside LGA":
            interviewerError.outsideLGA += 1;
            break;
          case "Duplicate":
            interviewerError.duplicate += 1;
            break;
        }
      }
    });

    interviewerErrors.set(interviewerId, interviewerError);

    const statusLabel = STATUS_LABELS[status] ?? "valid";
    const errorTypes = (Object.entries(ERROR_LABELS) as Array<[ErrorType, string]>)
      .filter(([errorKey]) => row[`${errorKey} Flag` as keyof SheetSubmissionRow] === "Yes")
      .map(([, label]) => label);

    mapSubmissions.push({
      id: row["Submission ID"],
      lat: row.Latitude,
      lng: row.Longitude,
      interviewer: interviewerName,
      lga: row.LGA,
      state,
      errorTypes,
      timestamp: timestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: statusLabel,
      sortKey: timestamp.getTime(),
    });
  });

  const totalValid = [...validByState.values()].reduce((sum, value) => sum + value, 0);
  const totalInvalid = [...invalidByState.values()].reduce((sum, value) => sum + value, 0);
  const totalTerminated = errorCounts.Terminated;

  const overallTarget = sheetStateTargets.reduce((sum, row) => sum + row["State Target"], 0);
  const validPercentage = totalSubmissions > 0 ? (totalValid / totalSubmissions) * 100 : 0;
  const invalidPercentage = totalSubmissions > 0 ? (totalInvalid / totalSubmissions) * 100 : 0;

  const quotaProgress = overallTarget > 0 ? (totalValid / overallTarget) * 100 : 0;

  const quotaByState: QuotaRow[] = sheetStateTargets.map((row) => {
    const achieved = validByState.get(row.State) ?? 0;
    const balance = Math.max(row["State Target"] - achieved, 0);
    return {
      state: row.State,
      target: row["State Target"],
      achieved,
      balance,
    };
  });

  const quotaByStateAge: QuotaAgeRow[] = sheetStateAgeTargets.map((row) => {
    const key = `${row.State}|${row["Age Group"]}`;
    const achieved = validByStateAge.get(key) ?? 0;
    const balance = Math.max(row["Age Group Target"] - achieved, 0);
    return {
      state: row.State,
      ageGroup: row["Age Group"],
      target: row["Age Group Target"],
      achieved,
      balance,
    };
  });

  const quotaByStateGender: QuotaGenderRow[] = sheetStateGenderTargets.map((row) => {
    const key = `${row.State}|${row.Gender}`;
    const achieved = validByStateGender.get(key) ?? 0;
    const balance = Math.max(row["Gender Target"] - achieved, 0);
    return {
      state: row.State,
      gender: row.Gender,
      target: row["Gender Target"],
      achieved,
      balance,
    };
  });

  const userProductivity: ProductivityRow[] = [...totalsByInterviewer.entries()].map(([interviewerId, total]) => {
    const name = interviewerNames.get(interviewerId) ?? interviewerId;
    const errorStats = interviewerErrors.get(interviewerId) ?? {
      oddHour: 0,
      lowLOI: 0,
      outsideLGA: 0,
      duplicate: 0,
      terminated: 0,
    };

    return {
      interviewer: `${interviewerId} · ${name}`,
      totalSubmissions: total,
      oddHour: errorStats.oddHour,
      lowLOI: errorStats.lowLOI,
      outsideLGA: errorStats.outsideLGA,
      duplicate: errorStats.duplicate,
      terminated: errorStats.terminated,
      totalErrors:
        errorStats.oddHour +
        errorStats.lowLOI +
        errorStats.outsideLGA +
        errorStats.duplicate +
        errorStats.terminated,
    };
  });

  const totalErrorEvents = Object.entries(errorCounts).reduce((sum, [, value]) => sum + value, 0);
  const errorBreakdown: ErrorBreakdownRow[] = Object.entries(errorCounts).map(([label, count]) => ({
    errorType: label,
    count,
    percentage: totalErrorEvents > 0 ? (count / totalErrorEvents) * 100 : 0,
  }));

  const achievementsByState: AchievementByStateRow[] = [...totalsByState.entries()].map(([state, total]) => {
    const valid = validByState.get(state) ?? 0;
    const invalid = invalidByState.get(state) ?? 0;
    const terminated = terminatedByState.get(state) ?? 0;
    const computedTotal = valid + invalid + terminated;

    return {
      state,
      total: computedTotal,
      valid,
      invalid,
      percentageValid: computedTotal > 0 ? (valid / computedTotal) * 100 : 0,
    };
  });

  const achievementsByInterviewer: AchievementByInterviewerRow[] = [...totalsByInterviewer.entries()].map(
    ([interviewerId, total]) => {
      const valid = validByInterviewer.get(interviewerId) ?? 0;
      const invalid = invalidByInterviewer.get(interviewerId) ?? 0;
      const interviewerLabel = `${interviewerId} · ${interviewerNames.get(interviewerId) ?? interviewerId}`;

      return {
        interviewer: interviewerLabel,
        total,
        valid,
        invalid,
        percentageValid: total > 0 ? (valid / total) * 100 : 0,
      };
    }
  );

  const achievementsByLGA: AchievementByLGARow[] = [...totalsByLGA.entries()].map(([key, total]) => {
    const [state, lga] = key.split("|");
    const valid = validByLGA.get(key) ?? 0;
    const invalid = invalidByLGA.get(key) ?? 0;
    const terminated = terminatedByLGA.get(key) ?? 0;
    const computedTotal = valid + invalid + terminated;

    return {
      lga,
      state,
      total: computedTotal,
      valid,
      invalid,
      percentageValid: computedTotal > 0 ? (valid / computedTotal) * 100 : 0,
    };
  });

  const summary: SummaryData = {
    overallTarget,
    totalSubmissions,
    validSubmissions: totalValid,
    validPercentage: Number(validPercentage.toFixed(1)),
    invalidSubmissions: totalInvalid,
    invalidPercentage: Number(invalidPercentage.toFixed(1)),
    forceApproved,
    forceCancelled,
    terminated: totalTerminated,
  };

  const statusBreakdown: StatusBreakdown = {
    valid: totalValid,
    invalid: totalInvalid,
    terminated: totalTerminated,
  };

  const sortedMapSubmissions = mapSubmissions
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 500)
    .map(({ sortKey, ...entry }) => entry);

  const lastUpdated = latestTimestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    summary,
    statusBreakdown,
    quotaProgress: Number(quotaProgress.toFixed(1)),
    quotaByState,
    quotaByStateAge,
    quotaByStateGender,
    mapSubmissions: sortedMapSubmissions,
    userProductivity,
    errorBreakdown,
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer,
      byLGA: achievementsByLGA,
    },
    lastUpdated,
  };
};

export const dashboardData = buildDashboardData();
