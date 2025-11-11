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
import { ScrollArea } from "@/components/ui/scroll-area";

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
    return data.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        approved: acc.approved + row.approved,
        notApproved: acc.notApproved + row.notApproved,
        treatmentPathCount: acc.treatmentPathCount + (row.treatmentPathCount ?? 0),
        controlPathCount: acc.controlPathCount + (row.controlPathCount ?? 0),
        unknownPathCount: acc.unknownPathCount + (row.unknownPathCount ?? 0),
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

  const interviewerTotals = calculateTotals(byInterviewer);
  const lgaTotals = calculateTotals(byLGA);

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
              <ScrollArea className="h-80 rounded-xl border bg-background/80">
                <div className="min-w-[860px] p-2">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>Interviewer ID</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Not Approved</TableHead>
                        <TableHead className="text-right">Treatment</TableHead>
                        <TableHead className="text-right">Control</TableHead>
                        <TableHead className="text-right">% Approved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byInterviewer.map((row) => (
                        <TableRow key={row.interviewerId}>
                          <TableCell className="font-semibold">{row.interviewerId}</TableCell>
                          <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">
                            {row.approved.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {row.notApproved.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row.treatmentPathCount, "treatment")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row.controlPathCount, "control")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPercentage(row.percentageApproved)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
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
              </ScrollArea>
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
              <ScrollArea className="h-80 rounded-xl border bg-background/80">
                <div className="min-w-[860px] p-2">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>LGA</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Not Approved</TableHead>
                        <TableHead className="text-right">Treatment</TableHead>
                        <TableHead className="text-right">Control</TableHead>
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
                          <TableCell className="text-right">
                            {renderPathCell(row.treatmentPathCount, "treatment")}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderPathCell(row.controlPathCount, "control")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPercentage(row.percentageApproved)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
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
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
