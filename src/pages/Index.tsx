import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExportBar } from "@/components/dashboard/ExportBar";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AlertCircle, Loader2 } from "lucide-react";
import TabsQCAnalysis from "@/components/TabsQCAnalysis";
import QualityControl from "./QualityControl";

const Index = () => {
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLga, setSelectedLga] = useState<string | null>(null);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const lastRefreshedLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return null;
    }
    return dateTimeFormatter.format(new Date(dataUpdatedAt));
  }, [dataUpdatedAt, dateTimeFormatter]);

  const latestSurveyLabel = useMemo(() => {
    const raw = dashboardData?.lastUpdated;
    if (!raw) {
      return null;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return dateTimeFormatter.format(parsed);
    }

    return typeof raw === "string" ? raw : null;
  }, [dashboardData?.lastUpdated, dateTimeFormatter]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === "lga") {
      const normalized = !value || value === "all" || value === "All LGAs" ? null : value;
      setSelectedLga(normalized);
      console.log(`Filter changed: ${filterType} = ${normalized ?? "All LGAs"}`);
      return;
    }

    console.log(`Filter changed: ${filterType} = ${value}`);
  };

  useEffect(() => {
    if (!selectedLga) {
      return;
    }

    const availableLgas = dashboardData?.filters?.lgas ?? [];
    if (!availableLgas.includes(selectedLga)) {
      setSelectedLga(null);
    }
  }, [dashboardData?.filters?.lgas, selectedLga]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void handleRefresh();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [handleRefresh]);

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

  const hasRequiredData =
    dashboardData &&
    dashboardData.summary &&
    Array.isArray(dashboardData.analysisRows) &&
    Array.isArray(dashboardData.errorBreakdown);

  if (isError || !hasRequiredData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
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
        lastUpdated={latestSurveyLabel ?? undefined}
        lastRefreshedAt={lastRefreshedLabel ?? undefined}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isFetching}
        exportRows={dashboardData.analysisRows}
        errorBreakdown={dashboardData.errorBreakdown}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <TabsQCAnalysis
          qualityControl={
            <QualityControl
              dashboardData={dashboardData}
              onFilterChange={handleFilterChange}
              selectedLga={selectedLga}
            />
          }
        />
      </main>

      <ExportBar rows={dashboardData.analysisRows} errorBreakdown={dashboardData.errorBreakdown} />

      <footer className="border-t bg-background py-4">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          © 2025 OGSTEP IMPACT SURVEY
        </div>
      </footer>
    </div>
  );
};

export default Index;
