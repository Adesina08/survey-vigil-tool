import { useCallback, useMemo } from "react";
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

type SimpleExportRow = Record<string, string | number>;

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

type SheetJS = typeof import("xlsx");

const toOneDecimal = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
};

const sanitizeSheetName = (raw: string): string => {
  const fallback = "Sheet1";
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const cleaned = raw.replace(/[\\/?*:]/g, " ").replace(/\[/g, " ").replace(/\]/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 31);
};

const sanitizeFileName = (label: string): string => {
  const fallback = "achievements";
  if (!label || typeof label !== "string") {
    return fallback;
  }

  const cleaned = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
};

const loadSheetModule = async (): Promise<SheetJS> => {
  const module = (await import("xlsx")) as SheetJS & { default?: SheetJS };
  return module.default ?? module;
};

const downloadAchievementsWorkbook = async (
  label: string,
  headers: string[],
  rows: SimpleExportRow[],
): Promise<void> => {
  if (typeof window === "undefined") {
    console.warn("Achievements export is only available in the browser context.");
    return;
  }

  try {
    const XLSX = await loadSheetModule();
    const data = [
      headers,
      ...rows.map((row) =>
        headers.map((header) => {
          const cell = row[header];
          return cell === undefined ? "" : cell;
        }),
      ),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(`${label} Achievements`));

    const fileName = `achievements-${sanitizeFileName(label)}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
  } catch (error) {
    console.error("Failed to export achievements workbook", error);
  }
};

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

type AchievementsExportType = "interviewer" | "lga" | "state";

interface AchievementsTablesProps {
  byInterviewer: InterviewerAchievement[];
  byLGA: LGAAchievement[];
}

export function AchievementsTables({ byInterviewer, byLGA }: AchievementsTablesProps) {
  // Add defensive checks to ensure arrays are valid
  const safeByInterviewer = Array.isArray(byInterviewer) ? byInterviewer : [];
  const safeByLGA = Array.isArray(byLGA) ? byLGA : [];
  const safeByState = useMemo<StateAchievement[]>(() => {
    if (safeByLGA.length === 0) {
      return [];
    }

    const aggregated = new Map<string, Omit<StateAchievement, "percentageApproved">>();

    safeByLGA.forEach((row) => {
      const stateKey = row?.state ?? "Unknown";
      const current = aggregated.get(stateKey) ?? {
        state: stateKey,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      };

      current.total += row?.total ?? 0;
      current.approved += row?.approved ?? 0;
      current.notApproved += row?.notApproved ?? 0;
      current.treatmentPathCount += row?.treatmentPathCount ?? 0;
      current.controlPathCount += row?.controlPathCount ?? 0;
      current.unknownPathCount += row?.unknownPathCount ?? 0;

      aggregated.set(stateKey, current);
    });

    return Array.from(aggregated.values())
      .map<StateAchievement>((entry) => ({
        ...entry,
        percentageApproved: entry.total > 0 ? (entry.approved / entry.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [safeByLGA]);

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

  const formatPercentage = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

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
            Track approvals by enumerator and LGA using OGSTEP sheet identifiers to spot momentum and quickly plug any coverage
            gaps.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <Tabs defaultValue="interviewer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="interviewer">By Interviewer</TabsTrigger>
            <TabsTrigger value="lga">By LGA</TabsTrigger>
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
                      <TableHead className="z-30 bg-background md:sticky md:left-0 md:top-0">Interviewer</TableHead>
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
                          <TableCell className="z-10 bg-background font-semibold md:sticky md:left-0">
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
                      <TableCell className="z-10 bg-background font-bold md:sticky md:left-0">Total</TableCell>
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
                className="min-w-[720px]"
              >
                  <TableHeader className="sticky top-0 z-20 bg-background">
                    <TableRow>
                      <TableHead className="z-30 bg-background md:sticky md:left-0 md:top-0">LGA</TableHead>
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
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No LGA data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeByLGA.map((row, idx) => (
                        <TableRow key={`${row?.state ?? 'unknown'}-${row?.lga ?? idx}`}>
                          <TableCell className="z-10 bg-background font-medium md:sticky md:left-0">
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
                      <TableCell className="z-10 bg-background font-bold md:sticky md:left-0">Total</TableCell>
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

        </Tabs>
      </CardContent>
    </Card>
  );
}
