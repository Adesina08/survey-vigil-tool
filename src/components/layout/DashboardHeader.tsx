import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  lastRefreshed: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  APP_VERSION: string;
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export function DashboardHeader({ lastRefreshed, onRefresh, isRefreshing, APP_VERSION }: Props) {
  const [status, setStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formattedStatus = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }
    return status;
  }, [errorMessage, status]);

  useEffect(() => {
    const formatted = formatTimestamp(lastRefreshed);
    setStatus(`Last refresh: ${formatted} · v${APP_VERSION}`);
    setErrorMessage(null);
  }, [lastRefreshed, APP_VERSION]);

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setErrorMessage(null);
    setStatus(`Refreshing… · v${APP_VERSION}`);

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("appVersion");
      if (stored && stored !== APP_VERSION) {
        window.localStorage.setItem("appVersion", APP_VERSION);
        window.location.reload();
        return;
      }
      window.localStorage.setItem("appVersion", APP_VERSION);
    }

    try {
      await onRefresh();
    } catch (error) {
      console.error("Dashboard refresh failed", error);
      setErrorMessage(`Refresh failed · v${APP_VERSION}`);
    }
  };

  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">OGSTEP SURVEY</h1>
            <p className="text-sm text-muted-foreground">Real-time quality control dashboard for survey data</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 text-sm md:items-end md:text-right">
          <span className="font-medium text-foreground">{formattedStatus}</span>
          <div className="flex items-center gap-3">
            <Button onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing" : "Refresh Data"}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
