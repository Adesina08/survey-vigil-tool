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
  valid: number;
  invalid: number;
  percentageValid: number;
}

interface InterviewerAchievement {
  interviewer: string;
  total: number;
  valid: number;
  invalid: number;
  percentageValid: number;
}

interface LGAAchievement {
  lga: string;
  state: string;
  total: number;
  valid: number;
  invalid: number;
  percentageValid: number;
}

interface AchievementsTablesProps {
  byState: StateAchievement[];
  byInterviewer: InterviewerAchievement[];
  byLGA: LGAAchievement[];
}

export function AchievementsTables({ byState, byInterviewer, byLGA }: AchievementsTablesProps) {
  const handleExport = (type: string) => {
    console.log(`Exporting ${type} achievements...`);
    // Backend integration point
  };

  const calculateTotals = (data: any[]) => {
    return data.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        valid: acc.valid + row.valid,
        invalid: acc.invalid + row.invalid,
      }),
      { total: 0, valid: 0, invalid: 0 }
    );
  };

  const stateTotals = calculateTotals(byState);
  const interviewerTotals = calculateTotals(byInterviewer);
  const lgaTotals = calculateTotals(byLGA);

  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Achievements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="state" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="state">By State</TabsTrigger>
            <TabsTrigger value="interviewer">By Interviewer</TabsTrigger>
            <TabsTrigger value="lga">By LGA</TabsTrigger>
          </TabsList>

          <TabsContent value="state">
            <div className="space-y-4">
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
                        <TableCell className="text-right text-success">
                          {row.valid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.invalid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.percentageValid.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {stateTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {stateTotals.valid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {stateTotals.invalid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {((stateTotals.valid / stateTotals.total) * 100).toFixed(1)}%
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
                <Button
                  onClick={() => handleExport("interviewer")}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
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
                        <TableCell className="text-right text-success">
                          {row.valid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.invalid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.percentageValid.toFixed(1)}%
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
                        {interviewerTotals.valid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {interviewerTotals.invalid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {((interviewerTotals.valid / interviewerTotals.total) * 100).toFixed(1)}%
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
                <Button
                  onClick={() => handleExport("lga")}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export LGA Data
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LGA</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Valid</TableHead>
                      <TableHead className="text-right">Invalid</TableHead>
                      <TableHead className="text-right">% Valid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byLGA.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.lga}</TableCell>
                        <TableCell>{row.state}</TableCell>
                        <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">
                          {row.valid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {row.invalid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.percentageValid.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold" colSpan={2}>
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {lgaTotals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {lgaTotals.valid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {lgaTotals.invalid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {((lgaTotals.valid / lgaTotals.total) * 100).toFixed(1)}%
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
