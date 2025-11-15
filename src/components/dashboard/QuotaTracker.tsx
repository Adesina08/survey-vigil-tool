import { useMemo, useState } from "react";
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

type QuotaValue = number | string | null;

interface QuotaMetric {
  target: QuotaValue;
  achieved: QuotaValue;
}

interface GenderQuota {
  male: QuotaValue;
  female: QuotaValue;
}

interface QuotaRow {
  arm: string;
  clusters: QuotaMetric;
  averagePerCluster: QuotaMetric;
  sampleSize: QuotaMetric;
  gender: GenderQuota;
  youth: QuotaMetric;
}

interface QuotaTabDefinition {
  value: string;
  label: string;
  rows: QuotaRow[];
}

type SheetJS = {
  utils: {
    book_new: () => unknown;
    json_to_sheet: (data: Record<string, QuotaValue>[]) => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, filename: string) => void;
};

const quotaTabs: QuotaTabDefinition[] = [
  {
    value: "tvet",
    label: "TVET / Skills",
    rows: [
      {
        arm: "Treatment",
        clusters: { target: 16, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1000, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 400, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 16, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1000, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 400, achieved: null },
      },
    ],
  },
  {
    value: "agriculture",
    label: "Agriculture",
    rows: [
      {
        arm: "Treatment",
        clusters: { target: 22, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1300, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 550, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 22, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1300, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 550, achieved: null },
      },
    ],
  },
  {
    value: "smes",
    label: "SMEs / Start-ups",
    rows: [
      {
        arm: "Treatment",
        clusters: { target: 10, achieved: null },
        averagePerCluster: { target: 40, achieved: null },
        sampleSize: { target: 400, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 400, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 10, achieved: null },
        averagePerCluster: { target: 40, achieved: null },
        sampleSize: { target: 400, achieved: null },
        gender: { male: null, female: null },
        youth: { target: 400, achieved: null },
      },
    ],
  },
];

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

const formatValue = (value: QuotaValue): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  return value;
};

const getSheetRows = (rows: QuotaRow[]) =>
  rows.map((row) => ({
    Arm: row.arm,
    "Clusters Target": row.clusters.target,
    "Clusters Achieved": row.clusters.achieved,
    "Avg/Cluster Target": row.averagePerCluster.target,
    "Avg/Cluster Achieved": row.averagePerCluster.achieved,
    "Sample Target": row.sampleSize.target,
    "Sample Achieved": row.sampleSize.achieved,
    "Gender (Male)": row.gender.male,
    "Gender (Female)": row.gender.female,
    "Youth Target": row.youth.target,
    "Youth Achieved": row.youth.achieved,
  }));

export function QuotaTracker() {
  const [activeTab, setActiveTab] = useState<string>(quotaTabs[0]?.value ?? "tvet");

  const activeTabData = useMemo(
    () => quotaTabs.find((tab) => tab.value === activeTab) ?? quotaTabs[0],
    [activeTab],
  );

  const handleExport = async () => {
    try {
      const XLSX = await loadSheetJS();
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(getSheetRows(activeTabData.rows));
      XLSX.utils.book_append_sheet(workbook, worksheet, activeTabData.label);
      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `quota-tracker-${activeTabData.value}-${timestamp}.xlsx`);
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {quotaTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {quotaTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <div className="overflow-x-auto rounded-xl border bg-background/80">
                <Table className="min-w-[960px]">
                  <TableHeader className="bg-background">
                    <TableRow>
                      <TableHead rowSpan={3} className="bg-background align-middle font-semibold">
                        Arm
                      </TableHead>
                      <TableHead colSpan={4} className="bg-background text-center text-sm font-semibold">
                        TVET / Skills
                      </TableHead>
                      <TableHead colSpan={2} className="bg-background text-center text-sm font-semibold">
                        Agriculture
                      </TableHead>
                      <TableHead colSpan={4} className="bg-background text-center text-sm font-semibold">
                        SMEs / Start-ups
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead colSpan={2} className="bg-background text-center text-xs uppercase tracking-wide">
                        Clusters
                      </TableHead>
                      <TableHead colSpan={2} className="bg-background text-center text-xs uppercase tracking-wide">
                        Avg/ Cluster
                      </TableHead>
                      <TableHead colSpan={2} className="bg-background text-center text-xs uppercase tracking-wide">
                        Sample (n)
                      </TableHead>
                      <TableHead colSpan={2} className="bg-background text-center text-xs uppercase tracking-wide">
                        Gender quota
                      </TableHead>
                      <TableHead colSpan={2} className="bg-background text-center text-xs uppercase tracking-wide">
                        Youth quota
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Target
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Achieved
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Target
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Achieved
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Target
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Achieved
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Male
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Female
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Target
                      </TableHead>
                      <TableHead className="bg-background text-center text-[11px] font-medium uppercase tracking-wide">
                        Achieved
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab.rows.map((row) => (
                      <TableRow key={`${tab.value}-${row.arm}`} className="bg-card/20">
                        <TableCell className="font-semibold">{row.arm}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatValue(row.clusters.target)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            typeof row.clusters.achieved === "number" && row.clusters.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.clusters.achieved)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatValue(row.averagePerCluster.target)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            typeof row.averagePerCluster.achieved === "number" &&
                            row.averagePerCluster.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.averagePerCluster.achieved)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatValue(row.sampleSize.target)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            typeof row.sampleSize.achieved === "number" && row.sampleSize.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.sampleSize.achieved)}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {formatValue(row.gender.male)}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {formatValue(row.gender.female)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatValue(row.youth.target)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            typeof row.youth.achieved === "number" && row.youth.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.youth.achieved)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
