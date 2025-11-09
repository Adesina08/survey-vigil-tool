import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DashboardHeaderProps {
  lastRefreshed: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function DashboardHeader({ lastRefreshed, onRefresh, isRefreshing }: DashboardHeaderProps) {
  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
              <p className="text-sm text-muted-foreground">
                Real-time quality control dashboard for survey data
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Last refreshed</div>
              <div className="font-medium">{lastRefreshed}</div>
              <div className="text-xs text-muted-foreground">v1.0.0</div>
            </div>
            <Button
              onClick={onRefresh}
              disabled={isRefreshing}
              size="default"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
