import { Button } from "@/components/ui/button";
import { Download, CheckCircle, XCircle, Flag } from "lucide-react";

export function ExportBar() {
  const handleExport = (type: string) => {
    console.log(`Exporting ${type} data...`);
  };

  return (
    <div className="sticky bottom-0 z-10 border-t bg-card px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleExport("all")} variant="default" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export All Data
          </Button>
          <Button
            onClick={() => handleExport("approved")}
            variant="outline"
            size="sm"
            className="gap-2 border-success text-success hover:bg-success/10"
          >
            <CheckCircle className="h-4 w-4" />
            Export Approved Data
          </Button>
          <Button
            onClick={() => handleExport("notApproved")}
            variant="outline"
            size="sm"
            className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
            Export Not Approved Data
          </Button>
          <Button
            onClick={() => handleExport("flags")}
            variant="outline"
            size="sm"
            className="gap-2 border-warning text-warning hover:bg-warning/10"
          >
            <Flag className="h-4 w-4" />
            Export Error Flags
          </Button>
        </div>
      </div>
    </div>
  );
}
