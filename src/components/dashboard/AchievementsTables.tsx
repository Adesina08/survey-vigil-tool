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

export function AchievementsTables({ byState: _byState, byInterviewer, byLGA }: AchievementsTablesProps) {
  const handleExport = (type: string) => {
    console.log(`Exporting ${type} achievements...`);
  };

  const calculateTotals = (data: any[]) => {
    return data.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        approved: acc.approved + row.approved,
        notApproved: acc.notApproved + row.notApproved,
      }),
      { total: 0, approved: 0, notApproved: 0 }
    );
  };

  const interviewerTotals = calculateTotals(byInterviewer);
  const lgaTotals = calculateTotals(byLGA);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

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
                <div className="min-w-[720px] p-2">
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
                <div className="min-w-[720px] p-2">
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
