export interface ErrorTypeInfo {
  slug: string;
  label: string;
  relatedVariables: string[];
}

const ERROR_TYPE_CONFIG: Record<string, { label: string; relatedVariables: string[] }> = {
  low_loi: {
    label: "Low LOI",
    relatedVariables: ["start", "end", "Minutes Difference"],
  },
  high_loi: {
    label: "High LOI",
    relatedVariables: ["start", "end", "Minutes Difference"],
  },
  odd_hour: {
    label: "Odd Hour",
    relatedVariables: ["start"],
  },
  short_gap: {
    label: "Short Gap",
    relatedVariables: ["start", "end", "deviceid"],
  },
  interwoven: {
    label: "Interwoven",
    relatedVariables: ["start", "end", "deviceid"],
  },
  clustered_interview: {
    label: "Clustered Interview",
    relatedVariables: ["A1. Enumerator ID", "_A5 lat/lon", "start"],
  },
  duplicate_phone: {
    label: "Duplicate Phone",
    relatedVariables: ["Respondent phone number"],
  },
  duplicate_gps: {
    label: "Duplicate GPS",
    relatedVariables: ["_A5 lat/lon"],
  },
  invalid_age: {
    label: "Invalid Age",
    relatedVariables: ["A8. Age"],
  },
  invalid_household_size: {
    label: "Invalid Household Size",
    relatedVariables: ["A11. Household size"],
  },
  invalid_income: {
    label: "Invalid Income",
    relatedVariables: ["C5. Monthly income (₦)"],
  },
  invalid_working_hours: {
    label: "Invalid Working Hours",
    relatedVariables: ["C6. Hours worked per week"],
  },
  invalid_farm_size: {
    label: "Invalid Farm Size",
    relatedVariables: ["D3. Farm size (ha)"],
  },
  invalid_year_joined: {
    label: "Invalid Year Joined",
    relatedVariables: ["B3. Year joined OGSTEP"],
  },
  invalid_duration_months: {
    label: "Invalid Duration (Months)",
    relatedVariables: ["B5. Duration of participation (months)"],
  },
  invalid_distance_to_market: {
    label: "Invalid Distance to Market",
    relatedVariables: ["D10. Distance to market (km)"],
  },
  invalid_yield_last_season: {
    label: "Invalid Yield (Last Season)",
    relatedVariables: ["D4. Yield last season"],
  },
  invalid_quantity_sold: {
    label: "Invalid Quantity Sold",
    relatedVariables: ["D5a. Quantity"],
  },
  invalid_average_price: {
    label: "Invalid Average Price",
    relatedVariables: ["D5c. Price"],
  },
  invalid_input_cost: {
    label: "Invalid Input Cost",
    relatedVariables: ["D8. Input cost"],
  },
  invalid_total_revenue: {
    label: "Invalid Total Revenue",
    relatedVariables: ["D9. Revenue"],
  },
  invalid_monthly_revenue: {
    label: "Invalid Monthly Revenue",
    relatedVariables: ["E5.1. Revenue"],
  },
  invalid_monthly_cost: {
    label: "Invalid Monthly Cost",
    relatedVariables: ["E5.2. Cost"],
  },
  revenue_price_quantity_mismatch: {
    label: "Revenue-Price-Quantity Mismatch",
    relatedVariables: ["D5a", "D5c", "D9"],
  },
  business_profit_error: {
    label: "Business Profit Error",
    relatedVariables: ["E5", "E5.1", "E5.2"],
  },
  skip_logic_violation: {
    label: "Skip Logic Violation",
    relatedVariables: ["B2", "B3", "B4", "B5", "D1", "D3"],
  },
  outside_lga_boundary: {
    label: "Outside LGA Boundary",
    relatedVariables: ["State", "A3", "_A5 lat/lon"],
  },
  poor_gps_accuracy: {
    label: "Poor GPS Accuracy",
    relatedVariables: ["_A5 precision"],
  },
  profit_vs_household_income_mismatch: {
    label: "Profit vs Household Income Mismatch",
    relatedVariables: ["E5", "C5"],
  },
  unemployed_with_income: {
    label: "Unemployed with Income",
    relatedVariables: ["C4", "C5"],
  },
  unemployed_with_hours: {
    label: "Unemployed with Hours",
    relatedVariables: ["C4", "C6"],
  },
  low_income_employed: {
    label: "Low Income (Employed)",
    relatedVariables: ["C4", "C5"],
  },
  low_working_hours: {
    label: "Low Working Hours",
    relatedVariables: ["C6"],
  },
  quantity_sold_out_of_range: {
    label: "Quantity Sold (Out of Range)",
    relatedVariables: ["D5a", "D2"],
  },
  input_cost_out_of_range: {
    label: "Input Cost (Out of Range)",
    relatedVariables: ["D8"],
  },
  total_revenue_out_of_range: {
    label: "Total Revenue (Out of Range)",
    relatedVariables: ["D9"],
  },
  distance_to_market_high: {
    label: "Distance to Market (High)",
    relatedVariables: ["D10"],
  },
  retrospective_yield_low: {
    label: "Retrospective Yield (Low)",
    relatedVariables: ["D12"],
  },
  employees_total_out_of_range: {
    label: "Employees (Total Out of Range)",
    relatedVariables: ["E4.1", "E4.2"],
  },
  monthly_revenue_out_of_range: {
    label: "Monthly Revenue (Out of Range)",
    relatedVariables: ["E5.1"],
  },
  monthly_cost_out_of_range: {
    label: "Monthly Cost (Out of Range)",
    relatedVariables: ["E5.2"],
  },
  monthly_profit_low: {
    label: "Monthly Profit (Low)",
    relatedVariables: ["E5"],
  },
};

const toTitleCase = (value: string): string =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");

const normaliseRawValue = (value: string): string =>
  value
    .replace(/^QC[\s_-]*(?:FLAG|WARN)[\s_-]*/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

export const normaliseErrorType = (raw: unknown): ErrorTypeInfo => {
  if (typeof raw !== "string") {
    return {
      slug: "unknown_error",
      label: "Unknown Error",
      relatedVariables: [],
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      slug: "unknown_error",
      label: "Unknown Error",
      relatedVariables: [],
    };
  }

  const normalisedKey = normaliseRawValue(trimmed);
  const config = ERROR_TYPE_CONFIG[normalisedKey];

  if (config) {
    return {
      slug: normalisedKey,
      label: config.label,
      relatedVariables: [...config.relatedVariables],
    };
  }

  const fallbackLabel = toTitleCase(normalisedKey || trimmed.replace(/[_\s]+/g, " ")) || "Unknown Error";

  return {
    slug: normalisedKey || "unknown_error",
    label: fallbackLabel,
    relatedVariables: [],
  };
};

export const getErrorTypeLabel = (raw: unknown): string => normaliseErrorType(raw).label;

export const getErrorTypeRelatedVariables = (raw: unknown): string[] => normaliseErrorType(raw).relatedVariables;

export const listKnownErrorTypes = (): ErrorTypeInfo[] =>
  Object.entries(ERROR_TYPE_CONFIG).map(([slug, config]) => ({
    slug,
    label: config.label,
    relatedVariables: [...config.relatedVariables],
  }));
