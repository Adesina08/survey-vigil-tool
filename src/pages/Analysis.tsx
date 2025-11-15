import { useEffect, useMemo, useRef, useState } from "react";
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
import { getAnalysisSchema, type AnalysisSchema } from "@/lib/api.analysis";
import type { AnalysisResult, DisplayMode } from "@/services/analysis";
import { generateAnalysis } from "@/services/analysis";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const animatedComponents = makeAnimated();

type Option = { label: string; value: string };

type GroupedOptions = GroupBase<Option>;

const DISPLAY_MODES: { label: string; value: DisplayMode; description: string }[] = [
  { label: "Row %", value: "rowpct", description: "Percentage within each top-break category" },
  { label: "Counts", value: "counts", description: "Raw respondent counts" },
  { label: "Column %", value: "colpct", description: "Percentage within each response option" },
  { label: "Total %", value: "totalpct", description: "Share of all included interviews" },
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

const formatFieldLabel = (field: string): string => {
  if (!field) {
    return "";
  }
  return field
    .split("_")
    .map((segment) => {
      if (segment.length === 0) {
        return segment;
      }
      if (/^[a-z]\d+$/i.test(segment)) {
        return segment.toUpperCase();
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
};

const toOption = (value: string): Option => ({
  value,
  label: formatFieldLabel(value),
});

const buildVariableOptions = (schema: AnalysisSchema | null): GroupedOptions[] => {
  if (!schema) {
    return [];
  }

  const categorical = schema.categorical_candidates.map(toOption);
  const numeric = schema.numeric_candidates
    .filter((field) => !schema.categorical_candidates.includes(field))
    .map(toOption);

  const groups: GroupedOptions[] = [];
  if (categorical.length > 0) {
    groups.push({ label: "Categorical variables", options: categorical });
  }
  if (numeric.length > 0) {
    groups.push({ label: "Numeric variables", options: numeric });
  }
  return groups;
};

const formatStatLabel = (stat: string): string => {
  switch (stat) {
    case "counts":
      return "counts";
    case "rowpct":
      return "row %";
    case "colpct":
      return "column %";
    case "totalpct":
      return "total %";
    default:
      return stat;
  }
};

const describeMeta = (meta: AnalysisResult["tables"][number]["meta"]): string => {
  if (meta.topbreak) {
    return `${formatFieldLabel(meta.variable)} by ${formatFieldLabel(meta.topbreak)}`;
  }
  return `Distribution of ${formatFieldLabel(meta.variable)}`;
};

const Analysis = () => {
  const [schema, setSchema] = useState<AnalysisSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const [topBreakSelection, setTopBreakSelection] = useState<Option | null>(null);
  const [sideBreakSelection, setSideBreakSelection] = useState<Option[]>([]);
  const [mode, setMode] = useState<DisplayMode>(DISPLAY_MODES[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsSchemaLoading(true);
    setSchemaError(null);

    getAnalysisSchema({ signal: controller.signal })
      .then((data) => {
        setSchema(data);
        if (data.topbreak_candidates.length > 0) {
          setTopBreakSelection(toOption(data.topbreak_candidates[0]));
        }
        if (data.categorical_candidates.length > 0) {
          setSideBreakSelection([toOption(data.categorical_candidates[0])]);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error(err);
        setSchemaError(err instanceof Error ? err.message : "Unable to load analysis schema.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSchemaLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const topBreakOptions = useMemo(() => {
    if (!schema) {
      return [];
    }
    return schema.topbreak_candidates.map(toOption);
  }, [schema]);

  const sideBreakOptions = useMemo(() => buildVariableOptions(schema), [schema]);

  const handleGenerate = async () => {
    if (!topBreakSelection) {
      setError("Select a top-break variable to continue.");
      return;
    }
    if (sideBreakSelection.length === 0) {
      setError("Select at least one variable to analyse.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await generateAnalysis({
        topBreak: topBreakSelection.value,
        variables: sideBreakSelection.map((item) => item.value),
        mode,
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
    const defaultTopBreak = topBreakOptions[0] ?? null;
    const defaultVariable = sideBreakOptions[0]?.options?.[0] ?? null;
    setTopBreakSelection(defaultTopBreak);
    setSideBreakSelection(defaultVariable ? [defaultVariable] : []);
    setMode(DISPLAY_MODES[0].value);
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
    const chart = analysis?.tables?.[0]?.chart;
    const chartStat = analysis?.tables?.[0]?.meta.stat ?? mode;
    if (!chart) {
      return null;
    }

    const labels = Array.from(
      new Set(
        chart.series
          .flatMap((series) => series.data)
          .map((point) => (typeof point.x === "number" ? String(point.x) : point.x)),
      ),
    );

    if (labels.length === 0) {
      return null;
    }

    const datasets = chart.series.map((series) => {
      return {
        label: series.name,
        data: labels.map((label) => {
          const match = series.data.find((point) => {
            const pointLabel = typeof point.x === "number" ? String(point.x) : point.x;
            return pointLabel === label;
          });
          return match ? match.y : 0;
        }),
        backgroundColor: series.color,
        borderRadius: 6,
      };
    });

    if (datasets.length === 0) {
      return null;
    }

    const isStacked = chart.kind === "stacked_bar";
    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom" as const,
        },
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: number } }) => {
              const label = context.dataset.label ?? "";
              const value = context.parsed?.y ?? 0;
              const suffix = chartStat === "counts" ? "" : "%";
              const formatted = chartStat === "counts" ? value.toFixed(0) : value.toFixed(1);
              return `${label}: ${formatted}${suffix}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: isStacked,
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          ticks: {
            callback: (value: string | number) => {
              if (chartStat === "counts") {
                return `${value}`;
              }
              return `${value}%`;
            },
          },
        },
      },
    };

    if (chart.kind === "grouped_bar" || chart.kind === "bar") {
      options.scales.x.stacked = false;
      options.scales.y.stacked = false;
    }

    return {
      data: {
        labels,
        datasets,
      },
      options,
    };
  }, [analysis, mode]);

  const primaryMeta = analysis?.tables?.[0]?.meta;
  const summaryTitle = primaryMeta ? describeMeta(primaryMeta) : "Analysis summary";
  const notes = analysis?.tables?.flatMap((table) => table.meta.notes ?? []) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OGSTEP Impact Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Slice post-survey outcomes by respondent attributes using the Netlify analysis service.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2" disabled={isSchemaLoading}>
            <RefreshCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || isSchemaLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Generate table
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Break configuration</CardTitle>
          <CardDescription>Choose the banner (top break) and row segment (variables) to crosstab.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {schemaError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{schemaError}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Top break (columns)</h3>
                <Badge variant="secondary">Recommended</Badge>
              </div>
              <Select<Option, false, GroupBase<Option>>
                closeMenuOnSelect
                components={animatedComponents}
                isMulti={false}
                options={topBreakOptions}
                value={topBreakSelection}
                styles={selectStyles as StylesConfig<Option, false, GroupBase<Option>>}
                onChange={(value) => setTopBreakSelection(value as Option)}
                placeholder={isSchemaLoading ? "Loading options..." : "Choose respondent attribute"}
                isDisabled={isSchemaLoading || topBreakOptions.length === 0}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Variables (rows)</h3>
                <Badge variant="secondary">Dataset</Badge>
              </div>
              <Select<Option, true, GroupBase<Option>>
                closeMenuOnSelect={false}
                components={animatedComponents}
                isMulti
                options={sideBreakOptions}
                value={sideBreakSelection}
                styles={selectStyles}
                onChange={(values) => setSideBreakSelection((values as Option[]) ?? [])}
                placeholder={isSchemaLoading ? "Loading variables..." : "Choose outcome indicators"}
                isDisabled={isSchemaLoading || sideBreakOptions.length === 0}
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
              <h3 className="text-sm font-medium">Guidance</h3>
              <p className="text-xs text-muted-foreground">
                Configure the table, then generate a fresh view powered by the Netlify serverless analysis endpoint.
              </p>
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

      {analysis && analysis.tables.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Results</h2>
              <p className="text-sm text-muted-foreground">
                {summaryTitle}. Sample size: {(primaryMeta?.n ?? 0).toLocaleString()} interviews. Statistic: {formatStatLabel(primaryMeta?.stat ?? mode)}.
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

          {notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Methodological notes</CardTitle>
                <CardDescription>Important caveats from the analysis service.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {notes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {chartConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Visual comparison</CardTitle>
                <CardDescription>{primaryMeta ? describeMeta(primaryMeta) : "Comparison"}</CardDescription>
              </CardHeader>
              <CardContent>
                <Bar data={chartConfig.data} options={chartConfig.options} />
              </CardContent>
            </Card>
          )}

          <div ref={tableContainerRef} className="space-y-6">
            {analysis.tables.map((table) => (
              <Card key={`${table.meta.variable}-${table.meta.topbreak ?? "overall"}`} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{describeMeta(table.meta)}</CardTitle>
                  <CardDescription>
                    Displaying {formatStatLabel(table.meta.stat)} for {table.meta.n.toLocaleString()} interviews.
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
