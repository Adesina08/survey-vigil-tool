const normalizeBase = (base: string | undefined): string => {
  if (!base) {
    return "";
  }

  const trimmed = base.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const resolveApiBase = (): string => {
  const configured = normalizeBase(import.meta.env.VITE_API_BASE);
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return normalizeBase(window.location.origin);
  }

  return "";
};

export const API_BASE = resolveApiBase();

const withBase = (path: string): string => {
  return API_BASE ? `${API_BASE}${path}` : path;
};

export const DASHBOARD_ENDPOINT = withBase("/api/dashboard");
export const ANALYSIS_SCHEMA_ENDPOINT = withBase("/api/analysis/schema");
export const ANALYSIS_TABLE_ENDPOINT = withBase("/api/analysis/table");
