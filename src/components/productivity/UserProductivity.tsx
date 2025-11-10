import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface ProductivityRow {
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

type Props = {
  data: ProductivityRow[];
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

export function UserProductivity({ data }: Props) {
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        total: acc.total + row.totalSubmissions,
        valid: acc.valid + row.validSubmissions,
        invalid: acc.invalid + row.invalidSubmissions,
        oddHour: acc.oddHour + row.oddHour,
        lowLoi: acc.lowLoi + row.lowLOI,
        outside: acc.outside + row.outsideLGA,
        duplicate: acc.duplicate + row.duplicate,
        errors: acc.errors + row.totalErrors,
      }),
      { total: 0, valid: 0, invalid: 0, oddHour: 0, lowLoi: 0, outside: 0, duplicate: 0, errors: 0 },
    );
  }, [data]);

  const exportCsv = () => {
    const headers = [
      "Interviewer",
      "Total",
      "Valid",
      "Invalid",
      "OddHour",
      "LowLOI",
      "OutsideLGA",
      "Duplicate",
      "TotalErrors",
    ];
    const rows = data.map((row) => ({
      Interviewer: row.interviewer,
      Total: row.totalSubmissions,
      Valid: row.validSubmissions,
      Invalid: row.invalidSubmissions,
      OddHour: row.oddHour,
      LowLOI: row.lowLOI,
      OutsideLGA: row.outsideLGA,
      Duplicate: row.duplicate,
      TotalErrors: row.totalErrors,
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `user_productivity_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Productivity</CardTitle>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
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
                <TableRow key={row.interviewer}>
                  <TableCell className="font-medium">{row.interviewer}</TableCell>
                  <TableCell className="text-right">{row.totalSubmissions.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-success">{row.validSubmissions.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{row.invalidSubmissions.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{row.oddHour.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{row.lowLOI.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{row.outsideLGA.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{row.duplicate.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{row.totalErrors.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    No productivity data available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {data.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Totals</TableCell>
                  <TableCell className="text-right font-semibold">{totals.total.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{totals.valid.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.invalid.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.oddHour.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.lowLoi.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.outside.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.duplicate.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{totals.errors.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
