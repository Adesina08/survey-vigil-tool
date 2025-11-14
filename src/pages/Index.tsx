import { useCallback, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExportBar } from "@/components/dashboard/ExportBar";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AlertCircle, Loader2 } from "lucide-react";
import TabsQCAnalysis from "@/components/TabsQCAnalysis";
import QualityControl from "./QualityControl";

const Index = () => {
  const [statusMessage, setStatusMessage] = useState("Loading…");
  const { data: dashboardData, isLoading, isFetching, isError, error, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLga, setSelectedLga] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setStatusMessage("Refreshing…");
    try {
      const result = await refetch();
      if (!result.error) {
        const updatedLabel = result.data?.lastUpdated ?? new Date().toLocaleString();
        setStatusMessage(`Last refreshed: ${updatedLabel}`);
      } else {
        setStatusMessage("Refresh failed");
      }
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
    if (!dashboardData || isLoading || isFetching) {
      return;
    }

    if (dashboardData.lastUpdated) {
      setStatusMessage(`Last refreshed: ${dashboardData.lastUpdated}`);
    } else {
      setStatusMessage("Data loaded");
    }
  }, [dashboardData, isFetching, isLoading]);

  useEffect(() => {
    if (!selectedLga || !dashboardData) {
      return;
    }

    if (!dashboardData.filters.lgas.includes(selectedLga)) {
      setSelectedLga(null);
    }
  }, [dashboardData, selectedLga]);

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

  if (isError || !dashboardData?.summary) {
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
        statusMessage={statusMessage}
        lastUpdated={dashboardData?.lastUpdated ?? ""}
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
