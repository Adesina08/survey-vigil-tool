import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QuotaTrackerProps {
  byState: Array<{ state: string; target: number; achieved: number; balance: number }>;
  byStateAge: Array<{
    state: string;
    ageGroup: string;
    target: number;
    achieved: number;
    balance: number;
  }>;
  byStateGender: Array<{
    state: string;
    gender: string;
    target: number;
    achieved: number;
    balance: number;
  }>;
}

export function QuotaTracker({ byState, byStateAge, byStateGender }: QuotaTrackerProps) {
  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quota Tracker</CardTitle>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export Quota Data
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="state" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="state">By State</TabsTrigger>
            <TabsTrigger value="age">By State & Age</TabsTrigger>
            <TabsTrigger value="gender">By State & Gender</TabsTrigger>
          </TabsList>

          <TabsContent value="state">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Achieved</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byState.map((row) => (
                    <TableRow key={row.state}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell className="text-right">{row.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">
                        {row.achieved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="age">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Age Group</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Achieved</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byStateAge.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell>{row.ageGroup}</TableCell>
                      <TableCell className="text-right">{row.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">
                        {row.achieved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="gender">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Achieved</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byStateGender.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell>{row.gender}</TableCell>
                      <TableCell className="text-right">{row.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">
                        {row.achieved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
