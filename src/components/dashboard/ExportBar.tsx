import { Button } from "@/components/ui/button";
import { Download, CheckCircle, XCircle, Flag, ThumbsUp, Ban } from "lucide-react";

export function ExportBar() {
  const handleExport = (type: string) => {
    console.log(`Exporting ${type} data...`);
    // Backend integration point for export functionality
  };

  return (
    <div className="sticky bottom-0 z-10 border-t bg-card px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleExport("all")}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export All Data
          </Button>
          <Button
            onClick={() => handleExport("valid")}
            variant="outline"
            size="sm"
            className="gap-2 border-success text-success hover:bg-success/10"
          >
            <CheckCircle className="h-4 w-4" />
            Export Valid Data
          </Button>
          <Button
            onClick={() => handleExport("invalid")}
            variant="outline"
            size="sm"
            className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
            Export Invalid Data
          </Button>
          <Button
            onClick={() => handleExport("flags")}
            variant="outline"
            size="sm"
            className="gap-2 border-warning text-warning hover:bg-warning/10"
          >
            <Flag className="h-4 w-4" />
            Export Flags Only
          </Button>
          <Button
            onClick={() => handleExport("forceApproved")}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ThumbsUp className="h-4 w-4" />
            Export Force Approved
          </Button>
          <Button
            onClick={() => handleExport("forceCancelled")}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Ban className="h-4 w-4" />
            Export Force Cancelled
          </Button>
          <Button
            onClick={() => handleExport("bulkApproval")}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <ThumbsUp className="h-4 w-4" />
            Bulk Force Approval
          </Button>
          <Button
            onClick={() => handleExport("bulkCancellation")}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <Ban className="h-4 w-4" />
            Bulk Force Cancellation
          </Button>
        </div>
      </div>
    </div>
  );
}
