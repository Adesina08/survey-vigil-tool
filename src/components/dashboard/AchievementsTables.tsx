import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from "react";

interface StateAchievement {
  state: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface InterviewerAchievement {
  interviewer: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface LGAAchievement {
  lga: string;
  state: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface AchievementsTablesProps {
  byState: StateAchievement[];
  byInterviewer: InterviewerAchievement[];
  byLGA: LGAAchievement[];
}

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = (headers: string[], rows: Array<Record<string, unknown>>, filename: string) => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  const csv = [headerLine, ...dataLines].join("\r\n");
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

const formatTotals = <T extends { total: number; approved: number; notApproved: number }>(rows: T[]) => {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      approved: acc.approved + row.approved,
      notApproved: acc.notApproved + row.notApproved,
    }),
    { total: 0, approved: 0, notApproved: 0 },
  );
};

export function AchievementsTables({ byState, byInterviewer, byLGA }: AchievementsTablesProps) {
  const stateTotals = useMemo(() => formatTotals(byState), [byState]);
  const interviewerTotals = useMemo(() => formatTotals(byInterviewer), [byInterviewer]);
  const lgaTotals = useMemo(() => formatTotals(byLGA), [byLGA]);

  const exportState = () => {
    const headers = ["state", "total", "approved", "notApproved", "percentageApproved"];
    const rows = byState.map((row) => ({
      state: row.state,
      total: row.total,
      approved: row.approved,
      notApproved: row.notApproved,
      percentageApproved: formatPercentage(row.percentageApproved),
    }));
    downloadCsv(headers, rows, `achievements_state_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportInterviewer = () => {
    const headers = ["interviewer", "total", "approved", "notApproved", "percentageApproved"];
    const rows = byInterviewer.map((row) => ({
      interviewer: row.interviewer,
      total: row.total,
      approved: row.approved,
      notApproved: row.notApproved,
      percentageApproved: formatPercentage(row.percentageApproved),
    }));
    downloadCsv(headers, rows, `achievements_interviewer_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportLga = () => {
    const headers = ["state", "lga", "total", "approved", "notApproved", "percentageApproved"];
    const rows = byLGA.map((row) => ({
      state: row.state,
      lga: row.lga,
      total: row.total,
      approved: row.approved,
      notApproved: row.notApproved,
      percentageApproved: formatPercentage(row.percentageApproved),
    }));
    downloadCsv(headers, rows, `achievements_lga_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Achievements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="interviewer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="state">By State</TabsTrigger>
            <TabsTrigger value="interviewer">By Interviewer</TabsTrigger>
            <TabsTrigger value="lga">By LGA</TabsTrigger>
          </TabsList>

          <TabsContent value="state">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={exportState} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export State Data
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Not Approved</TableHead>
                      <TableHead className="text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byState.map((row) => (
                      <TableRow key={row.state}>
                        <TableCell className="font-medium">{row.state}</TableCell>
                        <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">{row.approved.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-destructive">{row.notApproved.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPercentage(row.percentageApproved)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Overall Total</TableCell>
                      <TableCell className="text-right font-bold">{stateTotals.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-success">{stateTotals.approved.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{stateTotals.notApproved.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">
                        {stateTotals.total > 0 ? formatPercentage((stateTotals.approved / stateTotals.total) * 100) : "0.0%"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interviewer">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={exportInterviewer} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Interviewer Data
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interviewer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Not Approved</TableHead>
                      <TableHead className="text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byInterviewer.map((row) => (
                      <TableRow key={row.interviewer}>
                        <TableCell className="font-medium">{row.interviewer}</TableCell>
                        <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">
                          {row.approved.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.notApproved.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPercentage(row.percentageApproved)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Overall Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {interviewerTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {interviewerTotals.approved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {interviewerTotals.notApproved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {interviewerTotals.total > 0
                          ? formatPercentage((interviewerTotals.approved / interviewerTotals.total) * 100)
                          : "0.0%"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lga">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={exportLga} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export LGA Data
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LGA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Not Approved</TableHead>
                      <TableHead className="text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byLGA.map((row) => (
                      <TableRow key={`${row.state}-${row.lga}`}>
                        <TableCell className="font-medium">{row.lga}</TableCell>
                        <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">
                          {row.approved.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.notApproved.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPercentage(row.percentageApproved)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Overall Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {lgaTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {lgaTotals.approved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {lgaTotals.notApproved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {lgaTotals.total > 0
                          ? formatPercentage((lgaTotals.approved / lgaTotals.total) * 100)
                          : "0.0%"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
