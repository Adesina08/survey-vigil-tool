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

type SortableKey = "count" | "computedPercentage";

export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKey;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });

  const filteredData = useMemo(
    () => data.filter((item) => !shouldOmitErrorType(item)),
    [data],
  );

  const totalErrors = filteredData.reduce((sum, item) => sum + item.count, 0);
  const enrichedData = filteredData.map((row) => ({
    ...row,
    computedPercentage: totalErrors > 0 ? (row.count / totalErrors) * 100 : 0,
  }));

  const sortedData = [...enrichedData].sort((a, b) => {
    const multiplier = sortConfig.direction === "asc" ? 1 : -1;
    if (sortConfig.key === "computedPercentage") {
      return (a.computedPercentage - b.computedPercentage) * multiplier;
    }
    return (a.count - b.count) * multiplier;
  });

  const handleSort = (key: SortableKey) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc",
    });
  };

  const totalPercentageRaw = enrichedData.reduce((sum, item) => sum + item.computedPercentage, 0);
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
              <TableHead className="z-30 bg-background text-xs font-semibold uppercase tracking-wide md:sticky md:left-0 md:top-0">
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
              <TableHead
                className="top-0 z-20 bg-background text-right text-xs font-semibold uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort("computedPercentage")}
              >
                Percentage
                {sortConfig.key === "computedPercentage" &&
                  ` ${sortConfig.direction === "desc" ? "↓" : "↑"}`}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow
                key={row.code ?? row.errorType}
                className="divide-x divide-border/50 hover:bg-muted/40"
              >
                <TableCell className="z-10 bg-background/95 font-medium text-foreground md:sticky md:left-0">
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
                  {row.computedPercentage.toFixed(1)}%
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
