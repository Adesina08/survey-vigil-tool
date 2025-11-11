import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ErrorBreakdownRow } from "@/utils/qcMetrics";

interface ErrorBreakdownProps {
  totalErrors: number;
  rows: ErrorBreakdownRow[];
}

const typeStyles: Record<"flag" | "warning", string> = {
  flag: "text-destructive",
  warning: "text-amber-500",
};

export const ErrorBreakdown = ({ totalErrors, rows }: ErrorBreakdownProps) => (
  <Card className="border-none shadow-lg shadow-primary/10">
    <CardHeader>
      <CardTitle className="text-lg font-semibold">Error Breakdown</CardTitle>
      <p className="mt-1 text-sm text-muted-foreground">
        Aggregated QC flags and warnings with contribution to total issues.
      </p>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No QC errors reported.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error code</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className={`font-medium ${typeStyles[row.type]}`}>{row.label}</TableCell>
                  <TableCell className="text-right font-medium">{row.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`${typeStyles[row.type]} absolute inset-y-0 left-0 rounded-full bg-current`}
                          style={{ width: `${Math.min(row.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground">{row.percentage.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            Total QC issues counted: {totalErrors.toLocaleString()} across flags and warnings.
          </p>
        </div>
      )}
    </CardContent>
  </Card>
);

