import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { formatErrorLabel } from "@/lib/utils";

interface ErrorData {
  errorType: string;
  count: number;
  percentage: number;
}

interface ErrorBreakdownProps {
  data: ErrorData[];
}

export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ErrorData;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });

  const sortedData = [...data].sort((a, b) => {
    if (sortConfig.direction === "asc") {
      return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1;
    }
    return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1;
  });

  const handleSort = (key: keyof ErrorData) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc",
    });
  };

  const totalErrors = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Error Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error Type</TableHead>
                <TableHead
                  className="cursor-pointer text-right hover:text-primary"
                  onClick={() => handleSort("count")}
                >
                  Count {sortConfig.key === "count" && (sortConfig.direction === "desc" ? "↓" : "↑")}
                </TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow key={row.errorType}>
                  <TableCell className="font-medium">{formatErrorLabel(row.errorType)}</TableCell>
                  <TableCell className="text-right text-destructive font-semibold">
                    {row.count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex justify-between text-sm font-semibold">
            <span>Total Errors</span>
            <span className="text-destructive">{totalErrors.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
