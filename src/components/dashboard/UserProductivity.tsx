import { useMemo, useState } from "react";
import type { AriaAttributes } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  data?: InterviewerData[];      // 👈 Optional
  errorTypes?: string[];
  errorLabels?: Record<string, string>;
}

export function UserProductivity({ data = [], errorTypes = [], errorLabels = {} }: UserProductivityProps) {
  // 👇 Safely handle undefined/null data
  const safeData = Array.isArray(data) ? data : [];
  const safeErrorTypes = Array.isArray(errorTypes) ? errorTypes : [];
  const [rankingView, setRankingView] = useState<"top" | "bottom">("top");
  const safeErrorLabelMap = useMemo(() => {
    if (!errorLabels || typeof errorLabels !== "object") {
      return {} as Record<string, string>;
    }
    return Object.entries(errorLabels).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key === "string" && typeof value === "string" && key.length > 0) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }, [errorLabels]);

  const rankedProductivity = useMemo(() => {
    if (safeData.length === 0) {
      return [];
    }

    const normalised = safeData.map((entry) => {
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
  }, [safeData]);

  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    rankedProductivity.forEach((row, index) => {
      map.set(row.interviewerId, index + 1);
    });
    return map;
  }, [rankedProductivity]);

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
    const unique = new Set<string>(safeErrorTypes);
    safeData.forEach((row) => {
      if (row.errors) {
        Object.keys(row.errors).forEach((errorType) => {
          unique.add(errorType);
        });
      }
    });
    return Array.from(unique)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .filter((value) => {
        const formatted = formatErrorLabel(value);
        if (!formatted) {
          return false;
        }
        return formatted.toLowerCase() !== "count";
      })
      .sort((a, b) => formatErrorLabel(a).localeCompare(formatErrorLabel(b)));
  }, [safeData, safeErrorTypes]);

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
  const chartHeight = Math.max(chartData.length * chartBaseHeight + 80, chartBaseHeight * 6);

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

  const overallApprovalRate =
    overallTotals.total > 0 ? (overallTotals.valid / overallTotals.total) * 100 : 0;
  const topPerformers = useMemo(() => rankedProductivity.slice(0, 10), [rankedProductivity]);
  const bottomPerformers = useMemo(() => {
    const slice = rankedProductivity.slice(-10);
    return slice.reverse();
  }, [rankedProductivity]);

  const activePerformers = rankingView === "top" ? topPerformers : bottomPerformers;
  const primaryPerformer = activePerformers[0];
  const remainingPerformers = activePerformers.slice(1);
  const primaryApprovalRate = primaryPerformer ? primaryPerformer.approvalRate : 0;
  const primaryTotals = primaryPerformer
    ? {
        total: primaryPerformer.totalSubmissions,
        valid: primaryPerformer.validSubmissions,
        invalid: primaryPerformer.invalidSubmissions,
      }
    : { total: 0, valid: 0, invalid: 0 };

  const performerLabel = rankingView === "top" ? "Top performer" : "Lowest performer";
  const listLabel = rankingView === "top" ? "Top 10 interviewers" : "Bottom 10 interviewers";
  const progressLabel =
    rankingView === "top" ? "Top performer approval rate" : "Lowest performer approval rate";

  // 👇 Show empty state if no data
  if (safeData.length === 0) {
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
          <CardContent className="bg-card/60 p-6">
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>No productivity data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <Card className="overflow-hidden border-none shadow-lg shadow-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Users className="h-5 w-5" />
                User Productivity Rankings
              </CardTitle>
              <p className="text-sm text-primary-foreground/80">
                Track interviewer performance, highlight key performers, and quickly spot where support is needed.
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={rankingView}
              onValueChange={(value) => {
                if (value === "top" || value === "bottom") {
                  setRankingView(value);
                }
              }}
              className="self-start rounded-md border bg-primary-foreground/10 p-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
            >
              <ToggleGroupItem value="top" className="px-3 py-1">
                Top 10
              </ToggleGroupItem>
              <ToggleGroupItem value="bottom" className="px-3 py-1">
                Last 10
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 bg-card/60 p-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6 rounded-lg border bg-background p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{performerLabel}</p>
                <div className="mt-2 flex items-center gap-3 text-lg font-semibold text-foreground">
                  {primaryPerformer ? (
                    <>
                      {rankingView === "top" ? (
                        <Crown className="h-5 w-5 text-yellow-400" />
                      ) : (
                        <ArrowDown className="h-5 w-5 text-destructive" />
                      )}
                      <span>{primaryPerformer.displayLabel || primaryPerformer.interviewerId}</span>
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
                  {primaryTotals.total.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-2 text-2xl font-semibold text-success">
                  {primaryTotals.valid.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flagged</p>
                <p className="mt-2 text-2xl font-semibold text-destructive">
                  {primaryTotals.invalid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">{progressLabel}</span>
                <span className="font-semibold text-foreground">{primaryApprovalRate.toFixed(1)}%</span>
              </div>
              <Progress value={primaryApprovalRate} className="h-3 bg-muted" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{listLabel}</p>
            <ScrollArea className="h-[360px] rounded-lg border bg-background/60 p-1">
              <div className="space-y-3 p-2">
                {remainingPerformers.length === 0 ? (
                  <div className="rounded-lg border bg-background/80 p-4 text-sm text-muted-foreground">
                    Not enough data to display additional rankings.
                  </div>
                ) : (
                  remainingPerformers.map((performer, index) => {
                    const globalRank = rankById.get(performer.interviewerId) ?? index + 2;
                    const approvalClass =
                      rankingView === "top" ? "text-success" : "text-destructive";
                    const ApprovalIcon = rankingView === "top" ? TrendingUp : ArrowDown;
                    return (
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
                              #{globalRank}
                            </Badge>
                            <span className="font-semibold text-foreground">{performer.displayLabel || performer.interviewerId}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {performer.validSubmissions.toLocaleString()} approved of {performer.totalSubmissions.toLocaleString()} interviews
                          </p>
                        </div>
                        <div className={cn("flex items-center gap-1 text-sm font-semibold", approvalClass)}>
                          <ApprovalIcon className="h-4 w-4" />
                          {performer.approvalRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    );
                  })
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
          <CardDescription className="text-primary-foreground/90">
            Monitor interviewer throughput and approvals to focus coaching where it will have the biggest impact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 bg-card/60 p-6">
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="mt-4">
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
                        margin={{ top: 32, right: 24, bottom: 56, left: 24 }}
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
                        <ChartLegend
                          verticalAlign="bottom"
                          align="left"
                          wrapperStyle={{ paddingTop: 24, marginTop: 16 }}
                          content={<ChartLegendContent className="justify-start" />}
                        />
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

            <TabsContent value="table" className="mt-4">
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
                            <span>{formatErrorLabel(safeErrorLabelMap[errorType] ?? errorType)}</span>
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
