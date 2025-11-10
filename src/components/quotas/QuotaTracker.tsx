import { useMemo } from "react";

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
import { Progress } from "@/components/ui/progress";
import { Download } from "lucide-react";

type StateQuota = {
  state: string;
  target: number;
  achieved: number;
};

type AgeQuota = {
  state: string;
  ageGroup: string;
  target: number;
  achieved: number;
};

type GenderQuota = {
  state: string;
  gender: string;
  target: number;
  achieved: number;
};

type Props = {
  states: StateQuota[];
  ages: AgeQuota[];
  genders: GenderQuota[];
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

export function QuotaTracker({ states, ages, genders }: Props) {
  const sortedStates = useMemo(() => {
    return [...states].sort((a, b) => a.state.localeCompare(b.state));
  }, [states]);

  const sortedAges = useMemo(() => {
    return [...ages].sort((a, b) => {
      const stateCompare = a.state.localeCompare(b.state);
      if (stateCompare !== 0) return stateCompare;
      return a.ageGroup.localeCompare(b.ageGroup);
    });
  }, [ages]);

  const sortedGenders = useMemo(() => {
    return [...genders].sort((a, b) => {
      const stateCompare = a.state.localeCompare(b.state);
      if (stateCompare !== 0) return stateCompare;
      return a.gender.localeCompare(b.gender);
    });
  }, [genders]);

  const exportStates = () => {
    const headers = ["State", "Target", "Achieved", "Balance", "PercentComplete"];
    const rows = sortedStates.map((row) => ({
      State: row.state,
      Target: row.target,
      Achieved: row.achieved,
      Balance: Math.max(row.target - row.achieved, 0),
      PercentComplete: formatPercent(row.target > 0 ? (row.achieved / row.target) * 100 : 0),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `quota_states_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportAges = () => {
    const headers = ["State", "AgeGroup", "Target", "Achieved", "Balance", "PercentComplete"];
    const rows = sortedAges.map((row) => ({
      State: row.state,
      AgeGroup: row.ageGroup,
      Target: row.target,
      Achieved: row.achieved,
      Balance: Math.max(row.target - row.achieved, 0),
      PercentComplete: formatPercent(row.target > 0 ? (row.achieved / row.target) * 100 : 0),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `quota_age_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportGenders = () => {
    const headers = ["State", "Gender", "Target", "Achieved", "Balance", "PercentComplete"];
    const rows = sortedGenders.map((row) => ({
      State: row.state,
      Gender: row.gender,
      Target: row.target,
      Achieved: row.achieved,
      Balance: Math.max(row.target - row.achieved, 0),
      PercentComplete: formatPercent(row.target > 0 ? (row.achieved / row.target) * 100 : 0),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `quota_gender_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quota Progress by State</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportStates}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedStates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No state quota data available.</p>
          ) : (
            sortedStates.map((row) => {
              const percent = row.target > 0 ? (row.achieved / row.target) * 100 : 0;
              return (
                <div key={row.state} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{row.state}</span>
                    <span>
                      {row.achieved.toLocaleString()} / {row.target.toLocaleString()} ({formatPercent(percent)})
                    </span>
                  </div>
                  <Progress value={Math.min(percent, 100)} />
                  <div className="text-xs text-muted-foreground">
                    Balance: {Math.max(row.target - row.achieved, 0).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quota by Age Group</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportAges}>
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
                  <TableHead>Age Group</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Achieved</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">% Complete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAges.map((row, index) => {
                  const percent = row.target > 0 ? (row.achieved / row.target) * 100 : 0;
                  return (
                    <TableRow key={`${row.state}-${row.ageGroup}-${index}`}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell>{row.ageGroup}</TableCell>
                      <TableCell className="text-right">{row.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">{row.achieved.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Math.max(row.target - row.achieved, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPercent(percent)}</TableCell>
                    </TableRow>
                  );
                })}
                {sortedAges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No age breakdown data available.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quota by Gender</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportGenders}>
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
                  <TableHead>Gender</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Achieved</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">% Complete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGenders.map((row, index) => {
                  const percent = row.target > 0 ? (row.achieved / row.target) * 100 : 0;
                  return (
                    <TableRow key={`${row.state}-${row.gender}-${index}`}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell>{row.gender}</TableCell>
                      <TableCell className="text-right">{row.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">{row.achieved.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Math.max(row.target - row.achieved, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPercent(percent)}</TableCell>
                    </TableRow>
                  );
                })}
                {sortedGenders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No gender breakdown data available.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
