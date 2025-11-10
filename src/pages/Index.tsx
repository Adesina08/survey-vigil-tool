import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AlertCircle, Loader2 } from "lucide-react";
import TabsQCAnalysis from "@/components/TabsQCAnalysis";
import QualityControl from "./QualityControl";
import { APP_VERSION } from "@/constants/app";

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
      record["lga"] ??
      record["a3_select_the_lga"] ??
      record["A3. select the LGA"] ??
      record["LGA"];

    return candidate === lga;
  });
}

const Index = () => {
  const { data: dashboardData, isLoading, isFetching, isError, error, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedLga, setSelectedLga] = useState<string | null>(null);

  useEffect(() => {
    if (dashboardData?.lastUpdated) {
      setStatusMessage(`Last refresh: ${dashboardData.lastUpdated} · v${APP_VERSION}`);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("appVersion", APP_VERSION);
      }
    } else if (!dashboardData) {
      setStatusMessage("");
    }
  }, [dashboardData]);

  const handleRefresh = async () => {
    setStatusMessage("Loading latest data…");
    setIsRefreshing(true);
    try {
      if (typeof window !== "undefined") {
        const storedVersion = window.localStorage.getItem("appVersion");
        if (storedVersion && storedVersion !== APP_VERSION) {
          window.localStorage.setItem("appVersion", APP_VERSION);
          window.location.reload();
          return;
        }
        window.localStorage.setItem("appVersion", APP_VERSION);
      }
      const result = await refetch();
      if (result.data) {
        setStatusMessage(`Last refresh: ${result.data.lastUpdated} · v${APP_VERSION}`);
      } else {
        setStatusMessage(`Last refresh: ${new Date().toLocaleString()} · v${APP_VERSION}`);
      }
    } catch (refreshError) {
      console.error("Refresh failed", refreshError);
      setStatusMessage(`Refresh failed · v${APP_VERSION}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === "lga") {
      const normalized = !value || value === "all" || value === "All LGAs" ? null : value;
      setSelectedLga(normalized);
      console.log(`Filter changed: ${filterType} = ${normalized ?? "All LGAs"}`);
      return;
    }

    console.log(`Filter changed: ${filterType} = ${value}`);
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

  const errorMessage =
    error?.message ?? "An unexpected error occurred while connecting to the dashboard service.";

  if (isError || !dashboardData?.summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage}
          </p>
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
              selectedLga={selectedLga}
            />
          }
        />
      </main>

      <footer className="border-t bg-background py-4">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          © 2025
        </div>
      </footer>
    </div>
  );
};

export default Index;
