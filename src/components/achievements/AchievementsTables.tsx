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

interface AchievementRow {
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface StateRow extends AchievementRow {
  state: string;
}

interface LGARow extends AchievementRow {
  state: string;
  lga: string;
}

interface InterviewerRow extends AchievementRow {
  interviewer: string;
}

type Props = {
  byState: StateRow[];
  byLGA: LGARow[];
  byInterviewer: InterviewerRow[];
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

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const calculateTotals = <T extends AchievementRow>(rows: T[]) => {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      approved: acc.approved + row.approved,
      notApproved: acc.notApproved + row.notApproved,
    }),
    { total: 0, approved: 0, notApproved: 0 },
  );
};

export function AchievementsTables({ byState, byLGA, byInterviewer }: Props) {
  const stateTotals = useMemo(() => calculateTotals(byState), [byState]);
  const lgaTotals = useMemo(() => calculateTotals(byLGA), [byLGA]);
  const interviewerTotals = useMemo(() => calculateTotals(byInterviewer), [byInterviewer]);

  const exportState = () => {
    const headers = ["State", "Total", "Valid", "Invalid", "PercentValid"];
    const rows = byState.map((row) => ({
      State: row.state,
      Total: row.total,
      Valid: row.approved,
      Invalid: row.notApproved,
      PercentValid: formatPercent(row.percentageApproved),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `achievements_state_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportLga = () => {
    const headers = ["State", "LGA", "Total", "Valid", "Invalid", "PercentValid"];
    const rows = byLGA.map((row) => ({
      State: row.state,
      LGA: row.lga,
      Total: row.total,
      Valid: row.approved,
      Invalid: row.notApproved,
      PercentValid: formatPercent(row.percentageApproved),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `achievements_lga_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportInterviewer = () => {
    const headers = ["Interviewer", "Total", "Valid", "Invalid", "PercentValid"];
    const rows = byInterviewer.map((row) => ({
      Interviewer: row.interviewer,
      Total: row.total,
      Valid: row.approved,
      Invalid: row.notApproved,
      PercentValid: formatPercent(row.percentageApproved),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `achievements_interviewer_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const renderFooter = (totals: { total: number; approved: number; notApproved: number }) => {
    const percent = totals.total > 0 ? (totals.approved / totals.total) * 100 : 0;
    return (
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Overall Total</TableCell>
          <TableCell className="text-right font-semibold">{totals.total.toLocaleString()}</TableCell>
          <TableCell className="text-right font-semibold text-success">{totals.approved.toLocaleString()}</TableCell>
          <TableCell className="text-right font-semibold text-destructive">{totals.notApproved.toLocaleString()}</TableCell>
          <TableCell className="text-right font-semibold">{formatPercent(percent)}</TableCell>
        </TableRow>
      </TableFooter>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Achievements by State</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportState}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Invalid</TableHead>
                  <TableHead className="text-right">% Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byState.map((row) => (
                  <TableRow key={row.state}>
                    <TableCell className="font-medium">{row.state}</TableCell>
                    <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success">{row.approved.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{row.notApproved.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPercent(row.percentageApproved)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {renderFooter(stateTotals)}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Achievements by LGA</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportLga}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Invalid</TableHead>
                  <TableHead className="text-right">% Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byLGA.map((row) => (
                  <TableRow key={`${row.state}-${row.lga}`}>
                    <TableCell className="font-medium">{row.state}</TableCell>
                    <TableCell className="font-medium">{row.lga}</TableCell>
                    <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success">{row.approved.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{row.notApproved.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPercent(row.percentageApproved)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {renderFooter(lgaTotals)}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Achievements by Interviewer</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportInterviewer}>
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
                  <TableHead className="text-right">% Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byInterviewer.map((row) => (
                  <TableRow key={row.interviewer}>
                    <TableCell className="font-medium">{row.interviewer}</TableCell>
                    <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success">{row.approved.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{row.notApproved.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPercent(row.percentageApproved)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {renderFooter(interviewerTotals)}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
