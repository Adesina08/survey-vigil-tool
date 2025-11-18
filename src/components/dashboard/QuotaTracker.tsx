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
        sampleSize: { target: 2600, achieved: null },
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
        sampleSize: { target: 780, achieved: null },
        gender: {
          female: { target: 200, achieved: null },
          male: { target: 200, achieved: null },
        },
        age: {
          youth: { target: 200, achieved: null },
          adult: { target: 200, achieved: null },
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
        sampleSize: { target: 2600, achieved: null },
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
        sampleSize: { target: 780, achieved: null },
        gender: {
          female: { target: 200, achieved: null },
          male: { target: 200, achieved: null },
        },
        age: {
          youth: { target: 200, achieved: null },
          adult: { target: 200, achieved: null },
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
        "Target Male",
        "Achieved Male",
        "Target Youth",
        "Achieved Youth",
        "Target Adult",
        "Achieved Adult",
      ],
    ];

    tab.rows.forEach((row) => {
      sheetData.push([
        row.panel,
        row.sampleSize.target,
        row.sampleSize.achieved ?? 0,
        row.gender.female.target,
        row.gender.female.achieved ?? 0,
        row.gender.male.target,
        row.gender.male.achieved ?? 0,
        row.age.youth.target,
        row.age.youth.achieved ?? 0,
        row.age.adult.target,
        row.age.adult.achieved ?? 0,
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

          {tabsWithAchievements.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pillar</TableHead>
                      <TableHead>Target Sample Size</TableHead>
                      <TableHead>Achieved Sample Size</TableHead>
                      <TableHead>Target Female</TableHead>
                      <TableHead>Achieved Female</TableHead>
                      <TableHead>Target Male</TableHead>
                      <TableHead>Achieved Male</TableHead>
                      <TableHead>Target Youth</TableHead>
                      <TableHead>Achieved Youth</TableHead>
                      <TableHead>Target Adult</TableHead>
                      <TableHead>Achieved Adult</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab.rows.map((row) => (
                      <TableRow key={`${tab.value}-${safePanelKey(row.panel)}`}>
                        <TableCell className="font-medium">{row.panel}</TableCell>
                        <TableCell>{formatNumber(row.sampleSize.target)}</TableCell>
                        <TableCell>{formatNumber(row.sampleSize.achieved)}</TableCell>
                        <TableCell>{formatNumber(row.gender.female.target)}</TableCell>
                        <TableCell>{formatNumber(row.gender.female.achieved)}</TableCell>
                        <TableCell>{formatNumber(row.gender.male.target)}</TableCell>
                        <TableCell>{formatNumber(row.gender.male.achieved)}</TableCell>
                        <TableCell>{formatNumber(row.age.youth.target)}</TableCell>
                        <TableCell>{formatNumber(row.age.youth.achieved)}</TableCell>
                        <TableCell>{formatNumber(row.age.adult.target)}</TableCell>
                        <TableCell>{formatNumber(row.age.adult.achieved)}</TableCell>
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
