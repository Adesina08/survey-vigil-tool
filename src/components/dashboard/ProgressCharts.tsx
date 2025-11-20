import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProgressChartsProps {
  quotaSummary: {
    achieved: number;
    remaining: number;
    target: number;
    achievedPercent: number;
  };
  statusBreakdown: {
    approved: number;
    notApproved: number;
    canceled?: number;
  };
}

export function ProgressCharts({ quotaSummary, statusBreakdown }: ProgressChartsProps) {
  const safeQuota = {
    achieved: Math.max(quotaSummary?.achieved ?? 0, 0),
    remaining: Math.max(quotaSummary?.remaining ?? 0, 0),
    target: Math.max(quotaSummary?.target ?? 0, 0),
    achievedPercent: Number.isFinite(quotaSummary?.achievedPercent)
      ? Math.max(quotaSummary.achievedPercent, 0)
      : 0,
  };

  const safeStatus = {
    approved: Math.max(statusBreakdown?.approved ?? 0, 0),
    notApproved: Math.max(statusBreakdown?.notApproved ?? 0, 0),
    canceled: Math.max(statusBreakdown?.canceled ?? 0, 0),
  };

  const notApprovedOnly = safeStatus.notApproved;

  const quotaData = [
    { name: "Achieved", value: safeQuota.achieved },
    { name: "Remaining", value: safeQuota.remaining },
  ];

  const statusData = [
    { name: "Approved", value: safeStatus.approved },
    { name: "Not Approved", value: notApprovedOnly },
    { name: "Canceled", value: safeStatus.canceled },
  ];

  const QUOTA_COLORS = ["hsl(var(--primary))", "hsl(var(--warning))"];
  const STATUS_COLORS = [
    "hsl(var(--success))",
    "hsl(var(--destructive))",
    "hsl(var(--warning))",
  ];

  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="slide-in overflow-hidden border-none shadow-lg shadow-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle>Quota Progress</CardTitle>
          <CardDescription className="text-primary-foreground/90">
            Monitor how fieldwork is tracking against the planned target.
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-card/60 p-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={quotaData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {quotaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={QUOTA_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <div className="text-2xl font-semibold text-primary">
              {formatNumber(safeQuota.achieved)} / {formatNumber(safeQuota.target)}
            </div>
            <div className="text-sm text-muted-foreground">
              {safeQuota.target > 0 ? formatPercent(safeQuota.achievedPercent) : "0.0%"} of target interviews
              completed
            </div>
            <div className="text-xs text-foreground">Remaining: {formatNumber(safeQuota.remaining)}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="slide-in overflow-hidden border-none shadow-lg shadow-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle>Approval Breakdown</CardTitle>
          <CardDescription className="text-primary-foreground/90">
            See the balance between validated and flagged interviews to prioritise follow-up reviews.
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-card/60 p-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
