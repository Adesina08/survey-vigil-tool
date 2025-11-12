import { useMemo, useRef, useState } from "react";
import Select, { type GroupBase, type StylesConfig } from "react-select";
import makeAnimated from "react-select/animated";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { AlertCircle, BarChart3, Download, Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AnalysisResponse, DisplayMode } from "@/services/analysis";
import { generateAnalysis } from "@/services/analysis";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const animatedComponents = makeAnimated();

type Option = { label: string; value: string };

type GroupedOptions = GroupBase<Option>;

type PathOption = {
  label: string;
  value: string;
  description: string;
  className: string;
};

const TOP_BREAK_OPTIONS: Option[] = [
  { value: "A3_LGA", label: "A3. LGA / Ward" },
  { value: "A6_Consent", label: "A6. Consent" },
  { value: "A7_Sex", label: "A7. Sex" },
  { value: "A9_MaritalStatus", label: "A9. Marital status" },
  { value: "A10_Education", label: "A10. Highest education" },
  { value: "A12_EnumeratorObservation", label: "A12. Enumerator observation" },
];

const SIDE_BREAK_GROUPS: GroupedOptions[] = [
  {
    label: "Section B – Program Exposure & Participation",
    options: [
      { value: "B1_Awareness", label: "B1. Awareness of OGSTEP" },
      { value: "B2_Participation", label: "B2. Participated in OGSTEP" },
      { value: "B4_SupportType", label: "B4. Support type received" },
      { value: "B6_OtherPrograms", label: "B6. Joined other programs" },
      { value: "B7_ProgramName", label: "B7. Program name" },
    ],
  },
  {
    label: "Section C – TVET / Skills",
    options: [
      { value: "C1_OGSTEPTrainingCompleted", label: "C1. Completed OGSTEP training" },
      { value: "C2_TrainingType", label: "C2. Type of OGSTEP training" },
      { value: "C3_NonOGSTEPTraining", label: "C3. Non-OGSTEP training" },
      { value: "C4_EmploymentStatus", label: "C4. Employment status" },
      { value: "C7_JobRelated", label: "C7. Job related to training" },
      { value: "C8_Barriers", label: "C8. Barriers to finding work" },
    ],
  },
  {
    label: "Section D – Agriculture",
    options: [
      { value: "D1_CurrentlyFarm", label: "D1. Currently farming" },
      { value: "D2_EnterpriseType", label: "D2. Enterprise type" },
      { value: "D6_OGSTEPInputs", label: "D6. Inputs received via OGSTEP" },
      { value: "D7_OtherInputs", label: "D7. Inputs from other sources" },
      { value: "D11_OffTaker", label: "D11. Off-taker contracts" },
    ],
  },
  {
    label: "Section E – SMEs / Startups",
    options: [
      { value: "E1_OwnBusiness", label: "E1. Own business" },
      { value: "E2_Sector", label: "E2. Business sector" },
      { value: "E6_OGSTEPFinance", label: "E6. Received OGSTEP finance" },
      { value: "E7_OtherSupport", label: "E7. Received other support" },
      { value: "E8_NewTechnology", label: "E8. Adopted new technology" },
      { value: "E9_Constraints", label: "E9. Constraints to growth" },
    ],
  },
  {
    label: "Section F – Household & Food Security",
    options: [
      { value: "F1_WorryFood", label: "F1. Worried about food" },
      { value: "F2_SmallerMeals", label: "F2. Took smaller meals" },
      { value: "F3_FewerMeals", label: "F3. Fewer meals" },
      { value: "F4_SleptHungry", label: "F4. Slept hungry" },
      { value: "F5_NoFood", label: "F5. Whole day without food" },
      { value: "F6_FoodSituation", label: "F6. Food situation change" },
    ],
  },
  {
    label: "Section G – Gender & Youth Empowerment",
    options: [
      { value: "G1_IncomeDecisions", label: "G1. Who decides income" },
      { value: "G2_SavingsCredit", label: "G2. Has savings/credit" },
      { value: "G3_GroupMember", label: "G3. Group membership" },
      { value: "G4_Influence", label: "G4. Influence compared to before" },
    ],
  },
  {
    label: "Section H – Perceptions & Sustainability",
    options: [
      { value: "H1_Satisfaction", label: "H1. Satisfaction with OGSTEP" },
      { value: "H2_Trust", label: "H2. Trust in institutions" },
      { value: "H3_ContinueWithoutSupport", label: "H3. Continue without support" },
      { value: "H4_Risks", label: "H4. Risks to sustain benefits" },
    ],
  },
];

const DISPLAY_MODES: { label: string; value: DisplayMode; description: string }[] = [
  { label: "Count", value: "count", description: "Raw respondent counts" },
  { label: "Row %", value: "rowPercent", description: "Percentage within each response option" },
  { label: "Column %", value: "columnPercent", description: "Percentage within each banner" },
  { label: "Total %", value: "totalPercent", description: "Share of total interviews" },
];

const PATH_OPTIONS: PathOption[] = [
  {
    value: "treatment",
    label: "Treatment path",
    description: "Respondents that followed the treatment (blue) route",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    value: "control",
    label: "Control path",
    description: "Respondents that followed the control (green) route",
    className: "border-green-200 bg-green-50 text-green-800",
  },
  {
    value: "common",
    label: "Common modules",
    description: "Questions asked of all respondents (purple)",
    className: "border-purple-200 bg-purple-50 text-purple-800",
  },
  {
    value: "validation",
    label: "Validation checks",
    description: "Enumerator validations (yellow)",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
];

const selectStyles: StylesConfig<Option, true, GroupBase<Option>> = {
  control: (provided) => ({
    ...provided,
    borderRadius: "0.75rem",
    borderColor: "#e5e7eb",
    boxShadow: "none",
    padding: "2px 4px",
    minHeight: "48px",
  }),
  multiValue: (provided) => ({
    ...provided,
    borderRadius: "9999px",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? "#f1f5f9" : "white",
    color: "#0f172a",
  }),
};

const Analysis = () => {
  const [topBreakSelection, setTopBreakSelection] = useState<Option[]>([TOP_BREAK_OPTIONS[2]]);
  const [sideBreakSelection, setSideBreakSelection] = useState<Option[]>([
    SIDE_BREAK_GROUPS[0].options[1],
  ]);
  const [mode, setMode] = useState<DisplayMode>("count");
  const [selectedPaths, setSelectedPaths] = useState<string[]>(PATH_OPTIONS.map((item) => item.value));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const sideBreakOptions = useMemo(() => SIDE_BREAK_GROUPS, []);

  const handleTogglePath = (value: string) => {
    setSelectedPaths((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        if (prev.length === 1) {
          return prev; // keep at least one path selected
        }
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const handleGenerate = async () => {
    if (topBreakSelection.length === 0 || sideBreakSelection.length === 0) {
      setError("Select at least one top break and one side break variable.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await generateAnalysis({
        topBreaks: topBreakSelection.map((item) => item.value),
        sideBreaks: sideBreakSelection.map((item) => item.value),
        mode,
        paths: selectedPaths,
      });
      setAnalysis(response);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to generate analysis at this time.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setTopBreakSelection([TOP_BREAK_OPTIONS[2]]);
    setSideBreakSelection([SIDE_BREAK_GROUPS[0].options[1]]);
    setMode("count");
    setSelectedPaths(PATH_OPTIONS.map((item) => item.value));
    setAnalysis(null);
    setError(null);
  };

  const handleExportExcel = () => {
    if (!tableContainerRef.current) {
      return;
    }

    const tableElements = tableContainerRef.current.querySelectorAll("table");
    if (!tableElements.length) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    tableElements.forEach((table, index) => {
      const worksheet = XLSX.utils.table_to_sheet(table);
      XLSX.utils.book_append_sheet(workbook, worksheet, `Table_${index + 1}`);
    });
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `ogstep-analysis-${timestamp}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (!tableContainerRef.current) {
      return;
    }

    const canvas = await html2canvas(tableContainerRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 48;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 24, 36, imgWidth, Math.min(imgHeight, pageHeight - 72));
    const timestamp = new Date().toISOString().split("T")[0];
    pdf.save(`ogstep-analysis-${timestamp}.pdf`);
  };

  const chartConfig = useMemo(() => {
    if (!analysis?.chart) {
      return null;
    }

    return {
      data: {
        labels: analysis.chart.labels,
        datasets: analysis.chart.datasets.map((dataset) => ({
          ...dataset,
          borderRadius: 6,
        })),
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom" as const,
          },
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label: string }; formattedValue: string }) => {
                return `${context.dataset.label}: ${context.formattedValue}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: number | string) => `${value}`,
            },
          },
        },
      },
    };
  }, [analysis]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OGSTEP Impact Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Slice post-survey outcomes by treatment and control pathways to surface actionable insights for
            stakeholders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Generate table
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Break configuration</CardTitle>
          <CardDescription>Choose the banners (top breaks) and row segments (side breaks) to crosstab.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Top breaks (columns)</h3>
                <Badge variant="secondary">Section A</Badge>
              </div>
              <Select<Option, true, GroupBase<Option>>
                closeMenuOnSelect={false}
                components={animatedComponents}
                isMulti
                options={TOP_BREAK_OPTIONS}
                value={topBreakSelection}
                styles={selectStyles}
                onChange={(values) => setTopBreakSelection((values as Option[]) ?? [])}
                placeholder="Choose respondent attributes"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Side breaks (rows)</h3>
                <Badge variant="secondary">Sections B – H</Badge>
              </div>
              <Select<Option, true, GroupBase<Option>>
                closeMenuOnSelect={false}
                components={animatedComponents}
                isMulti
                options={sideBreakOptions}
                value={sideBreakSelection}
                styles={selectStyles}
                onChange={(values) => setSideBreakSelection((values as Option[]) ?? [])}
                placeholder="Choose outcome indicators"
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Display mode</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {DISPLAY_MODES.map((option) => {
                  const active = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Path filters</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {PATH_OPTIONS.map((path) => {
                  const active = selectedPaths.includes(path.value);
                  return (
                    <button
                      key={path.value}
                      type="button"
                      onClick={() => handleTogglePath(path.value)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active ? `${path.className} ring-2 ring-offset-2 ring-offset-background` : "border-border bg-background"
                      }`}
                    >
                      <div className="font-medium">{path.label}</div>
                      <div className="text-xs text-muted-foreground">{path.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Results</h2>
              <p className="text-sm text-muted-foreground">
                {analysis.metadata.rowCount.toLocaleString()} interviews included. Filters: {analysis.metadata.appliedFilters.join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={handleExportPdf}>
                <Download className="h-4 w-4" /> Export PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            </div>
          </div>

          {analysis.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Summary insights</CardTitle>
                <CardDescription>
                  Auto-generated storylines to brief decision makers on OGSTEP impact.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {analysis.insights.map((insight, index) => (
                    <li key={index}>{insight}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {chartConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Visual comparison</CardTitle>
                <CardDescription>
                  {analysis.chart?.sideBreak} split by treatment pathway.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Bar data={chartConfig.data} options={chartConfig.options} />
              </CardContent>
            </Card>
          )}

          <div ref={tableContainerRef} className="space-y-6">
            {analysis.tables.map((table) => (
              <Card key={table.sideBreak} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{table.title}</CardTitle>
                  <CardDescription>
                    Displaying {table.mode === "count" ? "counts" : table.mode.replace(/([A-Z])/g, " $1").toLowerCase()}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="overflow-x-auto rounded-lg border"
                    dangerouslySetInnerHTML={{ __html: table.html }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;
