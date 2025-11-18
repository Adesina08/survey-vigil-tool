import { useState } from "react";
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

type QuotaValue = {
  target: number;
  achieved: number | null;
};

type DemographicQuota = {
  female: QuotaValue;
  male: QuotaValue;
};

type AgeQuota = {
  youth: QuotaValue;
  adult: QuotaValue;
};

interface QuotaRow {
  panel: string;
  sampleSize: QuotaValue;
  gender: DemographicQuota;
  age: AgeQuota;
}

interface QuotaTabDefinition {
  value: string;
  label: string;
  rows: QuotaRow[];
}

type SheetJS = {
  utils: {
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, sheetName: string) => void;
    aoa_to_sheet: (data: unknown[][]) => unknown;
  };
  writeFileXLSX: (workbook: unknown, filename: string) => void;
};

interface QuotaTrackerAchievements {
  [tab: string]: {
    [panel: string]: {
      sampleSize: number;
      gender: { female: number; male: number };
      age: { youth: number; adult: number };
    };
  };
}

interface QuotaTrackerProps {
  achievements?: QuotaTrackerAchievements;
}

const quotaTabs: QuotaTabDefinition[] = [
  {
    value: "treatment",
    label: "Treatment",
    rows: [
      {
        panel: "TVET",
        sampleSize: { target: 2000, achieved: null },
        gender: {
          female: { target: 400, achieved: 440 },
          male: { target: 600, achieved: 600 },
        },
        age: {
          youth: { target: 500, achieved: 350 },
          adult: { target: 500, achieved: 500 },
        },
      },
      {
        panel: "Agric",
        sampleSize: { target: 2000, achieved: null },
        gender: {
          female: { target: 400, achieved: 660 },
          male: { target: 600, achieved: 400 },
        },
        age: {
          youth: { target: 500, achieved: 610 },
          adult: { target: 500, achieved: 500 },
        },
      },
      {
        panel: "COFO",
        sampleSize: { target: 780, achieved: null },
        gender: {
          female: { target: 200, achieved: 200 },
          male: { target: 200, achieved: 200 },
        },
        age: {
          youth: { target: 390, achieved: 540 },
          adult: { target: 390, achieved: null },
        },
      },
    ],
  },
  {
    value: "control",
    label: "Control",
    rows: [
      {
        panel: "TVET",
        sampleSize: { target: 2000, achieved: null },
        gender: {
          female: { target: 400, achieved: 440 },
          male: { target: 600, achieved: 600 },
        },
        age: {
          youth: { target: 500, achieved: 350 },
          adult: { target: 500, achieved: 500 },
        },
      },
      {
        panel: "Agric",
        sampleSize: { target: 2000, achieved: null },
        gender: {
          female: { target: 400, achieved: 660 },
          male: { target: 600, achieved: 400 },
        },
        age: {
          youth: { target: 500, achieved: 610 },
          adult: { target: 500, achieved: 500 },
        },
      },
      {
        panel: "COFO",
        sampleSize: { target: 780, achieved: null },
        gender: {
          female: { target: 200, achieved: 200 },
          male: { target: 200, achieved: 200 },
        },
        age: {
          youth: { target: 390, achieved: 540 },
          adult: { target: 390, achieved: null },
        },
      },
    ],
  },
];

const applyAchievementsToQuotaTabs = (
  tabs: QuotaTabDefinition[],
  achievements?: QuotaTrackerAchievements,
): QuotaTabDefinition[] => {
  if (!achievements) return tabs;

  return tabs.map((tab) => {
    const tabAchievements = achievements[tab.value];
    if (!tabAchievements) return tab;

    return {
      ...tab,
      rows: tab.rows.map((row) => {
        const panelAchievements = tabAchievements[row.panel];
        if (!panelAchievements) return row;

        return {
          ...row,
          sampleSize: {
            ...row.sampleSize,
            achieved: panelAchievements.sampleSize,
          },
          gender: {
            female: {
              ...row.gender.female,
              achieved: panelAchievements.gender.female,
            },
            male: {
              ...row.gender.male,
              achieved: panelAchievements.gender.male,
            },
          },
          age: {
            youth: {
              ...row.age.youth,
              achieved: panelAchievements.age.youth,
            },
            adult: {
              ...row.age.adult,
              achieved: panelAchievements.age.adult,
            },
          },
        };
      }),
    };
  });
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
      existingScript.addEventListener("load", () => {
        if ((window as unknown as { XLSX?: SheetJS }).XLSX) {
          resolve((window as unknown as { XLSX: SheetJS }).XLSX);
        } else {
          reject(new Error("SheetJS failed to load"));
        }
      });
      existingScript.addEventListener("error", () => reject(new Error("SheetJS script failed to load")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.dataset.sheetjs = "true";

    script.onload = () => {
      if ((window as unknown as { XLSX?: SheetJS }).XLSX) {
        resolve((window as unknown as { XLSX: SheetJS }).XLSX);
      } else {
        reject(new Error("SheetJS failed to initialise"));
      }
    };

    script.onerror = () => reject(new Error("Failed to load SheetJS script"));

    document.body.appendChild(script);
  });
};

const exportToExcel = async (tabs: QuotaTabDefinition[]) => {
  const XLSX = await loadSheetJS();
  const workbook = XLSX.utils.book_new();

  tabs.forEach((tab) => {
    const sheetData: unknown[][] = [
      [
        "Panel",
        "Target Sample Size",
        "Achieved Sample Size",
        "Target Female",
        "Achieved Female",
        "Balance Female",
        "Target Male",
        "Achieved Male",
        "Balance Male",
        "Target Youth",
        "Achieved Youth",
        "Balance Youth",
        "Target Adult",
        "Achieved Adult",
        "Balance Adult",
      ],
    ];

    tab.rows.forEach((row) => {
      sheetData.push([
        row.panel,
        row.sampleSize.target,
        row.sampleSize.achieved ?? 0,
        row.gender.female.target,
        row.gender.female.achieved ?? 0,
        calculateBalance(row.gender.female.target, row.gender.female.achieved),
        row.gender.male.target,
        row.gender.male.achieved ?? 0,
        calculateBalance(row.gender.male.target, row.gender.male.achieved),
        row.age.youth.target,
        row.age.youth.achieved ?? 0,
        calculateBalance(row.age.youth.target, row.age.youth.achieved),
        row.age.adult.target,
        row.age.adult.achieved ?? 0,
        calculateBalance(row.age.adult.target, row.age.adult.achieved),
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, tab.label);
  });

  XLSX.writeFileXLSX(workbook, "ogstep_quota_tracker.xlsx");
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-NG");
};

const formatDisplayNumber = (
  value: number | null | undefined,
  { wrapInParens = false, blankForNull = false }: { wrapInParens?: boolean; blankForNull?: boolean } = {},
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return blankForNull ? "" : "0";

  const formatted = value.toLocaleString("en-NG");
  return wrapInParens ? `(${formatted})` : formatted;
};

const calculateBalance = (target: number, achieved: number | null | undefined) => target - (achieved ?? 0);

const cellBorderClass = "border-[1.5px] border-slate-700 dark:border-slate-400";

const calculateTotals = (rows: QuotaRow[]) =>
  rows.reduce(
    (totals, row) => ({
      sampleSize: totals.sampleSize + (row.sampleSize.target ?? 0),
      gender: {
        female: {
          target: totals.gender.female.target + (row.gender.female.target ?? 0),
          achieved: totals.gender.female.achieved + (row.gender.female.achieved ?? 0),
        },
        male: {
          target: totals.gender.male.target + (row.gender.male.target ?? 0),
          achieved: totals.gender.male.achieved + (row.gender.male.achieved ?? 0),
        },
      },
      age: {
        youth: {
          target: totals.age.youth.target + (row.age.youth.target ?? 0),
          achieved: totals.age.youth.achieved + (row.age.youth.achieved ?? 0),
        },
        adult: {
          target: totals.age.adult.target + (row.age.adult.target ?? 0),
          achieved: totals.age.adult.achieved + (row.age.adult.achieved ?? 0),
        },
      },
    }),
    {
      sampleSize: 0,
      gender: {
        female: { target: 0, achieved: 0 },
        male: { target: 0, achieved: 0 },
      },
      age: {
        youth: { target: 0, achieved: 0 },
        adult: { target: 0, achieved: 0 },
      },
    },
  );

const safePanelKey = (panel: string): string => {
  const cleaned = panel.replace(/[^\p{L}\p{N}]+/gu, "_").toUpperCase();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
};

export function QuotaTracker({ achievements }: QuotaTrackerProps) {
  const [activeTab, setActiveTab] = useState<"treatment" | "control">("treatment");

  const tabsWithAchievements = applyAchievementsToQuotaTabs(quotaTabs, achievements);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Quota Tracker</CardTitle>
          <CardDescription>
            Targets vs achieved interviews by pillar, gender, and age for Treatment and Control.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 inline-flex items-center gap-2 sm:mt-0"
          onClick={() => exportToExcel(tabsWithAchievements)}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "treatment" | "control")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="treatment">Treatment</TabsTrigger>
            <TabsTrigger value="control">Control</TabsTrigger>
          </TabsList>

          {tabsWithAchievements.map((tab) => {
            const totals = calculateTotals(tab.rows);

            return (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="overflow-x-auto rounded-md border-[2px] border-slate-700 bg-white shadow-sm dark:border-slate-500 dark:bg-slate-900">
                  <Table
                    className="border-collapse text-center"
                    containerClassName="border-[2px] border-slate-700 dark:border-slate-500"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead className={`${cellBorderClass} bg-slate-50 font-semibold dark:bg-slate-800`} rowSpan={3}>
                          Pillar
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 font-semibold dark:bg-slate-800`} rowSpan={3}>
                          N
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={6}>
                          Gender
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={6}>
                          Age
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Target
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Achieved
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Balance
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Target
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Achieved
                        </TableHead>
                        <TableHead className={`${cellBorderClass} bg-slate-50 text-center font-semibold dark:bg-slate-800`} colSpan={2}>
                          Balance
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className={cellBorderClass}>Female</TableHead>
                        <TableHead className={cellBorderClass}>Male</TableHead>
                        <TableHead className={cellBorderClass}>Female</TableHead>
                        <TableHead className={cellBorderClass}>Male</TableHead>
                        <TableHead className={cellBorderClass}>Female</TableHead>
                        <TableHead className={cellBorderClass}>Male</TableHead>
                        <TableHead className={cellBorderClass}>&lt;35 (Youth)</TableHead>
                        <TableHead className={cellBorderClass}>&gt;35 (Adult)</TableHead>
                        <TableHead className={cellBorderClass}>&lt;35 (Youth)</TableHead>
                        <TableHead className={cellBorderClass}>&gt;35 (Adult)</TableHead>
                        <TableHead className={cellBorderClass}>&lt;35 (Youth)</TableHead>
                        <TableHead className={cellBorderClass}>&gt;35 (Adult)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tab.rows.map((row) => (
                        <TableRow key={`${tab.value}-${safePanelKey(row.panel)}`}>
                          <TableCell className={`${cellBorderClass} bg-slate-50 font-medium text-left dark:bg-slate-800`}>
                            {row.panel}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(row.sampleSize.target)}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(row.gender.female.target)}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(row.gender.male.target)}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatDisplayNumber(row.gender.female.achieved, {
                              wrapInParens: true,
                              blankForNull: true,
                            })}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatDisplayNumber(row.gender.male.achieved, {
                              wrapInParens: true,
                              blankForNull: true,
                            })}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(calculateBalance(row.gender.female.target, row.gender.female.achieved))}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(calculateBalance(row.gender.male.target, row.gender.male.achieved))}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(row.age.youth.target)}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(row.age.adult.target)}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatDisplayNumber(row.age.youth.achieved, {
                              wrapInParens: true,
                              blankForNull: true,
                            })}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatDisplayNumber(row.age.adult.achieved, {
                              wrapInParens: true,
                              blankForNull: true,
                            })}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(calculateBalance(row.age.youth.target, row.age.youth.achieved))}
                          </TableCell>
                          <TableCell className={cellBorderClass}>
                            {formatNumber(calculateBalance(row.age.adult.target, row.age.adult.achieved))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell className={`${cellBorderClass} bg-slate-50 text-left dark:bg-slate-800`}>
                          Total
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(totals.sampleSize)}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(totals.gender.female.target)}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(totals.gender.male.target)}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatDisplayNumber(totals.gender.female.achieved, { wrapInParens: true })}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatDisplayNumber(totals.gender.male.achieved, { wrapInParens: true })}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(
                            calculateBalance(totals.gender.female.target, totals.gender.female.achieved),
                          )}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(calculateBalance(totals.gender.male.target, totals.gender.male.achieved))}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(totals.age.youth.target)}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(totals.age.adult.target)}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatDisplayNumber(totals.age.youth.achieved, { wrapInParens: true })}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatDisplayNumber(totals.age.adult.achieved, { wrapInParens: true })}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(calculateBalance(totals.age.youth.target, totals.age.youth.achieved))}
                        </TableCell>
                        <TableCell className={cellBorderClass}>
                          {formatNumber(calculateBalance(totals.age.adult.target, totals.age.adult.achieved))}
                        </TableCell>
                      </TableRow>
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
