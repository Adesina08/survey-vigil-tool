import { useCallback, useMemo, useState } from "react";
import type { AriaAttributes } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Crown, Download, TrendingUp, Users } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { cn, formatErrorLabel } from "@/lib/utils";

type SheetJS = typeof import("xlsx");

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

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

  const stringCollator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    [],
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

      const bothNumbers =
        typeof aValue === "number" && typeof bValue === "number" &&
        Number.isFinite(aValue) &&
        Number.isFinite(bValue);

      if (bothNumbers) {
        const numericComparison = aValue - bValue;
        if (numericComparison !== 0) {
          return numericComparison * multiplier;
        }
      } else {
        const comparison = stringCollator.compare(String(aValue ?? ""), String(bValue ?? ""));
        if (comparison !== 0) {
          return comparison * multiplier;
        }
      }

      const aLabel = (a.displayLabel || a.interviewerId).toLowerCase();
      const bLabel = (b.displayLabel || b.interviewerId).toLowerCase();
      return stringCollator.compare(aLabel, bLabel);
    });

    return rows;
  }, [rankedProductivity, sortState, stringCollator]);

  const handleSort = useCallback((column: string, type: "string" | "number" = "string") => {
    setSortState((previous) => {
      if (previous.column === column) {
        return { column, direction: previous.direction === "asc" ? "desc" : "asc" };
      }

      return { column, direction: type === "string" ? "asc" : "desc" };
    });
  }, []);

  const renderSortableHeaderCell = (
    column: string,
    label: string,
    options?: {
      dataType?: "string" | "number";
      align?: "left" | "right";
      className?: string;
      labelClassName?: string;
    },
  ) => {
    const { dataType = "string", align = "left", className, labelClassName } = options ?? {};
    const alignmentClasses =
      align === "right" ? "justify-end text-right" : "justify-between text-left";

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSort(column, dataType);
      }
    };

    return (
      <TableHead
        key={column}
        className={cn(
          "top-0 z-20 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          align === "right" ? "text-right" : "text-left",
          className,
          "cursor-pointer select-none",
        )}
        aria-sort={getAriaSort(column)}
        role="button"
        tabIndex={0}
        onClick={() => handleSort(column, dataType)}
        onKeyDown={handleKeyDown}
      >
        <div
          className={cn(
            "flex w-full items-center gap-1 text-xs font-semibold sm:text-sm",
            alignmentClasses,
            labelClassName,
          )}
        >
          <span>{label}</span>
          {renderSortIcon(column)}
        </div>
      </TableHead>
    );
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

  const handleExportTable = async () => {
    if (tableData.length === 0) {
      return;
    }

    try {
      const module = (await import("xlsx")) as SheetJS & { default?: SheetJS };
      const XLSX = module.default ?? module;

      const rows = tableData.map((row) => {
        const base: Record<string, string | number> = {
          Interviewer: row.displayLabel || row.interviewerId,
          "Total interviews": row.totalSubmissions,
          "Approved interviews": row.validSubmissions,
          "Flagged interviews": row.invalidSubmissions,
        };

        errorColumns.forEach((column) => {
          const label = formatErrorLabel(safeErrorLabelMap[column] ?? column);
          base[label] = row.errors?.[column] ?? 0;
        });

        return base;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Submission quality");

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `submission-quality-${sanitizeFileName(timestamp || "today") || "export"}.xlsx`;

      XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
    } catch (error) {
      console.error("Failed to export submission quality table", error);
    }
  };

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                Submission quality overview
              </CardTitle>
              <CardDescription className="text-primary-foreground/90">
                Monitor interviewer throughput and approvals to focus coaching where it will have the biggest impact.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={handleExportTable}
              variant="secondary"
              size="sm"
              className="gap-2 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
              disabled={tableData.length === 0}
            >
              <Download className="h-4 w-4" /> Export table
            </Button>
          </div>
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
                data-testid="submission-quality-table"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur">
                    <TableRow className="bg-muted/60">
                      {renderSortableHeaderCell("interviewerId", "Interviewer ID", {
                        dataType: "string",
                        className: "z-30 w-[26%] bg-background md:sticky md:left-0 md:top-0",
                        labelClassName: "text-foreground",
                      })}
                      {renderSortableHeaderCell("totalSubmissions", "Total interviews", {
                        dataType: "number",
                        align: "right",
                      })}
                      {renderSortableHeaderCell("validSubmissions", "Approved interviews", {
                        dataType: "number",
                        align: "right",
                        labelClassName: "text-success",
                      })}
                      {renderSortableHeaderCell("invalidSubmissions", "Flagged interviews", {
                        dataType: "number",
                        align: "right",
                        labelClassName: "text-destructive",
                      })}
                      {errorColumns.map((errorType) =>
                        renderSortableHeaderCell(
                          errorType,
                          formatErrorLabel(safeErrorLabelMap[errorType] ?? errorType),
                          {
                            dataType: "number",
                            align: "right",
                          },
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.interviewerId} className="group transition-colors hover:bg-primary/5">
                        <TableCell className="z-10 bg-background font-semibold md:sticky md:left-0">
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
