import { useMemo } from "react";
import { RefreshCw, Menu, Download, CheckCircle, XCircle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createDashboardExcelExporter, type DashboardExportRow } from "@/lib/exportDashboard";
import type { ErrorBreakdownRow } from "@/lib/dashboardData";

interface DashboardHeaderProps {
  statusMessage: string;
  lastUpdated?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  exportRows?: DashboardExportRow[];
  errorBreakdown?: ErrorBreakdownRow[];
}

export function DashboardHeader({
  statusMessage,
  lastUpdated,
  onRefresh,
  isRefreshing,
  exportRows,
  errorBreakdown,
}: DashboardHeaderProps) {
  const versionLabel = typeof APP_VERSION_LABEL === "string" ? APP_VERSION_LABEL.trim() : "";
  const shouldShowVersion = versionLabel.length > 0;

  const shouldShowLastUpdated = (() => {
    if (!lastUpdated) {
      return false;
    }

    const parsed = new Date(lastUpdated);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear() > 1970 || parsed.getTime() > 0;
    }

    if (/1970/.test(lastUpdated)) {
      return false;
    }

    if (/invalid/i.test(lastUpdated)) {
      return false;
    }

    return true;
  })();

  const hasExportRows = Array.isArray(exportRows) && exportRows.length > 0;
  const exporter = useMemo(
    () =>
      createDashboardExcelExporter({
        rows: hasExportRows ? exportRows! : [],
        errorBreakdown: errorBreakdown ?? [],
      }),
    [errorBreakdown, exportRows, hasExportRows],
  );

  const handleExport = (type: "all" | "approved" | "notApproved" | "flags") => {
    if (!hasExportRows) {
      console.warn("No dashboard data available to export.");
      return;
    }

    switch (type) {
      case "approved":
        exporter.exportApproved();
        break;
      case "notApproved":
        exporter.exportNotApproved();
        break;
      case "flags":
        exporter.exportErrorFlags();
        break;
      case "all":
      default:
        exporter.exportAll();
        break;
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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
          </div>

          <div className="flex flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <div className="text-sm text-foreground sm:text-right">
              <div className="text-muted-foreground">Status</div>
              <div className="break-words font-medium">{statusMessage}</div>
              {shouldShowLastUpdated ? (
                <div className="text-xs text-muted-foreground">Latest submission: {lastUpdated}</div>
              ) : null}
              {shouldShowVersion ? (
                <div className="text-xs text-muted-foreground">Version {versionLabel}</div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  size="default"
                  className="w-full gap-2 sm:w-auto"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open export menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Export options</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleExport("all")} disabled={!hasExportRows}>
                        <Download className="mr-2 h-4 w-4" /> Export All Data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("approved")} disabled={!hasExportRows}>
                        <CheckCircle className="mr-2 h-4 w-4 text-success" /> Export Approved Data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("notApproved")} disabled={!hasExportRows}>
                        <XCircle className="mr-2 h-4 w-4 text-destructive" /> Export Not Approved Data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("flags")} disabled={!hasExportRows}>
                        <Flag className="mr-2 h-4 w-4 text-warning" /> Export Error Flags
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex justify-center sm:justify-end">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
