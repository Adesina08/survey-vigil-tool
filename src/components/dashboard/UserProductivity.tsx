import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Crown, TrendingUp, Users } from "lucide-react";

interface InterviewerData {
  interviewer: string;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  oddHour: number;
  lowLOI: number;
  outsideLGA: number;
  duplicate: number;
  totalErrors: number;
}

interface UserProductivityProps {
  data: InterviewerData[];
}

export function UserProductivity({ data }: UserProductivityProps) {
  const sortedByValid = [...data].sort((a, b) => b.validSubmissions - a.validSubmissions);
  const chartData = sortedByValid.map((item) => ({
    name: item.interviewer,
    valid: item.validSubmissions,
    invalid: item.invalidSubmissions,
  }));

  const topPerformers = sortedByValid.slice(0, 3);
  const topPerformer = topPerformers[0];

  const totals = data.reduce(
    (acc, interviewer) => {
      acc.total += interviewer.totalSubmissions;
      acc.valid += interviewer.validSubmissions;
      acc.invalid += interviewer.invalidSubmissions;
      return acc;
    },
    { total: 0, valid: 0, invalid: 0 }
  );

  const overallApprovalRate = totals.total > 0 ? (totals.valid / totals.total) * 100 : 0;
  const topApprovalRate =
    topPerformer && topPerformer.totalSubmissions > 0
      ? (topPerformer.validSubmissions / topPerformer.totalSubmissions) * 100
      : 0;

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
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                  {topPerformer ? (
                    <>
                      <Crown className="h-5 w-5 text-yellow-400" />
                      <span>{topPerformer.interviewer}</span>
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valid</p>
                <p className="mt-2 text-2xl font-semibold text-success">{totals.valid.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invalid</p>
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top 3 interviewers</p>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => {
                const approval =
                  performer.totalSubmissions > 0
                    ? (performer.validSubmissions / performer.totalSubmissions) * 100
                    : 0;
                return (
                  <div
                    key={performer.interviewer}
                    className="rounded-lg border bg-background/80 p-4 shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-primary/15 text-primary">
                            #{index + 1}
                          </Badge>
                          <span className="font-semibold text-foreground">{performer.interviewer}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {performer.validSubmissions.toLocaleString()} valid of {performer.totalSubmissions.toLocaleString()} interviews
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-success">
                        <TrendingUp className="h-4 w-4" />
                        {approval.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Submission quality overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 24, right: 32, left: 140, bottom: 16 }}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={160} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: 16 }} />
                <Bar
                  dataKey="valid"
                  name="Valid submissions"
                  stackId="submissions"
                  fill="hsl(var(--success))"
                  radius={[12, 0, 0, 12]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="invalid"
                  name="Invalid submissions"
                  stackId="submissions"
                  fill="hsl(var(--destructive))"
                  radius={[0, 12, 12, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[28%]">Interviewer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right text-success">Valid</TableHead>
                  <TableHead className="text-right text-destructive">Invalid</TableHead>
                  <TableHead className="text-right">Odd Hour</TableHead>
                  <TableHead className="text-right">Low LOI</TableHead>
                  <TableHead className="text-right">Outside LGA</TableHead>
                  <TableHead className="text-right">Duplicate</TableHead>
                  <TableHead className="text-right">Total Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const approval = row.totalSubmissions > 0
                    ? (row.validSubmissions / row.totalSubmissions) * 100
                    : 0;
                  return (
                    <TableRow
                      key={row.interviewer}
                      className="group transition-colors hover:bg-primary/5"
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{row.interviewer}</span>
                          <span className="text-xs text-muted-foreground">Approval: {approval.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.totalSubmissions.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">{row.validSubmissions.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">{row.invalidSubmissions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.oddHour.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.lowLOI.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.outsideLGA.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.duplicate.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {row.totalErrors.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
