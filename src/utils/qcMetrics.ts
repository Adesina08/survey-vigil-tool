export type SurveyRow = Record<string, unknown>;

export interface EnumeratorMetrics {
  interviewerId: string;
  total: number;
  approved: number;
  flagged: number;
  qcFlags: Record<string, number>;
  qcWarnings: Record<string, number>;
}

export interface RankingEntry {
  interviewerId: string;
  total: number;
  approved: number;
  flagged: number;
}

export interface QCTableColumn {
  key: string;
  label: string;
  type: "flag" | "warning";
}

export interface QCTableRow {
  interviewerId: string;
  total: number;
  flagged: number;
  qcValues: Record<string, number>;
}

export interface ErrorBreakdownRow {
  key: string;
  label: string;
  count: number;
  percentage: number;
  type: "flag" | "warning";
}

export interface ProcessedSurveyData {
  totals: {
    total: number;
    approved: number;
    flagged: number;
    approvalRate: number;
    flaggedRate: number;
  };
  enumerators: EnumeratorMetrics[];
  ranking: RankingEntry[];
  chartData: Array<RankingEntry>;
  qcTable: {
    columns: QCTableColumn[];
    rows: QCTableRow[];
  };
  errorBreakdown: {
    totalErrors: number;
    rows: ErrorBreakdownRow[];
  };
  exports: {
    allRows: SurveyRow[];
    approvedRows: SurveyRow[];
    flaggedRows: SurveyRow[];
    errorRows: SurveyRow[];
  };
}

const APPROVED = "approved";
const NOT_APPROVED = "not_approved";

const FLAG_REGEX = /^QC_FLAG_/i;
const WARN_REGEX = /^QC_WARN_/i;

const normaliseApproval = (value: unknown): typeof APPROVED | typeof NOT_APPROVED | null => {
  if (typeof value !== "string") {
    if (typeof value === "boolean") {
      return value ? APPROVED : NOT_APPROVED;
    }
    if (typeof value === "number") {
      if (value === 1) return APPROVED;
      if (value === 0) return NOT_APPROVED;
    }
    return null;
  }

  const text = value.trim().toLowerCase();
  if (!text) {
    return null;
  }

  if (text === "approved" || text === "pass" || text === "1") {
    return APPROVED;
  }

  if (text === "not approved" || text === "not_approved" || text === "failed" || text === "0") {
    return NOT_APPROVED;
  }

  return null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) {
      return 0;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatColumnLabel = (key: string): string => {
  const withoutPrefix = key.replace(/^QC_/i, "QC ");
  const withSpaces = withoutPrefix.replace(/_/g, " ");
  return withSpaces
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const createEnumerator = (interviewerId: string): EnumeratorMetrics => ({
  interviewerId,
  total: 0,
  approved: 0,
  flagged: 0,
  qcFlags: {},
  qcWarnings: {},
});

const rankingComparator = (a: RankingEntry, b: RankingEntry) => {
  if (b.approved !== a.approved) {
    return b.approved - a.approved;
  }

  if (a.flagged !== b.flagged) {
    return a.flagged - b.flagged;
  }

  if (b.total !== a.total) {
    return b.total - a.total;
  }

  return a.interviewerId.localeCompare(b.interviewerId);
};

export const processSurveyRows = (rows: SurveyRow[]): ProcessedSurveyData => {
  const enumeratorMap = new Map<string, EnumeratorMetrics>();
  const flagKeys = new Set<string>();
  const warnKeys = new Set<string>();
  const errorTotals = new Map<string, number>();

  const approvedRows: SurveyRow[] = [];
  const flaggedRows: SurveyRow[] = [];
  const errorRowIndexes = new Set<number>();

  let approvedCount = 0;
  let flaggedCount = 0;

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      return;
    }

    const rawId =
      (row["A1. Enumerator ID"] ??
        row["interviewer_id"] ??
        row["Interviewer ID"] ??
        row["Enumerator"] ??
        row["interviewer"] ??
        row["enum_id"]) ?? "Unknown";

    const interviewerId = String(rawId || "Unknown").trim() || "Unknown";

    const enumerator = enumeratorMap.get(interviewerId) ?? createEnumerator(interviewerId);
    enumerator.total += 1;

    const approvalValue =
      row["Approval"] ?? row["Approval Status"] ?? row["QC Approval"] ?? row["approval_status"];
    const approval = normaliseApproval(approvalValue);

    if (approval === APPROVED) {
      enumerator.approved += 1;
      approvedCount += 1;
      approvedRows.push(row);
    } else if (approval === NOT_APPROVED) {
      enumerator.flagged += 1;
      flaggedCount += 1;
      flaggedRows.push(row);
    }

    let hasErrors = false;

    Object.entries(row).forEach(([key, value]) => {
      if (FLAG_REGEX.test(key)) {
        const numeric = toNumber(value);
        if (numeric > 0) {
          hasErrors = true;
          enumerator.qcFlags[key] = (enumerator.qcFlags[key] ?? 0) + numeric;
          flagKeys.add(key);
          errorTotals.set(key, (errorTotals.get(key) ?? 0) + numeric);
        }
      } else if (WARN_REGEX.test(key)) {
        const numeric = toNumber(value);
        if (numeric > 0) {
          hasErrors = true;
          enumerator.qcWarnings[key] = (enumerator.qcWarnings[key] ?? 0) + numeric;
          warnKeys.add(key);
          errorTotals.set(key, (errorTotals.get(key) ?? 0) + numeric);
        }
      }
    });

    if (hasErrors) {
      errorRowIndexes.add(index);
    }

    enumeratorMap.set(interviewerId, enumerator);
  });

  const enumerators = Array.from(enumeratorMap.values()).map((entry) => ({
    ...entry,
    approved: Math.min(entry.approved, entry.total),
    flagged: Math.min(entry.flagged, entry.total),
  }));

  const ranking = [...enumerators]
    .map<RankingEntry>((entry) => ({
      interviewerId: entry.interviewerId,
      total: entry.total,
      approved: entry.approved,
      flagged: entry.flagged,
    }))
    .sort(rankingComparator);

  const chartData = [...ranking];

  const qcFlagColumns = Array.from(flagKeys).sort((a, b) => a.localeCompare(b));
  const qcWarnColumns = Array.from(warnKeys).sort((a, b) => a.localeCompare(b));

  const qcTableRows: QCTableRow[] = ranking.map((entry) => {
    const source = enumeratorMap.get(entry.interviewerId) ?? createEnumerator(entry.interviewerId);
    const qcValues: Record<string, number> = {};

    qcFlagColumns.forEach((key) => {
      qcValues[key] = source.qcFlags[key] ?? 0;
    });

    qcWarnColumns.forEach((key) => {
      qcValues[key] = source.qcWarnings[key] ?? 0;
    });

    return {
      interviewerId: entry.interviewerId,
      total: source.total,
      flagged: source.flagged,
      qcValues,
    };
  });

  const columns: QCTableColumn[] = [
    ...qcFlagColumns.map((key) => ({ key, label: formatColumnLabel(key), type: "flag" as const })),
    ...qcWarnColumns.map((key) => ({ key, label: formatColumnLabel(key), type: "warning" as const })),
  ];

  const totalErrors = Array.from(errorTotals.values()).reduce((sum, value) => sum + value, 0);

  const errorBreakdownRows: ErrorBreakdownRow[] = Array.from(errorTotals.entries())
    .map(([key, count]) => ({
      key,
      label: formatColumnLabel(key),
      count,
      percentage: totalErrors > 0 ? Number(((count / totalErrors) * 100).toFixed(1)) : 0,
      type: flagKeys.has(key) ? "flag" : "warning",
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const errorRows = Array.from(errorRowIndexes.values())
    .sort((a, b) => a - b)
    .map((index) => rows[index])
    .filter((row): row is SurveyRow => Boolean(row));

  const total = rows.length;
  const approvalRate = total > 0 ? (approvedCount / total) * 100 : 0;
  const flaggedRate = total > 0 ? (flaggedCount / total) * 100 : 0;

  return {
    totals: {
      total,
      approved: approvedCount,
      flagged: flaggedCount,
      approvalRate,
      flaggedRate,
    },
    enumerators,
    ranking,
    chartData,
    qcTable: {
      columns,
      rows: qcTableRows,
    },
    errorBreakdown: {
      totalErrors,
      rows: errorBreakdownRows,
    },
    exports: {
      allRows: rows,
      approvedRows,
      flaggedRows,
      errorRows,
    },
  };
};

