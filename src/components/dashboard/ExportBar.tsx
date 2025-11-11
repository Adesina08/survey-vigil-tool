import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, XCircle, Flag } from "lucide-react";
import { createDashboardCsvExporter, type DashboardExportRow } from "@/lib/exportDashboard";

interface ExportBarProps {
  rows: DashboardExportRow[];
  filenamePrefix?: string;
}

export function ExportBar({ rows, filenamePrefix = "ogstep-dashboard" }: ExportBarProps) {
  const hasRows = Array.isArray(rows) && rows.length > 0;

  const exporter = useMemo(
    () => createDashboardCsvExporter({ rows: Array.isArray(rows) ? rows : [], filenamePrefix }),
    [rows, filenamePrefix],
  );

  const handleExport = (type: "all" | "approved" | "notApproved" | "flags") => {
    if (!hasRows) {
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
    <div className="sticky bottom-0 z-10 hidden border-t bg-card px-4 py-4 sm:block sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap justify-center gap-2 text-center">
          <Button
            onClick={() => handleExport("all")}
            variant="default"
            size="sm"
            className="w-full gap-2 sm:w-auto"
            disabled={!hasRows}
          >
            <Download className="h-4 w-4" />
            Export All Data
          </Button>
          <Button
            onClick={() => handleExport("approved")}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-success text-success hover:bg-success/10 sm:w-auto"
            disabled={!hasRows}
          >
            <CheckCircle className="h-4 w-4" />
            Export Approved Data
          </Button>
          <Button
            onClick={() => handleExport("notApproved")}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-destructive text-destructive hover:bg-destructive/10 sm:w-auto"
            disabled={!hasRows}
          >
            <XCircle className="h-4 w-4" />
            Export Not Approved Data
          </Button>
          <Button
            onClick={() => handleExport("flags")}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-warning text-warning hover:bg-warning/10 sm:w-auto"
            disabled={!hasRows}
          >
            <Flag className="h-4 w-4" />
            Export Error Flags
          </Button>
        </div>
      </div>
    </div>
  );
}
