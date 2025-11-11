import { Download, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SurveyRow } from "@/utils/qcMetrics";

interface ExportControlsProps {
  exports: {
    allRows: SurveyRow[];
    approvedRows: SurveyRow[];
    flaggedRows: SurveyRow[];
    errorRows: SurveyRow[];
  };
  filenamePrefix?: string;
}

const downloadJson = (rows: SurveyRow[], filename: string) => {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const ExportControls = ({ exports, filenamePrefix = "survey-data" }: ExportControlsProps) => {
  const isMobile = useIsMobile();

  const actions = [
    { key: "all", label: "Export All Data", rows: exports.allRows },
    { key: "approved", label: "Export Approved Data", rows: exports.approvedRows },
    { key: "flagged", label: "Export Not Approved Data", rows: exports.flaggedRows },
    { key: "errors", label: "Export Error Flags", rows: exports.errorRows },
  ];

  const handleExport = (key: string, rows: SurveyRow[]) => {
    downloadJson(rows, `${filenamePrefix}-${key}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`);
  };

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>Export Options</span>
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {actions.map((action) => (
            <DropdownMenuItem key={action.key} onSelect={() => handleExport(action.key, action.rows)}>
              <Download className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.key} variant="outline" className="gap-2" onClick={() => handleExport(action.key, action.rows)}>
          <Download className="h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
};

