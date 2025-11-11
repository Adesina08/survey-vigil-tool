import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import QualityControl from "./QualityControl";
import type { SurveyRow } from "@/utils/qcMetrics";

const Index = () => {
  const [statusMessage, setStatusMessage] = useState("Loading…");
  const { data: dashboardData, isLoading, isFetching, isError, error, refetch } = useDashboardData({
    onStatusChange: setStatusMessage,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStatusMessage("Refreshing…");
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

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

  const errorMessage =
    error?.message ?? "An unexpected error occurred while connecting to the dashboard service.";

  if (isError || !dashboardData?.analysisRows) {
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

  const rows = (dashboardData.analysisRows ?? []) as SurveyRow[];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader
        statusMessage={statusMessage}
        lastUpdated={dashboardData?.lastUpdated ?? ""}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isFetching}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <QualityControl rows={rows} isLoading={isLoading || isFetching} />
      </main>

      <footer className="border-t bg-background py-4">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          © 2025
        </div>
      </footer>
    </div>
  );
};

export default Index;

