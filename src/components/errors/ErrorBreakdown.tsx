import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { formatErrorLabel } from "@/lib/utils";

interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
}

type Props = {
  data: ErrorBreakdownRow[];
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsv = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  return [headerLine, ...dataLines].join("\r\n");
};

const triggerDownload = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function ErrorBreakdown({ data }: Props) {
  const exportCsv = () => {
    const headers = ["ErrorType", "Count", "Percent"];
    const rows = data.map((row) => ({
      ErrorType: formatErrorLabel(row.errorType),
      Count: row.count,
      Percent: row.percentage,
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `error_breakdown_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="space-y-6 p-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Error Breakdown</CardTitle>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 24, left: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="errorType" tickFormatter={(value) => formatErrorLabel(value).split(" ").slice(0, 3).join(" ")} />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value: number, _name, entry) => {
                  const percent = entry.payload.percentage?.toFixed(1);
                  return [`${value.toLocaleString()} (${percent ?? "0.0"}%)`, "Count"];
                }}
                labelFormatter={(label) => formatErrorLabel(label)}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.errorType}>
                  <TableCell className="font-medium">{formatErrorLabel(row.errorType)}</TableCell>
                  <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                    No error data available.
                  </TableCell>
                </TableRow>
              ) : null}
              {data.length > 0 ? (
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{total.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">100%</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
