import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users } from "lucide-react";

interface InterviewerData {
  interviewer: string;
  totalSubmissions: number;
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
  const chartData = [...data]
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    .slice(0, 10)
    .map((item) => ({
      name: item.interviewer,
      submissions: item.totalSubmissions,
    }));

  return (
    <div className="space-y-4 fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            User Productivity Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="submissions" radius={[0, 8, 8, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`} opacity={1 - index * 0.05} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Breakdown by Interviewer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Interviewer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Odd Hour</TableHead>
                  <TableHead className="text-right">Low LOI</TableHead>
                  <TableHead className="text-right">Outside LGA</TableHead>
                  <TableHead className="text-right">Duplicate</TableHead>
                  <TableHead className="text-right">Total Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.interviewer} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{row.interviewer}</TableCell>
                    <TableCell className="text-right">{row.totalSubmissions}</TableCell>
                    <TableCell className="text-right text-destructive">{row.oddHour}</TableCell>
                    <TableCell className="text-right text-destructive">{row.lowLOI}</TableCell>
                    <TableCell className="text-right text-destructive">{row.outsideLGA}</TableCell>
                    <TableCell className="text-right text-destructive">{row.duplicate}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">{row.totalErrors}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
