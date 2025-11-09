import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProgressChartsProps {
  quotaProgress: number;
  statusBreakdown: {
    valid: number;
    invalid: number;
    terminated: number;
  };
}

export function ProgressCharts({ quotaProgress, statusBreakdown }: ProgressChartsProps) {
  const quotaData = [
    { name: "Achieved", value: quotaProgress },
    { name: "Remaining", value: 100 - quotaProgress },
  ];

  const statusData = [
    { name: "Valid", value: statusBreakdown.valid },
    { name: "Invalid", value: statusBreakdown.invalid },
    { name: "Terminated", value: statusBreakdown.terminated },
  ];

  const QUOTA_COLORS = ["hsl(var(--primary))", "hsl(var(--muted))"];
  const STATUS_COLORS = ["hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning))"];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="slide-in">
        <CardHeader>
          <CardTitle>Quota Progress</CardTitle>
        </CardHeader>
        <CardContent>
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

      <Card className="slide-in">
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
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
