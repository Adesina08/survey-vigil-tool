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

interface QuotaTrackerRow {
  state: string;
  lga: string;
  target: number;
  achieved: number;
  balance: number;
}

interface QuotaTrackerAgeRow extends QuotaTrackerRow {
  ageGroup: string;
}

interface QuotaTrackerGenderRow extends QuotaTrackerRow {
  gender: string;
}

interface QuotaTrackerProps {
  byLGA: QuotaTrackerRow[];
  byLGAAge: QuotaTrackerAgeRow[];
  byLGAGender: QuotaTrackerGenderRow[];
}

type SheetJS = {
  utils: {
    book_new: () => unknown;
    json_to_sheet: (data: Record<string, unknown>[]) => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, filename: string) => void;
};

const loadSheetJS = async (): Promise<SheetJS> => {
  if (typeof window === "undefined") {
    throw new Error("SheetJS can only be used in the browser");
  }

  if ((window as unknown as { XLSX?: SheetJS }).XLSX) {
    return (window as unknown as { XLSX: SheetJS }).XLSX;
  }

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-sheetjs]");
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => resolve((window as unknown as { XLSX: SheetJS }).XLSX),
        { once: true }
      );
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    script.dataset.sheetjs = "true";
    script.onload = () => {
      const sheet = (window as unknown as { XLSX: SheetJS }).XLSX;
      if (!sheet) {
        reject(new Error("SheetJS failed to load"));
        return;
      }
      resolve(sheet);
    };
    script.onerror = (event) => reject(event);
    document.body.appendChild(script);
  });
};

export function QuotaTracker({ byLGA, byLGAAge, byLGAGender }: QuotaTrackerProps) {
  const handleExport = async () => {
    try {
      const XLSX = await loadSheetJS();

      const workbook = XLSX.utils.book_new();

      const lgaSheet = XLSX.utils.json_to_sheet(
        byLGA.map((row) => ({
          State: row.state,
          LGA: row.lga,
          Target: row.target,
          Achieved: row.achieved,
          Balance: row.balance,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, lgaSheet, "By LGA");

      const ageSheet = XLSX.utils.json_to_sheet(
        byLGAAge.map((row) => ({
          State: row.state,
          LGA: row.lga,
          "Age Group": row.ageGroup,
          Target: row.target,
          Achieved: row.achieved,
          Balance: row.balance,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ageSheet, "By LGA & Age");

      const genderSheet = XLSX.utils.json_to_sheet(
        byLGAGender.map((row) => ({
          State: row.state,
          LGA: row.lga,
          Gender: row.gender,
          Target: row.target,
          Achieved: row.achieved,
          Balance: row.balance,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, genderSheet, "By LGA & Gender");

      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `quota-tracker-${timestamp}.xlsx`);
    } catch (error) {
      console.error("Failed to export quota data", error);
    }
  };

  return (
    <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <CardTitle>Quota Tracker</CardTitle>
        <Button
          variant="secondary"
          size="sm"
          className="gap-2 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Export Quota Data
        </Button>
      </CardHeader>
      <CardContent className="bg-card/60 p-6">
        <Tabs defaultValue="lga" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lga">By LGA</TabsTrigger>
            <TabsTrigger value="age">By LGA & Age</TabsTrigger>
            <TabsTrigger value="gender">By LGA & Gender</TabsTrigger>
          </TabsList>

          <TabsContent value="lga">
            <div className="max-h-80 overflow-auto rounded-xl border bg-background/80">
              <Table className="relative min-w-[720px]">
                <TableHeader className="sticky top-0 z-20 bg-background">
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-30 bg-background">State</TableHead>
                    <TableHead className="top-0 z-20 bg-background">LGA</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Target</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Achieved</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byLGA.map((row) => (
                    <TableRow key={`${row.state}-${row.lga}`}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        {row.state}
                      </TableCell>
                      <TableCell className="font-medium">{row.lga}</TableCell>
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
            <div className="max-h-80 overflow-auto rounded-xl border bg-background/80">
              <Table className="relative min-w-[820px]">
                <TableHeader className="sticky top-0 z-20 bg-background">
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-30 bg-background">State</TableHead>
                    <TableHead className="top-0 z-20 bg-background">LGA</TableHead>
                    <TableHead className="top-0 z-20 bg-background">Age Group</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Target</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Achieved</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byLGAAge.map((row, idx) => (
                    <TableRow key={`${row.state}-${row.lga}-${row.ageGroup}-${idx}`}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        {row.state}
                      </TableCell>
                      <TableCell className="font-medium">{row.lga}</TableCell>
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
            <div className="max-h-80 overflow-auto rounded-xl border bg-background/80">
              <Table className="relative min-w-[820px]">
                <TableHeader className="sticky top-0 z-20 bg-background">
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-30 bg-background">State</TableHead>
                    <TableHead className="top-0 z-20 bg-background">LGA</TableHead>
                    <TableHead className="top-0 z-20 bg-background">Gender</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Target</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Achieved</TableHead>
                    <TableHead className="top-0 z-20 bg-background text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byLGAGender.map((row, idx) => (
                    <TableRow key={`${row.state}-${row.lga}-${row.gender}-${idx}`}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        {row.state}
                      </TableCell>
                      <TableCell className="font-medium">{row.lga}</TableCell>
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
