import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { formatErrorLabel } from "@/lib/utils";

interface ErrorData {
  errorType: string;
  count: number;
  percentage: number;
  relatedVariables?: string[];
  code?: string;
}

interface ErrorBreakdownProps {
  data: ErrorData[];
}

const shouldOmitErrorType = (row: ErrorData) => {
  if (row.code) {
    return /count$/i.test(row.code);
  }
  return /^QC[\s_-]*(?:FLAG|WARN)[\s_-]*COUNT$/i.test(row.errorType.trim());
};

export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ErrorData;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });

  const filteredData = useMemo(
    () => data.filter((item) => !shouldOmitErrorType(item)),
    [data],
  );

  const sortedData = [...filteredData].sort((a, b) => {
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

  const totalErrors = filteredData.reduce((sum, item) => sum + item.count, 0);
  const totalPercentageRaw = filteredData.reduce((sum, item) => sum + item.percentage, 0);
  const totalPercentage = Math.min(Math.round(totalPercentageRaw * 10) / 10, 100);

  return (
    <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Error Breakdown
        </CardTitle>
        <CardDescription className="text-primary-foreground/90">
          Identify the most common data-quality flags and the questions they touch so you can guide enumerator coaching.
        </CardDescription>
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <Table
          containerClassName="max-h-[420px] overflow-x-auto overflow-y-auto"
          className="min-w-[720px] text-[13px]"
        >
          <TableHeader className="bg-background/95 backdrop-blur">
            <TableRow className="divide-x divide-border/60">
              <TableHead className="sticky left-0 top-0 z-30 bg-background text-xs font-semibold uppercase tracking-wide">
                Error Type
              </TableHead>
              <TableHead className="top-0 z-20 bg-background text-xs font-semibold uppercase tracking-wide">
                Related Variables
              </TableHead>
              <TableHead
                className="top-0 z-20 bg-background text-right text-xs font-semibold uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort("count")}
              >
                Count {sortConfig.key === "count" && (sortConfig.direction === "desc" ? "↓" : "↑")}
              </TableHead>
              <TableHead className="top-0 z-20 bg-background text-right text-xs font-semibold uppercase tracking-wide">
                Percentage
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow
                key={row.code ?? row.errorType}
                className="divide-x divide-border/50 hover:bg-muted/40"
              >
                <TableCell className="sticky left-0 z-10 bg-background/95 font-medium text-foreground">
                  {formatErrorLabel(row.errorType)}
                </TableCell>
                <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {(row.relatedVariables && row.relatedVariables.length > 0
                    ? row.relatedVariables
                    : ["—"]
                  ).join(", ")}
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {row.count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {row.percentage.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-6 border-t pt-4">
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground">Totals</span>
            <span className="text-muted-foreground">&nbsp;</span>
            <span className="text-right text-destructive">{totalErrors.toLocaleString()}</span>
            <span className="text-right">{totalPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
