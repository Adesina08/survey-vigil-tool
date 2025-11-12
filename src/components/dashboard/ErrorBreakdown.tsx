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

const shouldOmitErrorType = (errorType: string) =>
  /^QC[\s_-]*(?:FLAG|WARN)[\s_-]*COUNT$/i.test(errorType.trim());

export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ErrorData;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });

  const filteredData = data.filter((item) => !shouldOmitErrorType(item.errorType));

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
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <Table
          containerClassName="max-h-[360px] overflow-auto"
          className="min-w-[520px]"
        >
            <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur">
              <TableRow>
                <TableHead className="sticky left-0 top-0 z-30 bg-background w-[55%] max-w-[340px]">
                  Error Type
                </TableHead>
                <TableHead
                  className="top-0 z-20 bg-background text-right hover:text-primary cursor-pointer w-[22%]"
                  onClick={() => handleSort("count")}
                >
                  Count {sortConfig.key === "count" && (sortConfig.direction === "desc" ? "↓" : "↑")}
                </TableHead>
                <TableHead className="top-0 z-20 bg-background text-right w-[23%]">
                  Percentage
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow key={row.errorType}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium pr-4 whitespace-normal break-words">
                    {formatErrorLabel(row.errorType)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    {row.count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
        <div className="mt-4 border-t pt-4">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground">Totals</span>
            <span className="text-right text-destructive">{totalErrors.toLocaleString()}</span>
            <span className="text-right">{totalPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
