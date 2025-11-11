import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QCTableColumn, QCTableRow, RankingEntry } from "@/utils/qcMetrics";

interface SubmissionQualityOverviewProps {
  chartData: RankingEntry[];
  qcTable: {
    columns: QCTableColumn[];
    rows: QCTableRow[];
  };
}

const chartColors = {
  approved: "#16a34a",
  flagged: "#dc2626",
};

export const SubmissionQualityOverview = ({ chartData, qcTable }: SubmissionQualityOverviewProps) => {
  const formattedChartData = useMemo(
    () =>
      chartData.map((entry) => ({
        interviewer: entry.interviewerId,
        approved: entry.approved,
        flagged: entry.flagged,
      })),
    [chartData],
  );

  const chartHeight = useMemo(() => Math.max(formattedChartData.length * 32 + 160, 320), [formattedChartData]);

  const qcColumns = useMemo(
    () => [
      { key: "interviewer", label: "Interviewer ID" },
      { key: "total", label: "Total interviews" },
      { key: "flagged", label: "Flagged interviews" },
      ...qcTable.columns,
    ],
    [qcTable.columns],
  );

  const getColumnClass = (type?: "flag" | "warning") => {
    if (type === "flag") return "text-destructive";
    if (type === "warning") return "text-amber-500";
    return "";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-none shadow-lg shadow-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Submission Quality Overview</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Stacked approvals vs. rejections per enumerator.
          </p>
        </CardHeader>
        <CardContent className="h-full">
          {formattedChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interview submissions found.</p>
          ) : (
            <div style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedChartData} layout="vertical" margin={{ left: 16, right: 16, top: 16, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    dataKey="interviewer"
                    type="category"
                    width={150}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="approved" stackId="a" fill={chartColors.approved} name="Approved" />
                  <Bar dataKey="flagged" stackId="a" fill={chartColors.flagged} name="Not Approved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg shadow-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">QC Detail by Enumerator</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Scroll to explore QC flags and warnings with sticky headers and interviewer column.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] w-full">
            <div className="min-w-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {qcColumns.map((column, index) => (
                      <TableHead
                        key={column.key}
                        className={`sticky top-0 z-30 bg-background text-xs uppercase tracking-wide text-muted-foreground ${
                          index === 0 ? "left-0 z-40" : ""
                        } ${getColumnClass((column as QCTableColumn).type)}`}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcTable.rows.map((row) => (
                    <TableRow key={row.interviewerId} className="odd:bg-muted/40">
                      {qcColumns.map((column) => {
                        if (column.key === "interviewer") {
                          return (
                            <TableCell
                              key={column.key}
                              className="sticky left-0 z-20 bg-background font-medium text-foreground"
                            >
                              {row.interviewerId}
                            </TableCell>
                          );
                        }
                        if (column.key === "total") {
                          return (
                            <TableCell key={column.key} className="text-right font-medium">
                              {row.total.toLocaleString()}
                            </TableCell>
                          );
                        }
                        if (column.key === "flagged") {
                          return (
                            <TableCell key={column.key} className="text-right font-semibold text-destructive">
                              {row.flagged.toLocaleString()}
                            </TableCell>
                          );
                        }
                        const value = row.qcValues[column.key] ?? 0;
                        return (
                          <TableCell
                            key={column.key}
                            className={`text-right font-mono text-sm ${getColumnClass((column as QCTableColumn).type)}`}
                          >
                            {value.toLocaleString()}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

