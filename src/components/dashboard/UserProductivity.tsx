import { useMemo } from "react";
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
import { ResponsiveContainer, CartesianGrid, ComposedChart, Bar, XAxis, YAxis } from "recharts";
import { Crown, TrendingUp, Users } from "lucide-react";
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

export function UserProductivity({ data, errorTypes }: UserProductivityProps) {
  const sortedByValid = useMemo(
    () => [...data].sort((a, b) => b.validSubmissions - a.validSubmissions),
    [data],
  );

  const errorColumns = useMemo(() => {
    const unique = new Set<string>(errorTypes);
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
      sortedByValid.map((item) => ({
        id: item.interviewerId,
        label: item.interviewerId,
        fullLabel: item.interviewerId,
        ...errorColumns.reduce<Record<string, number>>((acc, errorType) => {
          acc[errorType] = item.errors[errorType] ?? 0;
          return acc;
        }, {}),
      })),
    [errorColumns, sortedByValid],
  );

  const chartConfig = useMemo(() => {
    const palette = [
      "hsl(var(--chart-1, var(--primary)))",
      "hsl(var(--chart-2, #9333ea))",
      "hsl(var(--chart-3, #f97316))",
      "hsl(var(--chart-4, #0ea5e9))",
      "hsl(var(--chart-5, #22c55e))",
      "hsl(var(--chart-6, #eab308))",
      "hsl(var(--chart-7, #ec4899))",
      "hsl(var(--chart-8, #14b8a6))",
      "hsl(var(--chart-9, #6366f1))",
    ];

    return errorColumns.reduce<Record<string, { label: string; color: string }>>((acc, errorType, index) => {
      acc[errorType] = {
        label: formatErrorLabel(errorType),
        color: palette[index % palette.length],
      };
      return acc;
    }, {});
  }, [errorColumns]);

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, interviewer) => {
          acc.total += interviewer.totalSubmissions;
          acc.valid += interviewer.validSubmissions;
          acc.invalid += interviewer.invalidSubmissions;
          return acc;
        },
        { total: 0, valid: 0, invalid: 0 },
      ),
    [data],
  );

  const topPerformers = sortedByValid.slice(0, 10);
  const topPerformer = topPerformers[0];

  const overallApprovalRate = totals.total > 0 ? (totals.valid / totals.total) * 100 : 0;
  const topApprovalRate = topPerformer ? topPerformer.approvalRate : 0;

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
                      <span>{topPerformer.interviewerId}</span>
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
                <p className="mt-2 text-2xl font-semibold text-foreground">{totals.total.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-2 text-2xl font-semibold text-success">{totals.valid.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flagged</p>
                <p className="mt-2 text-2xl font-semibold text-destructive">{totals.invalid.toLocaleString()}</p>
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
                {topPerformers.length === 0 ? (
                  <div className="rounded-lg border bg-background/80 p-4 text-sm text-muted-foreground">
                    Not enough data to display rankings.
                  </div>
                ) : (
                  topPerformers.map((performer, index) => (
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
                              #{index + 1}
                            </Badge>
                            <span className="font-semibold text-foreground">{performer.interviewerId}</span>
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
              <div className="rounded-2xl border bg-gradient-to-br from-background via-card to-muted/40 p-6 shadow-inner">
                <ChartContainer config={chartConfig} className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      {errorColumns.map((errorType, index) => (
                        <Bar
                          key={errorType}
                          dataKey={errorType}
                          stackId="flags"
                          fill={chartConfig[errorType]?.color ?? `hsl(var(--chart-${(index % 5) + 1}))`}
                          radius={index === errorColumns.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              <ScrollArea className="h-[420px] rounded-2xl border bg-background/80">
                <div className="min-w-[840px] p-2">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <TableRow className="bg-muted/60">
                        <TableHead className="w-[26%] sticky top-0 z-10 bg-background">Interviewer ID</TableHead>
                        <TableHead className="text-right sticky top-0 z-10 bg-background">Total interviews</TableHead>
                        <TableHead className="text-right sticky top-0 z-10 bg-background text-destructive">Flagged interviews</TableHead>
                        <TableHead className="text-right sticky top-0 z-10 bg-background">Flag rate</TableHead>
                        {errorColumns.map((errorType) => (
                          <TableHead key={errorType} className="text-right sticky top-0 z-10 bg-background">
                            {formatErrorLabel(errorType)}
                          </TableHead>
                        ))}
                        <TableHead className="text-right sticky top-0 z-10 bg-background">Total errors logged</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedByValid.map((row) => (
                        <TableRow key={row.interviewerId} className="group transition-colors hover:bg-primary/5">
                          <TableCell className="font-semibold">{row.interviewerId}</TableCell>
                          <TableCell className="text-right">{row.totalSubmissions.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-destructive">
                            {row.invalidSubmissions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {row.totalSubmissions > 0
                              ? `${((row.invalidSubmissions / row.totalSubmissions) * 100).toFixed(1)}%`
                              : "0.0%"}
                          </TableCell>
                          {errorColumns.map((errorType) => (
                            <TableCell key={errorType} className="text-right">
                              {(row.errors[errorType] ?? 0).toLocaleString()}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold text-destructive">
                            {row.totalErrors.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

