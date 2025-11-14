import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface AchievementsTablesProps {
  byState: StateAchievement[];
  byInterviewer: InterviewerAchievement[];
  byLGA: LGAAchievement[];
}

export function AchievementsTables({ byState: _byState, byInterviewer, byLGA }: AchievementsTablesProps) {
  // Add defensive checks to ensure arrays are valid
  const safeByInterviewer = Array.isArray(byInterviewer) ? byInterviewer : [];
  const safeByLGA = Array.isArray(byLGA) ? byLGA : [];

  const handleExport = (type: string) => {
    console.log(`Exporting ${type} achievements...`);
  };

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

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const renderPathCell = (count: number, variant: "treatment" | "control") => {
    const label = variant === "treatment" ? "Treatment" : "Control";
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
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Achievements
        </CardTitle>
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
                <Button onClick={() => handleExport("interviewer")} variant="outline" size="sm" className="gap-2">
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
                      <TableHead className="sticky left-0 top-0 z-30 bg-background">Interviewer ID</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Total</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Not Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Treatment</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Control</TableHead>
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
                            {row?.interviewerId ?? "Unknown"}
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
                <Button onClick={() => handleExport("lga")} variant="outline" size="sm" className="gap-2">
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
                      <TableHead className="sticky left-0 top-0 z-30 bg-background">LGA</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Total</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Not Approved</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Treatment</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">Control</TableHead>
                      <TableHead className="top-0 z-20 bg-background text-right">% Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeByLGA.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No LGA data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeByLGA.map((row, idx) => (
                        <TableRow key={`${row?.state ?? 'unknown'}-${row?.lga ?? idx}`}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium">
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
