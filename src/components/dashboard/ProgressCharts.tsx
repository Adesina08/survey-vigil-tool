import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProgressChartsProps {
  quotaProgress: number;
  statusBreakdown: {
    approved: number;
    notApproved: number;
  };
}

export function ProgressCharts({ quotaProgress, statusBreakdown }: ProgressChartsProps) {
  const safeQuotaProgress = Number.isFinite(quotaProgress) ? Math.max(quotaProgress, 0) : 0;
  const cappedQuotaProgress = Math.min(safeQuotaProgress, 100);

  const safeStatus = {
    approved: Math.max(statusBreakdown?.approved ?? 0, 0),
    notApproved: Math.max(statusBreakdown?.notApproved ?? 0, 0),
  };

  const quotaData = [
    { name: "Achieved", value: cappedQuotaProgress },
    { name: "Remaining", value: Math.max(100 - cappedQuotaProgress, 0) },
  ];

  const statusData = [
    { name: "Approved", value: safeStatus.approved },
    { name: "Not Approved", value: safeStatus.notApproved },
  ];

  const QUOTA_COLORS = ["hsl(var(--primary))", "hsl(var(--muted))"];
  const STATUS_COLORS = ["hsl(var(--success))", "hsl(var(--destructive))"];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="slide-in overflow-hidden border-none shadow-lg shadow-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle>Quota Progress</CardTitle>
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
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <div className="text-3xl font-bold text-primary">{quotaProgress}%</div>
            <div className="text-sm text-muted-foreground">of target achieved</div>
          </div>
        </CardContent>
      </Card>

      <Card className="slide-in overflow-hidden border-none shadow-lg shadow-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
          <CardTitle>Approval Breakdown</CardTitle>
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
