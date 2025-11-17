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
import type { DashboardData } from "@/lib/dashboardData";

type QuotaValue = number | string | null;

interface QuotaMetric {
  target: QuotaValue;
  achieved: QuotaValue;
}

interface DemographicQuota {
  female: QuotaMetric;
  male: QuotaMetric;
}

interface AgeQuota {
  youth: QuotaMetric;
  adult: QuotaMetric;
}

interface QuotaRow {
  panel: string;
  sampleSize: QuotaValue;
  gender: DemographicQuota;
  age: AgeQuota;
}

interface QuotaTabDefinition {
  value: string;
  label: string;
}

type QuotaSubmission = DashboardData["mapSubmissions"][number];
type HydratedQuotaTab = QuotaTabDefinition & { rows: QuotaRow[] };

type SheetJS = {
  utils: {
    book_new: () => unknown;
    json_to_sheet: (data: Record<string, QuotaValue>[]) => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, filename: string) => void;
};

const quotaTabs: QuotaTabDefinition[] = [
  { value: "treatment", label: "Treatment" },
  { value: "control", label: "Control" },
];

const baseQuotaRows: QuotaRow[] = [
  {
    panel: "TVET",
    sampleSize: 2000,
    gender: {
      female: { target: 400, achieved: null },
      male: { target: 600, achieved: null },
    },
    age: {
      youth: { target: 400, achieved: null },
      adult: { target: 600, achieved: null },
    },
  },
  {
    panel: "VCDF",
    sampleSize: 2600,
    gender: {
      female: { target: 400, achieved: null },
      male: { target: 600, achieved: null },
    },
    age: {
      youth: { target: 400, achieved: null },
      adult: { target: 600, achieved: null },
    },
  },
  {
    panel: "COFO",
    sampleSize: 780,
    gender: {
      female: { target: 200, achieved: null },
      male: { target: 200, achieved: null },
    },
    age: {
      youth: { target: 200, achieved: null },
      adult: { target: 200, achieved: null },
    },
  },
  {
    panel: "Unqualified Respondent",
    sampleSize: null,
    gender: {
      female: { target: null, achieved: null },
      male: { target: null, achieved: null },
    },
    age: {
      youth: { target: null, achieved: null },
      adult: { target: null, achieved: null },
    },
  },
];

const normalisePillar = (value: string | null | undefined): string => {
  const normalised = (value ?? "").trim().toUpperCase();
  if (normalised.includes("TVET")) return "TVET";
  if (normalised.includes("VCDF")) return "VCDF";
  if (normalised.includes("COFO")) return "COFO";
  if (normalised.includes("UNQUALIFIED")) return "UNQUALIFIED RESPONDENT";
  return "UNQUALIFIED RESPONDENT";
};

const normaliseGender = (value: string | null | undefined): "female" | "male" | null => {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("f")) return "female";
  if (lower.startsWith("m")) return "male";
  return null;
};

const parseAgeValue = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normaliseAgeGroup = (value: string | null | undefined): "youth" | "adult" | null => {
  const age = parseAgeValue(value);
  if (age === null) return null;
  if (age <= 25) return "youth";
  return "adult";
};

const buildAchievementsByPillar = (
  submissions: QuotaSubmission[],
  path: "treatment" | "control",
): Map<string, { female: number; male: number; youth: number; adult: number }> => {
  const achievements = new Map<string, { female: number; male: number; youth: number; adult: number }>();

  submissions.forEach((submission) => {
    if (!submission || submission.ogstepPath !== path || submission.status !== "approved") {
      return;
    }

    const pillarKey = normalisePillar(submission.pillar ?? null);
    const gender = normaliseGender(submission.respondentGender);
    const ageGroup = normaliseAgeGroup(submission.respondentAge);

    if (gender === null && ageGroup === null) {
      return;
    }

    const existing = achievements.get(pillarKey) ?? { female: 0, male: 0, youth: 0, adult: 0 };
    if (gender === "female") existing.female += 1;
    if (gender === "male") existing.male += 1;
    if (ageGroup === "youth") existing.youth += 1;
    if (ageGroup === "adult") existing.adult += 1;

    achievements.set(pillarKey, existing);
  });

  return achievements;
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
        { once: true },
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

const safeSum = (values: QuotaValue[]): number | null => {
  const numericValues = values.filter((value): value is number => typeof value === "number");
  if (!numericValues.length) {
    return null;
  }

  return numericValues.reduce((total, current) => total + current, 0);
};

const calculateTotals = (rows: QuotaRow[]): QuotaRow => ({
  panel: "Total",
  sampleSize: safeSum(rows.map((row) => row.sampleSize)),
  gender: {
    female: {
      target: safeSum(rows.map((row) => row.gender.female.target)),
      achieved: safeSum(rows.map((row) => row.gender.female.achieved)),
    },
    male: {
      target: safeSum(rows.map((row) => row.gender.male.target)),
      achieved: safeSum(rows.map((row) => row.gender.male.achieved)),
    },
  },
  age: {
    youth: {
      target: safeSum(rows.map((row) => row.age.youth.target)),
      achieved: safeSum(rows.map((row) => row.age.youth.achieved)),
    },
    adult: {
      target: safeSum(rows.map((row) => row.age.adult.target)),
      achieved: safeSum(rows.map((row) => row.age.adult.achieved)),
    },
  },
});

const getSheetRows = (rows: QuotaRow[]) =>
  rows.map((row) => ({
    Panel: row.panel,
    "Sample Size (N)": row.sampleSize,
    "Gender Target (Female)": row.gender.female.target,
    "Gender Achieved (Female)": row.gender.female.achieved,
    "Gender Target (Male)": row.gender.male.target,
    "Gender Achieved (Male)": row.gender.male.achieved,
    "Age Target (15-25)": row.age.youth.target,
    "Age Achieved (15-25)": row.age.youth.achieved,
    "Age Target (>25)": row.age.adult.target,
    "Age Achieved (>25)": row.age.adult.achieved,
  }));

const headerCellClass = "border-l border-border/60 px-4 py-3 first:border-l-0";
const bodyCellClass = "border-l border-border/50 px-4 py-3 first:border-l-0";

const forbiddenSheetChars = new Set(["\\", "/", "?", "*", "[", "]", ":"]);

const sanitizeSheetName = (label: string): string => {
  const cleaned = label
    .split("")
    .map((char) => (forbiddenSheetChars.has(char) ? "-" : char))
    .join("")
    .trim();

  if (!cleaned) {
    return "Sheet";
  }
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
};

export function QuotaTracker({ submissions }: { submissions: QuotaSubmission[] }) {
  const [activeTab, setActiveTab] = useState<string>(quotaTabs[0]?.value ?? "treatment");

  const hydratedTabs = useMemo<HydratedQuotaTab[]>(() => {
    const achievementsByTab = {
      treatment: buildAchievementsByPillar(submissions ?? [], "treatment"),
      control: buildAchievementsByPillar(submissions ?? [], "control"),
    };

    return quotaTabs.map((tab) => {
      const path = tab.value === "control" ? "control" : "treatment";
      const achievementLookup = achievementsByTab[path];

      const rowsWithAchievements = baseQuotaRows.map((row) => {
        const pillarKey = normalisePillar(row.panel);
        const stats = achievementLookup.get(pillarKey) ?? { female: 0, male: 0, youth: 0, adult: 0 };

        return {
          ...row,
          gender: {
            female: { ...row.gender.female, achieved: stats.female },
            male: { ...row.gender.male, achieved: stats.male },
          },
          age: {
            youth: { ...row.age.youth, achieved: stats.youth },
            adult: { ...row.age.adult, achieved: stats.adult },
          },
        };
      });

      return { ...tab, rows: rowsWithAchievements };
    });
  }, [submissions]);

  const handleExport = async () => {
    try {
      const XLSX = await loadSheetJS();
      const workbook = XLSX.utils.book_new();
      hydratedTabs.forEach((tab) => {
        const rowsWithTotals = [...tab.rows, calculateTotals(tab.rows)];
        const worksheet = XLSX.utils.json_to_sheet(getSheetRows(rowsWithTotals));
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
              Track targets and live achievements by arm, gender, and age to keep recruitment on track.
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
          <TabsList className="grid w-full grid-cols-2">
            {hydratedTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {hydratedTabs.map((tab) => {
            const rowsWithTotals = [...tab.rows, calculateTotals(tab.rows)];
            return (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="overflow-x-auto rounded-xl border bg-background/80">
                  <Table className="min-w-[1040px] border border-border/60 text-sm">
                    <TableHeader className="bg-background">
                      <TableRow className="divide-x divide-border/60 border-b border-border/60">
                        <TableHead
                          rowSpan={3}
                          className={`${headerCellClass} bg-background align-middle font-semibold`}
                        >
                          Panel
                        </TableHead>
                        <TableHead
                          rowSpan={3}
                          className={`${headerCellClass} bg-background text-center align-middle font-semibold`}
                        >
                          N
                        </TableHead>
                        <TableHead
                          colSpan={4}
                          className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                        >
                          Gender
                        </TableHead>
                        <TableHead
                          colSpan={4}
                          className={`${headerCellClass} bg-background text-center text-xs uppercase tracking-wide`}
                        >
                          Age
                        </TableHead>
                      </TableRow>
                      <TableRow className="divide-x divide-border/60 border-b border-border/60">
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
                      </TableRow>
                      <TableRow className="divide-x divide-border/60 border-b border-border/60 text-[11px] uppercase tracking-wide">
                        <TableHead className={`${headerCellClass} bg-background text-center`}>Female</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>Male</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>Female</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>Male</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>15-25 (Youth)</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>&gt;25 Years</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>15-25 (Youth)</TableHead>
                        <TableHead className={`${headerCellClass} bg-background text-center`}>&gt;25 Years</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rowsWithTotals.map((row) => {
                        const isTotal = row.panel === "Total";
                        const textClass = isTotal ? "font-semibold" : "";
                        const achievedTextClass = (value: QuotaValue) =>
                          typeof value === "number" && value > 0 ? "text-success" : "text-muted-foreground";

                        return (
                          <TableRow
                            key={`${tab.value}-${row.panel}`}
                            className={`bg-card/20 border-b border-border/60 ${isTotal ? "bg-muted/30" : ""} last:border-b-0`}
                          >
                            <TableCell className={`${bodyCellClass} ${textClass}`}>{row.panel}</TableCell>
                            <TableCell className={`${bodyCellClass} text-right ${textClass}`}>
                              {formatValue(row.sampleSize)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right font-medium`}>
                              {formatValue(row.gender.female.target)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right font-medium`}>
                              {formatValue(row.gender.male.target)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right ${achievedTextClass(row.gender.female.achieved)}`}>
                              {formatValue(row.gender.female.achieved)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right ${achievedTextClass(row.gender.male.achieved)}`}>
                              {formatValue(row.gender.male.achieved)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right font-medium`}>
                              {formatValue(row.age.youth.target)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right font-medium`}>
                              {formatValue(row.age.adult.target)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right ${achievedTextClass(row.age.youth.achieved)}`}>
                              {formatValue(row.age.youth.achieved)}
                            </TableCell>
                            <TableCell className={`${bodyCellClass} text-right ${achievedTextClass(row.age.adult.achieved)}`}>
                              {formatValue(row.age.adult.achieved)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
