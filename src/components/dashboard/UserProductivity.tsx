import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users } from "lucide-react";

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
  const chartData = [...data]
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    .map((item) => ({
      name: item.interviewer,
      valid: item.validSubmissions,
      invalid: item.invalidSubmissions,
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
            <BarChart data={chartData} layout="vertical" margin={{ top: 32, right: 32, left: 120, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={140} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend verticalAlign="top" height={32} />
              <Bar
                dataKey="valid"
                name="Valid"
                stackId="submissions"
                fill="hsl(var(--success))"
                radius={[8, 0, 0, 8]}
              />
              <Bar
                dataKey="invalid"
                name="Invalid"
                stackId="submissions"
                fill="hsl(var(--destructive))"
                radius={[0, 8, 8, 0]}
              />
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
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Invalid</TableHead>
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
                    <TableCell className="text-right text-success">{row.validSubmissions}</TableCell>
                    <TableCell className="text-right text-destructive">{row.invalidSubmissions}</TableCell>
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
