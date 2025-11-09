import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExportBar } from "@/components/dashboard/ExportBar";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AlertCircle, Loader2 } from "lucide-react";
import TabsQCAnalysis from "@/components/TabsQCAnalysis";
import QualityControl from "./QualityControl";

const Index = () => {
  const { data: dashboardData, isLoading, isFetching, isError, error, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [selectedLga, setSelectedLga] = useState<string>("all");

  useEffect(() => {
    if (dashboardData) {
      setLastRefreshed(dashboardData.lastUpdated);
    }
  }, [dashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await refetch();
      if (result.data) {
        setLastRefreshed(result.data.lastUpdated);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === "lga") {
      setSelectedLga(value);
    }
    console.log(`Filter changed: ${filterType} = ${value}`);
  };

  const filteredMapSubmissions = useMemo(() => {
    if (!dashboardData) {
      return [];
    }

    if (selectedLga === "all") {
      return dashboardData.mapSubmissions;
    }
    return dashboardData.mapSubmissions.filter((submission) => submission.lga === selectedLga);
  }, [dashboardData, selectedLga]);

  useEffect(() => {
    if (selectedLga === "all" || !dashboardData) {
      return;
    }

    if (!dashboardData.filters.lgas.includes(selectedLga)) {
      setSelectedLga("all");
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

  if (isError && !dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message ?? "An unexpected error occurred while connecting to Google Sheets."}
          </p>
          <Button className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader
        lastRefreshed={lastRefreshed}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isFetching}
      />

      <main className="mx-auto max-w-7xl flex-1 space-y-6 px-6 py-6">
        <TabsQCAnalysis
          qualityControl={
            <QualityControl
              dashboardData={dashboardData}
              filteredMapSubmissions={filteredMapSubmissions}
              onFilterChange={handleFilterChange}
            />
          }
        />
      </main>

      <ExportBar />

      <footer className="border-t bg-background py-4">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          © 2025
        </div>
      </footer>
    </div>
  );
};

export default Index;
