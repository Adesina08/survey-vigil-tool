import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface GenderQuotaBreakdown {
  male: QuotaValue;
  female: QuotaValue;
}

interface GenderQuota {
  target: GenderQuotaBreakdown;
  achieved: GenderQuotaBreakdown;
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
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
        youth: { target: 400, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 16, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1000, achieved: null },
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
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
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
        youth: { target: 550, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 22, achieved: null },
        averagePerCluster: { target: 50, achieved: null },
        sampleSize: { target: 1300, achieved: null },
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
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
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
        youth: { target: 400, achieved: null },
      },
      {
        arm: "Comparison",
        clusters: { target: 10, achieved: null },
        averagePerCluster: { target: 40, achieved: null },
        sampleSize: { target: 400, achieved: null },
        gender: {
          target: { male: null, female: null },
          achieved: { male: null, female: null },
        },
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
    "Gender Target (Male)": row.gender.target.male,
    "Gender Target (Female)": row.gender.target.female,
    "Gender Achieved (Male)": row.gender.achieved.male,
    "Gender Achieved (Female)": row.gender.achieved.female,
    "Youth Target": row.youth.target,
    "Youth Achieved": row.youth.achieved,
  }));

const headerCellClass = "border-l border-border/60 px-4 py-3 first:border-l-0";
const bodyCellClass = "border-l border-border/50 px-4 py-3 first:border-l-0";

const sanitizeSheetName = (label: string): string => {
  const cleaned = label.replace(/[\\/?*\[\]:]/g, "-").trim();
  if (!cleaned) {
    return "Sheet";
  }
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
};

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
      quotaTabs.forEach((tab) => {
        const worksheet = XLSX.utils.json_to_sheet(getSheetRows(tab.rows));
        XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(tab.label));
      });
      const timestamp = new Date()
        .toISOString()
        .replace(/[:]/g, "")
        .replace("T", "-")
        .split(".")[0];
      XLSX.writeFile(workbook, `quota-tracker-${timestamp}.xlsx`);
    } catch (error) {
      console.error("Failed to export quota data", error);
    }
  };

  return (
    <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Quota Tracker</CardTitle>
            <CardDescription className="text-primary-foreground/90">
              Compare planned sample sizes with live achievements by arm, gender, and youth targets to keep recruitment on track.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Export Quota Data
          </Button>
        </div>
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
                <Table className="min-w-[1040px] border border-border/60 text-sm">
                  <TableHeader className="bg-background">
                    <TableRow className="divide-x divide-border/60 border-b border-border/60">
                      <TableHead
                        rowSpan={4}
                        className={`${headerCellClass} bg-background align-middle font-semibold`}
                      >
                        Arm
                      </TableHead>
                      <TableHead
                        colSpan={4}
                        className={`${headerCellClass} bg-background text-center text-sm font-semibold`}
                      >
                        TVET / Skills
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-sm font-semibold`}
                      >
                        Agriculture
                      </TableHead>
                      <TableHead
                        colSpan={4}
                        className={`${headerCellClass} bg-background text-center text-sm font-semibold`}
                      >
                        SMEs / Start-ups
                      </TableHead>
                    </TableRow>
                    <TableRow className="divide-x divide-border/60 border-b border-border/60">
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                      >
                        Clusters
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                      >
                        Avg/ Cluster
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                      >
                        Sample (n)
                      </TableHead>
                      <TableHead
                        colSpan={4}
                        className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                      >
                        Gender quota
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                      >
                        Youth quota
                      </TableHead>
                    </TableRow>
                    <TableRow className="divide-x divide-border/60">
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Target
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Achieved
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Target
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Achieved
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Target
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Achieved
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Target
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Achieved
                      </TableHead>
                    </TableRow>
                    <TableRow className="divide-x divide-border/60">
                      <TableHead
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Male
                      </TableHead>
                      <TableHead
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Female
                      </TableHead>
                      <TableHead
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Male
                      </TableHead>
                      <TableHead
                        className={`${headerCellClass} bg-background text-center text-[11px] font-medium uppercase tracking-wide`}
                      >
                        Female
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab.rows.map((row) => (
                      <TableRow
                        key={`${tab.value}-${row.arm}`}
                        className="bg-card/20 border-b border-border/60 last:border-b-0"
                      >
                        <TableCell className={`${bodyCellClass} font-semibold`}>{row.arm}</TableCell>
                        <TableCell className={`${bodyCellClass} text-right font-medium`}>
                          {formatValue(row.clusters.target)}
                        </TableCell>
                        <TableCell
                          className={`${bodyCellClass} text-right ${
                            typeof row.clusters.achieved === "number" && row.clusters.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.clusters.achieved)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-right font-medium`}>
                          {formatValue(row.averagePerCluster.target)}
                        </TableCell>
                        <TableCell
                          className={`${bodyCellClass} text-right ${
                            typeof row.averagePerCluster.achieved === "number" &&
                            row.averagePerCluster.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.averagePerCluster.achieved)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-right font-medium`}>
                          {formatValue(row.sampleSize.target)}
                        </TableCell>
                        <TableCell
                          className={`${bodyCellClass} text-right ${
                            typeof row.sampleSize.achieved === "number" && row.sampleSize.achieved > 0
                              ? "text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatValue(row.sampleSize.achieved)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-center text-muted-foreground`}>
                          {formatValue(row.gender.target.male)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-center text-muted-foreground`}>
                          {formatValue(row.gender.target.female)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-center text-muted-foreground`}>
                          {formatValue(row.gender.achieved.male)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-center text-muted-foreground`}>
                          {formatValue(row.gender.achieved.female)}
                        </TableCell>
                        <TableCell className={`${bodyCellClass} text-right font-medium`}>
                          {formatValue(row.youth.target)}
                        </TableCell>
                        <TableCell
                          className={`${bodyCellClass} text-right ${
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
