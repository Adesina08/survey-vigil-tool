import { useMemo, useState } from "react";
import type { AriaAttributes } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CartesianGrid, ComposedChart, Bar, XAxis, YAxis, Label } from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, Crown, TrendingUp, Users } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { cn, formatErrorLabel } from "@/lib/utils";

interface InterviewerData {
  interviewerId: string;
  interviewerName: string;
  displayLabel: string;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  approvalRate: number;
  errors: Record<string, number>;
  totalErrors: number;
}

interface UserProductivityProps {
  data: InterviewerData[];
  errorTypes?: string[];
}

interface UserProductivityProps {
  data?: InterviewerData[];      // 👈 make it optional
  errorTypes?: string[];
}

export function UserProductivity({ data = [], errorTypes = [] }: UserProductivityProps) {
  // 👆 default to [] if data is undefined, and [] if errorTypes is undefined

  const rankedProductivity = useMemo(() => {
    const normalised = data.map((entry) => {
      const total = Math.max(entry.totalSubmissions ?? 0, 0);
      const valid = Math.max(entry.validSubmissions ?? 0, 0);
      const invalidFromSource = Math.max(entry.invalidSubmissions ?? 0, 0);
      const computedInvalid = Math.max(total - valid, 0);
      const invalid = Math.max(invalidFromSource, computedInvalid);
      const computedTotal = Math.max(total, valid + invalid);
      const approvalRate = computedTotal > 0 ? (valid / computedTotal) * 100 : 0;

      return {
        ...entry,
        totalSubmissions: computedTotal,
        validSubmissions: valid,
        invalidSubmissions: invalid,
        approvalRate,
      };
    });

    const compare = (a: InterviewerData, b: InterviewerData) => {
      if (b.validSubmissions !== a.validSubmissions) {
        return b.validSubmissions - a.validSubmissions;
      }
      if (a.invalidSubmissions !== b.invalidSubmissions) {
        return a.invalidSubmissions - b.invalidSubmissions;
      }
      if (b.totalSubmissions !== a.totalSubmissions) {
        return b.totalSubmissions - a.totalSubmissions;
      }
      return a.interviewerId.localeCompare(b.interviewerId);
    };

    return normalised.sort(compare);
  }, [data]);


  const [sortState, setSortState] = useState<{ column: string; direction: "asc" | "desc" }>(
    () => ({ column: "default", direction: "desc" })
  );

  const getSortValue = (row: InterviewerData, column: string): number | string => {
    if (column === "interviewerId") {
      return row.displayLabel || row.interviewerId;
    }

    if (column === "totalSubmissions") {
      return row.totalSubmissions ?? 0;
    }

    if (column === "validSubmissions") {
      return row.validSubmissions ?? 0;
    }

    if (column === "invalidSubmissions") {
      return row.invalidSubmissions ?? 0;
    }

    if (row.errors && column in row.errors) {
      return row.errors[column] ?? 0;
    }

    return 0;
  };

  const tableData = useMemo(() => {
    const rows = [...rankedProductivity];
    if (sortState.column === "default") {
      return rows;
    }

    const { column, direction } = sortState;
    const multiplier = direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const aValue = getSortValue(a, column);
      const bValue = getSortValue(b, column);

      if (typeof aValue === "number" && typeof bValue === "number") {
        if (aValue !== bValue) {
          return (aValue - bValue) * multiplier;
        }
      } else {
        const comparison = String(aValue).localeCompare(String(bValue), undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (comparison !== 0) {
          return comparison * multiplier;
        }
      }

      const aLabel = (a.displayLabel || a.interviewerId).toLowerCase();
      const bLabel = (b.displayLabel || b.interviewerId).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    return rows;
  }, [rankedProductivity, sortState]);

  const handleSort = (column: string, type: "string" | "number" = "string") => {
    setSortState((previous) => {
      if (previous.column === column) {
        return { column, direction: previous.direction === "asc" ? "desc" : "asc" };
      }

      return { column, direction: type === "string" ? "asc" : "desc" };
    });
  };

  const renderSortIcon = (column: string) => {
    if (sortState.column !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden />;
    }

    return sortState.direction === "asc" ? (
      <ArrowUp className="h-3 w-3" aria-hidden />
    ) : (
      <ArrowDown className="h-3 w-3" aria-hidden />
    );
  };

  const getAriaSort = (column: string): AriaAttributes["aria-sort"] => {
    if (sortState.column !== column) {
      return "none";
    }
    return sortState.direction === "asc" ? "ascending" : "descending";
  };

  const errorColumns = useMemo(() => {
    const unique = new Set<string>(errorTypes ?? []);
    data.forEach((row) => {
      Object.keys(row.errors).forEach((errorType) => {
        unique.add(errorType);
      });
    });
    return Array.from(unique)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [data, errorTypes]);

  const chartData = useMemo(
    () =>
      rankedProductivity.map((item) => ({
        id: item.interviewerId,
        label: item.displayLabel || item.interviewerId,
        fullLabel: item.displayLabel || item.interviewerId,
        approved: item.validSubmissions,
        notApproved: item.invalidSubmissions,
      })),
    [rankedProductivity],
  );

  const chartBaseHeight = 52;
  const chartHeight = Math.max(chartData.length * chartBaseHeight + 120, chartBaseHeight * 6);

  const chartConfig = useMemo(
    () => ({
      approved: {
        label: "Approved",
        color: "hsl(var(--success))",
      },
      notApproved: {
        label: "Not Approved",
        color: "hsl(var(--destructive))",
      },
    }),
    [],
  );

  const overallTotals = useMemo(
    () =>
      rankedProductivity.reduce(
        (acc, interviewer) => {
          acc.total += interviewer.totalSubmissions;
          acc.valid += interviewer.validSubmissions;
          acc.invalid += interviewer.invalidSubmissions;
          return acc;
        },
        { total: 0, valid: 0, invalid: 0 },
      ),
    [rankedProductivity],
  );

  const topPerformers = rankedProductivity.slice(0, 10);
  const topPerformer = topPerformers[0];
  const remainingTopPerformers = topPerformers.slice(1);

  const overallApprovalRate =
    overallTotals.total > 0 ? (overallTotals.valid / overallTotals.total) * 100 : 0;
  const topApprovalRate = topPerformer ? topPerformer.approvalRate : 0;
  const topPerformerTotals = topPerformer
    ? {
        total: topPerformer.totalSubmissions,
        valid: topPerformer.validSubmissions,
        invalid: topPerformer.invalidSubmissions,
      }
    : { total: 0, valid: 0, invalid: 0 };

  return (
    <div className="space-y-6 fade-in">
      <Card className="overflow-hidden border-none shadow-lg shadow-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5" />
            User Productivity Rankings
          </CardTitle>
          <p className="text-sm text-primary-foreground/80">
            Track interviewer performance, highlight top performers, and quickly spot where support is needed.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 bg-card/60 p-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6 rounded-lg border bg-background p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Performer</p>
                <div className="mt-2 flex items-center gap-3 text-lg font-semibold text-foreground">
                  {topPerformer ? (
                    <>
                      <Crown className="h-5 w-5 text-yellow-400" />
                      <span>{topPerformer.displayLabel || topPerformer.interviewerId}</span>
                    </>
                  ) : (
                    <span>No data available</span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Overall approval {overallApprovalRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total interviews</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {topPerformerTotals.total.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-2 text-2xl font-semibold text-success">
                  {topPerformerTotals.valid.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flagged</p>
                <p className="mt-2 text-2xl font-semibold text-destructive">
                  {topPerformerTotals.invalid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Top performer approval rate</span>
                <span className="font-semibold text-foreground">{topApprovalRate.toFixed(1)}%</span>
              </div>
              <Progress value={topApprovalRate} className="h-3 bg-muted" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top 10 interviewers</p>
            <ScrollArea className="h-[360px] rounded-lg border bg-background/60 p-1">
              <div className="space-y-3 p-2">
                {remainingTopPerformers.length === 0 ? (
                  <div className="rounded-lg border bg-background/80 p-4 text-sm text-muted-foreground">
                    Not enough data to display additional rankings.
                  </div>
                ) : (
                  remainingTopPerformers.map((performer, index) => (
                    <div
                      key={performer.interviewerId}
                      className={cn(
                        "rounded-lg border bg-background/80 p-4 shadow-sm transition-all hover:border-primary/60 hover:shadow-md",
                        index === 0 && "border-primary/60 bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/15 text-primary">
                              #{index + 2}
                            </Badge>
                            <span className="font-semibold text-foreground">{performer.displayLabel || performer.interviewerId}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {performer.validSubmissions.toLocaleString()} approved of {performer.totalSubmissions.toLocaleString()} interviews
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-success">
                          <TrendingUp className="h-4 w-4" />
                          {performer.approvalRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none shadow-lg shadow-primary/15">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />
            Submission quality overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 bg-card/60 p-6">
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="mt-6">
              <div className="mb-4 text-center text-sm font-semibold text-muted-foreground">
                Submission status by interviewer
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-background via-card to-muted/40 p-6 shadow-inner">
                <ScrollArea className="h-[420px] w-full">
                  <div className="pr-4">
                    <ChartContainer
                      config={chartConfig}
                      className="h-full w-full aspect-auto"
                      style={{ height: chartHeight }}
                    >
                      <ComposedChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 48, right: 32, bottom: 24, left: 24 }}
                        barCategoryGap={12}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" horizontal={false} />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          domain={[0, "dataMax"]}
                        >
                          <Label
                            value="Number of interviews"
                            position="bottom"
                            offset={16}
                            fill="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                        </XAxis>
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={180}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                        >
                          <Label
                            value="Interviewer"
                            angle={-90}
                            position="insideLeft"
                            offset={-12}
                            fill="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                        </YAxis>
                        <ChartTooltip
                          cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                          content={
                            <ChartTooltipContent
                              labelFormatter={(value, payload) =>
                                (payload?.[0]?.payload?.fullLabel as string | undefined) ?? (value as string)
                              }
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                          dataKey="approved"
                          stackId="status"
                          fill={chartConfig.approved.color}
                          radius={[0, 0, 0, 0]}
                          maxBarSize={32}
                        />
                        <Bar
                          dataKey="notApproved"
                          stackId="status"
                          fill={chartConfig.notApproved.color}
                          radius={[0, 6, 6, 0]}
                          maxBarSize={32}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              <Table
                containerClassName="max-h-[420px] overflow-auto rounded-2xl border bg-background/80"
                className="min-w-[960px]"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur">
                    <TableRow className="bg-muted/60">
                      <TableHead
                        className="sticky left-0 top-0 z-30 w-[26%] bg-background"
                        aria-sort={getAriaSort("interviewerId")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("interviewerId", "string")}
                          className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold text-foreground sm:text-sm"
                        >
                          <span>Interviewer ID</span>
                          {renderSortIcon("interviewerId")}
                        </button>
                      </TableHead>
                      <TableHead
                        className="top-0 z-20 bg-background text-right"
                        aria-sort={getAriaSort("totalSubmissions")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("totalSubmissions", "number")}
                          className="flex w-full items-center justify-end gap-1 text-right text-xs font-semibold text-foreground sm:text-sm"
                        >
                          <span>Total interviews</span>
                          {renderSortIcon("totalSubmissions")}
                        </button>
                      </TableHead>
                      <TableHead
                        className="top-0 z-20 bg-background text-right text-success"
                        aria-sort={getAriaSort("validSubmissions")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("validSubmissions", "number")}
                          className="flex w-full items-center justify-end gap-1 text-right text-xs font-semibold text-success sm:text-sm"
                        >
                          <span>Approved interviews</span>
                          {renderSortIcon("validSubmissions")}
                        </button>
                      </TableHead>
                      <TableHead
                        className="top-0 z-20 bg-background text-right text-destructive"
                        aria-sort={getAriaSort("invalidSubmissions")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("invalidSubmissions", "number")}
                          className="flex w-full items-center justify-end gap-1 text-right text-xs font-semibold text-destructive sm:text-sm"
                        >
                          <span>Flagged interviews</span>
                          {renderSortIcon("invalidSubmissions")}
                        </button>
                      </TableHead>
                      {errorColumns.map((errorType) => (
                        <TableHead
                          key={errorType}
                          className="top-0 z-20 bg-background text-right"
                          aria-sort={getAriaSort(errorType)}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(errorType, "number")}
                            className="flex w-full items-center justify-end gap-1 text-right text-xs font-semibold text-foreground sm:text-sm"
                          >
                            <span>{formatErrorLabel(errorType)}</span>
                            {renderSortIcon(errorType)}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.interviewerId} className="group transition-colors hover:bg-primary/5">
                        <TableCell className="sticky left-0 z-10 bg-background font-semibold">
                          {row.displayLabel || row.interviewerId}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.totalSubmissions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {row.validSubmissions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.invalidSubmissions.toLocaleString()}
                        </TableCell>
                        {errorColumns.map((errorType) => (
                          <TableCell key={errorType} className="text-right">
                            {(row.errors[errorType] ?? 0).toLocaleString()}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

