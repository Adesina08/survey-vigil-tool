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
import {
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { Crown, TrendingUp, Users } from "lucide-react";
import { formatErrorLabel } from "@/lib/utils";

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
}

const tooltipBackground = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "16px",
  boxShadow: "0 18px 32px rgba(15, 23, 42, 0.16)",
};

const SubmissionTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }

  const counts = payload.filter((item) => item.dataKey === "valid" || item.dataKey === "invalid");
  const approval = payload.find((item) => item.dataKey === "approvalRate");
  const details = (payload[0]?.payload as { fullLabel?: string }) ?? {};
  const title = details.fullLabel ?? label;

  return (
    <div className="rounded-2xl border bg-popover p-4 shadow-lg" style={tooltipBackground}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-3 space-y-1.5 text-xs">
        {counts.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-medium text-foreground">
              {Number(item.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
        {approval ? (
          <div className="flex items-center justify-between gap-4 pt-1 text-xs">
            <span className="text-muted-foreground">Approval rate</span>
            <span className="font-semibold text-primary">
              {Number(approval.value ?? 0).toFixed(1)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const formatName = (interviewer: InterviewerData) => {
  if (
    interviewer.interviewerName &&
    interviewer.interviewerName !== interviewer.interviewerId
  ) {
    return interviewer.interviewerName;
  }
  return "";
};

export function UserProductivity({ data }: UserProductivityProps) {
  const sortedByValid = useMemo(
    () => [...data].sort((a, b) => b.validSubmissions - a.validSubmissions),
    [data],
  );

  const errorColumns = useMemo(() => {
    const totals = new Map<string, number>();
    data.forEach((row) => {
      Object.entries(row.errors).forEach(([errorType, count]) => {
        totals.set(errorType, (totals.get(errorType) ?? 0) + count);
      });
    });
    return Array.from(totals.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([errorType]) => errorType);
  }, [data]);

  const chartData = useMemo(
    () =>
      sortedByValid.map((item) => ({
        id: item.interviewerId,
        label: item.interviewerId,
        fullLabel: item.displayLabel,
        valid: item.validSubmissions,
        invalid: item.invalidSubmissions,
        approvalRate: Number(item.approvalRate.toFixed(1)),
        total: item.totalSubmissions,
      })),
    [sortedByValid],
  );

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
  const additionalTopPerformers = topPerformers.slice(1);

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
                      <div className="flex flex-col">
                        <span>{topPerformer.interviewerId}</span>
                        {formatName(topPerformer) ? (
                          <span className="text-sm font-normal text-muted-foreground">
                            {formatName(topPerformer)}
                          </span>
                        ) : null}
                      </div>
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Not approved</p>
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
                {additionalTopPerformers.length === 0 ? (
                  <div className="rounded-lg border bg-background/80 p-4 text-sm text-muted-foreground">
                    Not enough data to display rankings.
                  </div>
                ) : (
                  additionalTopPerformers.map((performer, index) => (
                    <div
                      key={performer.interviewerId}
                      className="rounded-lg border bg-background/80 p-4 shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/15 text-primary">
                              #{index + 2}
                            </Badge>
                            <span className="font-semibold text-foreground">{performer.interviewerId}</span>
                          </div>
                          {formatName(performer) ? (
                            <span className="text-xs text-muted-foreground">{formatName(performer)}</span>
                          ) : null}
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
              <div className="rounded-2xl border bg-gradient-to-br from-background via-card to-muted/40 p-4 shadow-inner">
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 32, right: 40, left: 160, bottom: 32 }}
                    barCategoryGap="20%"
                  >
                    <defs>
                      <linearGradient id="approvedGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.9} />
                      </linearGradient>
                      <linearGradient id="rejectedGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted-foreground) / 0.2)" />
                    <XAxis
                      xAxisId="counts"
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <XAxis
                      xAxisId="rate"
                      type="number"
                      orientation="top"
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={180}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--foreground))", fontWeight: 500 }}
                    />
                    <Tooltip content={<SubmissionTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                    <Legend verticalAlign="top" height={48} wrapperStyle={{ paddingBottom: 12 }} iconType="circle" />
                    <Bar
                      xAxisId="counts"
                      dataKey="valid"
                      name="Approved"
                      stackId="submissions"
                      fill="url(#approvedGradient)"
                      radius={[12, 0, 0, 12]}
                      maxBarSize={32}
                    />
                    <Bar
                      xAxisId="counts"
                      dataKey="invalid"
                      name="Not approved"
                      stackId="submissions"
                      fill="url(#rejectedGradient)"
                      radius={[0, 12, 12, 0]}
                      maxBarSize={32}
                    />
                    <Line
                      xAxisId="rate"
                      type="monotone"
                      dataKey="approvalRate"
                      name="Approval rate"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              <ScrollArea className="h-[420px] rounded-2xl border bg-background/80">
                <div className="min-w-[840px] p-2">
                  <Table>
                    <TableHeader className="bg-background/90">
                      <TableRow className="bg-muted/60">
                        <TableHead className="w-[26%]">Interviewer ID</TableHead>
                        <TableHead className="w-[20%]">Name</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right text-success">Approved</TableHead>
                        <TableHead className="text-right text-destructive">Not approved</TableHead>
                        <TableHead className="text-right">Approval %</TableHead>
                        {errorColumns.map((errorType) => (
                          <TableHead key={errorType} className="text-right">
                            {formatErrorLabel(errorType)}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row) => (
                        <TableRow key={row.interviewerId} className="group transition-colors hover:bg-primary/5">
                          <TableCell className="font-semibold">{row.interviewerId}</TableCell>
                          <TableCell className="text-sm">
                            {formatName(row) ? (
                              <span className="text-foreground">{formatName(row)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{row.totalSubmissions.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">
                            {row.validSubmissions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {row.invalidSubmissions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {row.approvalRate.toFixed(1)}%
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

