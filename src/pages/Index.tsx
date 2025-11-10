import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import TabsQCAnalysis from "@/components/TabsQCAnalysis";
import QualityControl from "./QualityControl";
import { APP_VERSION } from "@/constants/app";
import type { StoredStatus } from "@/components/qc/SingleForceAction";
import type { CommitPayload } from "@/components/qc/BulkActionDrawer";

const QC_STORAGE_KEY = "qcStatuses";

const readStoredStatuses = (): Record<string, StoredStatus> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(QC_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed).reduce<Record<string, StoredStatus>>((acc, [key, value]) => {
      if (!value || typeof value !== "object") {
        return acc;
      }
      const candidate = value as Record<string, unknown>;
      const status = candidate.status === "approved" || candidate.status === "not_approved" ? candidate.status : null;
      if (!status) {
        return acc;
      }
      const officer = typeof candidate.officer === "string" ? candidate.officer : "";
      const comment = typeof candidate.comment === "string" ? candidate.comment : "";
      const timestamp = typeof candidate.timestamp === "string" ? candidate.timestamp : new Date().toISOString();
      acc[key] = { status, officer, comment, timestamp };
      return acc;
    }, {});
  } catch (error) {
    console.warn("Failed to parse QC statuses", error);
    return {};
  }
};

function filterByLga<T>(rows: T[], lga: string | null): T[] {
  if (!lga || lga === "all" || lga === "All LGAs") {
    return rows;
  }

  return rows.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }

    const record = row as Record<string, unknown>;
    const candidate =
      record["lga"] ?? record["a3_select_the_lga"] ?? record["A3. select the LGA"] ?? record["LGA"];

    return candidate === lga;
  });
}

const Index = () => {
  const { data: dashboardData, isLoading, isFetching, isError, error, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLga, setSelectedLga] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StoredStatus>>(() => readStoredStatuses());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === QC_STORAGE_KEY) {
        setOverrides(readStoredStatuses());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleBulkCommit = useCallback((payload: CommitPayload) => {
    setOverrides((current) => ({ ...current, ...payload }));
  }, []);

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === "lga") {
      const normalized = !value || value === "all" || value === "All LGAs" ? null : value;
      setSelectedLga(normalized);
      return;
    }
  };

  const filteredMapSubmissions = useMemo(() => {
    if (!dashboardData) {
      return [];
    }
    return filterByLga(dashboardData.mapSubmissions, selectedLga);
  }, [dashboardData, selectedLga]);

  useEffect(() => {
    if (!selectedLga || !dashboardData) {
      return;
    }

    if (!dashboardData.filters.lgas.includes(selectedLga)) {
      setSelectedLga(null);
    }
  }, [dashboardData, selectedLga]);

  if (isLoading && !dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading dashboard data…</p>
        </div>
      </div>
    );
  }

  const errorMessage = error?.message ?? "An unexpected error occurred while connecting to the dashboard service.";

  if (isError || !dashboardData?.summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader
        lastRefreshed={dashboardData.lastUpdated ?? null}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isFetching}
        APP_VERSION={APP_VERSION}
      />

      <main className="mx-auto max-w-7xl flex-1 space-y-6 px-6 py-6">
        <TabsQCAnalysis
          qualityControl={
            <QualityControl
              dashboardData={dashboardData}
              filteredMapSubmissions={filteredMapSubmissions}
              onFilterChange={handleFilterChange}
              selectedLga={selectedLga}
              overrides={overrides}
              onBulkCommit={handleBulkCommit}
            />
          }
        />
      </main>

      <footer className="border-t bg-background py-4">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">© 2025</div>
      </footer>
    </div>
  );
};

export default Index;
