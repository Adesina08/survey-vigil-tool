import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@/lib/dashboardData";
import { fetchDashboardData } from "@/services/dataSource";

interface UseDashboardDataOptions {
  onStatusChange?: (status: string) => void;
  sections?: string;
  mapLimit?: number;
  prodLimit?: number;
  analysisLimit?: number;
}

const limitArray = <T,>(items: T[], limit?: number): T[] => {
  if (!Array.isArray(items)) return [];
  if (typeof limit !== "number" || limit <= 0) return items;
  return items.slice(0, limit);
};

const normaliseSections = (sections?: string): Set<string> => {
  if (!sections) {
    return new Set();
  }
  return new Set(
    sections
      .split(",")
      .map((section) => section.trim().toLowerCase())
      .filter((section) => section.length > 0)
  );
};

const projectSections = (
  data: DashboardData,
  { sections, mapLimit, prodLimit, analysisLimit }: UseDashboardDataOptions
): Partial<DashboardData> => {
  const sectionSet = normaliseSections(sections);
  if (sectionSet.size === 0) {
    return {
      ...data,
      mapSubmissions: limitArray(data.mapSubmissions, mapLimit),
      userProductivity: limitArray(data.userProductivity, prodLimit),
      userProductivityDetailed: limitArray(data.userProductivityDetailed, prodLimit),
      analysisRows: limitArray(data.analysisRows, analysisLimit),
    };
  }

  const include = (name: string) => sectionSet.has(name);
  const partial: Partial<DashboardData> = {};

  if (include("summary")) {
    partial.summary = data.summary;
    partial.statusBreakdown = data.statusBreakdown;
    partial.quotaProgress = data.quotaProgress;
    partial.lastUpdated = data.lastUpdated;
  }

  if (include("quota")) {
    partial.quotaByLGA = data.quotaByLGA;
    partial.quotaByLGAAge = data.quotaByLGAAge;
    partial.quotaByLGAGender = data.quotaByLGAGender;
    partial.quotaProgress = data.quotaProgress;
    partial.statusBreakdown = data.statusBreakdown;
    partial.summary = partial.summary ?? data.summary;
  }

  if (include("map")) {
    partial.mapSubmissions = limitArray(data.mapSubmissions, mapLimit);
    partial.mapMetadata = data.mapMetadata;
  }

  if (include("productivity")) {
    partial.userProductivity = limitArray(data.userProductivity, prodLimit);
    partial.userProductivityDetailed = limitArray(data.userProductivityDetailed, prodLimit);
  }

  if (include("analysis")) {
    const limitedRows = limitArray(data.analysisRows, analysisLimit);
    partial.analysisRows = limitedRows;
    (partial as Partial<DashboardData> & { submissions?: unknown[] }).submissions = limitedRows;
  }

  if (include("errors")) {
    partial.errorBreakdown = data.errorBreakdown;
  }

  if (include("achievements")) {
    partial.achievements = data.achievements;
  }

  if (include("filters")) {
    partial.filters = data.filters;
  }

  if (sectionSet.size > 0) {
    partial.lastUpdated = partial.lastUpdated ?? data.lastUpdated;
  }

  return partial;
};

export const useDashboardData = (options: UseDashboardDataOptions = {}) => {
  const { onStatusChange } = options;

  return useQuery<Partial<DashboardData>, Error>({
    queryKey: [
      "dashboard-data",
      options.sections ?? "all",
      options.mapLimit ?? null,
      options.prodLimit ?? null,
      options.analysisLimit ?? null,
    ],
    queryFn: async () => {
      try {
        onStatusChange?.("Loading latest data…");
        const dashboard = await fetchDashboardData();
        onStatusChange?.(`Last refreshed: ${new Date().toLocaleString()}`);
        return projectSections(dashboard, options);
      } catch (error) {
        onStatusChange?.("Refresh failed");
        throw error;
      }
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
    retry: 1,
  });
};
