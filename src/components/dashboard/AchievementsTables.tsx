import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StateAchievement {
  state: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
}

interface InterviewerAchievement {
  interviewerId: string;
  interviewerName: string;
  displayLabel: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
}

interface LGAAchievement {
  lga: string;
  state: string;
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
}

type AchievementsExportType = "state" | "interviewer" | "lga";

interface AchievementsTablesProps {
  byState?: StateAchievement[];
  byInterviewer: InterviewerAchievement[];
  byLGA: LGAAchievement[];
}

type SimpleExportRow = Record<string, string | number>;
type SheetJS = typeof import("xlsx");

const toOneDecimal = (value: number | undefined | null) => Math.round((value ?? 0) * 10) / 10;

const sanitizeSheetName = (raw: string): string => {
  const fallback = "Sheet1";
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const cleaned = raw
    .replace(/[\\/?*:]/g, " ")
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 31);
};

const formatCurrentDateLabel = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createExportFileName = (label: string) => {
  const normalised = label
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  const suffix = normalised.length > 0 ? normalised : "DATA";
  return `OGSTEP_ACHIEVEMENTS_${suffix}_${formatCurrentDateLabel()}.xlsx`;
};

const buildSheetData = (headers: string[], rows: SimpleExportRow[]): Array<Array<string | number | null>> => {
  const headerRow = headers.map((header) => header ?? "");
  const bodyRows = rows.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value === undefined || value === null) {
        return null;
      }
      return value;
    }),
  );
  return [headerRow, ...bodyRows];
};

const loadSheetJS = async (): Promise<SheetJS> => {
  const module = (await import("xlsx")) as SheetJS & { default?: SheetJS };
  return module.default ?? module;
};

const downloadAchievementsWorkbook = async (
  label: string,
  headers: string[],
  rows: SimpleExportRow[],
) => {
  if (typeof window === "undefined") {
    console.warn("Achievements export is only supported in the browser context.");
    return;
  }

  if (!Array.isArray(headers) || headers.length === 0) {
    console.warn("No headers available for achievements export.");
    return;
  }

  try {
    const XLSX = await loadSheetJS();
    const workbook = XLSX.utils.book_new();
    const sheetName = sanitizeSheetName(`${label} Achievements`);
    const data = buildSheetData(headers, rows);
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, createExportFileName(label), {
      bookType: "xlsx",
      compression: true,
      sheet: sheetName,
    });
  } catch (error) {
    console.error("Failed to export achievements workbook", error);
  }
};

export function AchievementsTables({ byState = [], byInterviewer, byLGA }: AchievementsTablesProps) {
  // Add defensive checks to ensure arrays are valid
  const safeByState = Array.isArray(byState) ? byState : [];
  const safeByInterviewer = Array.isArray(byInterviewer) ? byInterviewer : [];
  const safeByLGA = Array.isArray(byLGA) ? byLGA : [];

  const calculateTotals = <
    T extends {
      total: number;
      approved: number;
      notApproved: number;
      treatmentPathCount?: number;
      controlPathCount?: number;
      unknownPathCount?: number;
    }
  >(
    data: T[],
  ) => {
    // Ensure data is always a valid array
    const safeData = Array.isArray(data) ? data : [];
    
    return safeData.reduce(
      (acc, row) => ({
        total: acc.total + (row?.total ?? 0),
        approved: acc.approved + (row?.approved ?? 0),
        notApproved: acc.notApproved + (row?.notApproved ?? 0),
        treatmentPathCount: acc.treatmentPathCount + (row?.treatmentPathCount ?? 0),
        controlPathCount: acc.controlPathCount + (row?.controlPathCount ?? 0),
        unknownPathCount: acc.unknownPathCount + (row?.unknownPathCount ?? 0),
      }),
      {
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      },
    );
  };

  const interviewerTotals = calculateTotals(safeByInterviewer);
  const lgaTotals = calculateTotals(safeByLGA);
  const stateTotals = calculateTotals(safeByState);

  const handleExport = useCallback(
    async (type: AchievementsExportType) => {
      let config: { label: string; headers: string[]; rows: SimpleExportRow[] } | null = null;

      if (type === "interviewer") {
        const headers = [
          "Interviewer",
          "Total",
          "Approved",
          "Not Approved",
          "Treatment",
          "Control",
          "Unknown",
          "% Approved",
        ];

        const rows: SimpleExportRow[] = safeByInterviewer.map((row) => ({
          Interviewer: row?.displayLabel ?? row?.interviewerId ?? "Unknown",
          Total: row?.total ?? 0,
          Approved: row?.approved ?? 0,
          "Not Approved": row?.notApproved ?? 0,
          Treatment: row?.treatmentPathCount ?? 0,
          Control: row?.controlPathCount ?? 0,
          Unknown: row?.unknownPathCount ?? 0,
          "% Approved": toOneDecimal(row?.percentageApproved ?? 0),
        }));

        rows.push({
          Interviewer: "Total",
          Total: interviewerTotals.total,
          Approved: interviewerTotals.approved,
          "Not Approved": interviewerTotals.notApproved,
          Treatment: interviewerTotals.treatmentPathCount,
          Control: interviewerTotals.controlPathCount,
          Unknown: interviewerTotals.unknownPathCount,
          "% Approved":
            interviewerTotals.total > 0
              ? toOneDecimal((interviewerTotals.approved / interviewerTotals.total) * 100)
              : 0,
        });

        config = { label: "Interviewer", headers, rows };
      } else if (type === "lga") {
        const headers = [
          "State",
          "LGA",
          "Total",
          "Approved",
          "Not Approved",
          "Treatment",
          "Control",
          "Unknown",
          "% Approved",
        ];

        const rows: SimpleExportRow[] = safeByLGA.map((row) => ({
          State: row?.state ?? "Unknown",
          LGA: row?.lga ?? "Unknown",
          Total: row?.total ?? 0,
          Approved: row?.approved ?? 0,
          "Not Approved": row?.notApproved ?? 0,
          Treatment: row?.treatmentPathCount ?? 0,
          Control: row?.controlPathCount ?? 0,
          Unknown: row?.unknownPathCount ?? 0,
          "% Approved": toOneDecimal(row?.percentageApproved ?? 0),
        }));

        rows.push({
          State: "Total",
          LGA: "",
          Total: lgaTotals.total,
          Approved: lgaTotals.approved,
          "Not Approved": lgaTotals.notApproved,
          Treatment: lgaTotals.treatmentPathCount,
          Control: lgaTotals.controlPathCount,
          Unknown: lgaTotals.unknownPathCount,
          "% Approved":
            lgaTotals.total > 0 ? toOneDecimal((lgaTotals.approved / lgaTotals.total) * 100) : 0,
        });

        config = { label: "LGA", headers, rows };
      } else if (type === "state") {
        const headers = [
          "State",
          "Total",
          "Approved",
          "Not Approved",
          "Treatment",
          "Control",
          "Unknown",
          "% Approved",
        ];

        const rows: SimpleExportRow[] = safeByState.map((row) => ({
          State: row?.state ?? "Unknown",
          Total: row?.total ?? 0,
          Approved: row?.approved ?? 0,
          "Not Approved": row?.notApproved ?? 0,
          Treatment: row?.treatmentPathCount ?? 0,
          Control: row?.controlPathCount ?? 0,
          Unknown: row?.unknownPathCount ?? 0,
          "% Approved": toOneDecimal(row?.percentageApproved ?? 0),
        }));

        rows.push({
          State: "Total",
          Total: stateTotals.total,
          Approved: stateTotals.approved,
          "Not Approved": stateTotals.notApproved,
          Treatment: stateTotals.treatmentPathCount,
          Control: stateTotals.controlPathCount,
          Unknown: stateTotals.unknownPathCount,
          "% Approved":
            stateTotals.total > 0 ? toOneDecimal((stateTotals.approved / stateTotals.total) * 100) : 0,
        });

        config = { label: "State", headers, rows };
      }

      if (!config) {
        return;
      }

      await downloadAchievementsWorkbook(config.label, config.headers, config.rows);
    },
    [safeByInterviewer, safeByLGA, safeByState, interviewerTotals, lgaTotals, stateTotals],
  );

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const renderPathCell = (
    count: number,
    variant: "treatment" | "control" | "unknown",
  ) => {
    const label =
      variant === "treatment"
        ? "Treatment"
        : variant === "control"
          ? "Control"
          : "Path unknown";
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-right font-medium" aria-label={`${label} path submissions`}>
          {count.toLocaleString()}
        </span>
      </div>
    );
  };

  return (
    <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription className="text-primary-foreground/90">
            Track approvals by enumerator, LGA, and state using OGSTEP sheet identifiers to spot momentum and quickly plug any
            coverage gaps.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <Tabs defaultValue="interviewer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="interviewer">By Interviewer</TabsTrigger>
            <TabsTrigger value="lga">By LGA</TabsTrigger>
            <TabsTrigger value="state">By State</TabsTrigger>
          </TabsList>

          <TabsContent value="interviewer">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => void handleExport("interviewer")} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Interviewer Data
                </Button>
              </div>
              <Table
                containerClassName="max-h-80 overflow-auto rounded-xl border bg-background/80"
                className="min-w-[860px]"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 top-0 z-30 bg-background">Interviewer</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Total</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Not Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Treatment</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Control</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Unknown</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeByInterviewer.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No interviewer data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeByInterviewer.map((row) => (
                        <TableRow key={row?.interviewerId ?? `interviewer-${Math.random()}`}>
                          <TableCell className="sticky left-0 z-10 bg-background font-semibold">
                            {row?.displayLabel ?? row?.interviewerId ?? "Unknown"}
                          </TableCell>
                          <TableCell className="text-right">{(row?.total ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">
                            {(row?.approved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {(row?.notApproved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.treatmentPathCount ?? 0, "treatment")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.controlPathCount ?? 0, "control")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.unknownPathCount ?? 0, "unknown")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPercentage(row?.percentageApproved ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="sticky left-0 z-10 bg-background font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {interviewerTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {interviewerTotals.approved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {interviewerTotals.notApproved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(interviewerTotals.treatmentPathCount, "treatment")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(interviewerTotals.controlPathCount, "control")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(interviewerTotals.unknownPathCount, "unknown")}
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
          </TabsContent>

          <TabsContent value="lga">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => void handleExport("lga")} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export LGA Data
                </Button>
              </div>
              <Table
                containerClassName="max-h-80 overflow-auto rounded-xl border bg-background/80"
                className="min-w-[860px]"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 top-0 z-30 bg-background">State</TableHead>
                      <TableHead className="sticky left-[140px] top-0 z-30 bg-background">LGA</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Total</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Not Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Treatment</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Control</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Unknown</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeByLGA.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No LGA data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeByLGA.map((row, idx) => (
                        <TableRow key={`${row?.state ?? 'unknown'}-${row?.lga ?? idx}`}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium">
                            {row?.state ?? "Unknown"}
                          </TableCell>
                          <TableCell className="sticky left-[140px] z-10 bg-background font-medium">
                            {row?.lga ?? "Unknown"}
                          </TableCell>
                          <TableCell className="text-right">{(row?.total ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">
                            {(row?.approved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {(row?.notApproved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.treatmentPathCount ?? 0, "treatment")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.controlPathCount ?? 0, "control")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.unknownPathCount ?? 0, "unknown")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPercentage(row?.percentageApproved ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="sticky left-0 z-10 bg-background font-bold" colSpan={2}>
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {lgaTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {lgaTotals.approved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {lgaTotals.notApproved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(lgaTotals.treatmentPathCount, "treatment")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(lgaTotals.controlPathCount, "control")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(lgaTotals.unknownPathCount, "unknown")}
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
          </TabsContent>

          <TabsContent value="state">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => void handleExport("state")} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export State Data
                </Button>
              </div>
              <Table
                containerClassName="max-h-80 overflow-auto rounded-xl border bg-background/80"
                className="min-w-[720px]"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 top-0 z-30 bg-background">State</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Total</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Not Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Treatment</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Control</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Unknown</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeByState.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          No state data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeByState.map((row) => (
                        <TableRow key={row?.state ?? `state-${Math.random()}`}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium">
                            {row?.state ?? "Unknown"}
                          </TableCell>
                          <TableCell className="text-right">{(row?.total ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">
                            {(row?.approved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {(row?.notApproved ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.treatmentPathCount ?? 0, "treatment")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.controlPathCount ?? 0, "control")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row?.unknownPathCount ?? 0, "unknown")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPercentage(row?.percentageApproved ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="sticky left-0 z-10 bg-background font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {stateTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {stateTotals.approved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {stateTotals.notApproved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(stateTotals.treatmentPathCount, "treatment")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(stateTotals.controlPathCount, "control")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPathCell(stateTotals.unknownPathCount, "unknown")}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {stateTotals.total > 0
                          ? formatPercentage((stateTotals.approved / stateTotals.total) * 100)
                          : "0.0%"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
