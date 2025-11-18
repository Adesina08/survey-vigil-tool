import { useEffect, useMemo, useRef, useState } from "react";
import Select, { type GroupBase, type StylesConfig } from "react-select";
import makeAnimated from "react-select/animated";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { AlertCircle, BarChart3, Download, RefreshCcw } from "lucide-react";

import { useDashboardData } from "@/hooks/useDashboardData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AnalysisRow } from "@/lib/dashboardData";

const animatedComponents = makeAnimated();

type Option = { label: string; value: string };

type CrosstabTable = {
  variableKey: string;
  variableLabel: string;
  rowValues: string[];
  colValues: string[];
  counts: Record<string, Record<string, number>>;
};

const selectStyles: StylesConfig<Option, true, GroupBase<Option>> = {
  control: (provided) => ({
    ...provided,
    borderRadius: "0.75rem",
    borderColor: "#e5e7eb",
    boxShadow: "none",
    padding: "2px 4px",
    minHeight: "48px",
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

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Missing";
  }
  return String(value);
};

const buildCrosstabTable = (
  rows: AnalysisRow[],
  variableKey: string,
  topBreakKeys: string[],
): CrosstabTable => {
  const counts: Record<string, Record<string, number>> = {};
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  rows.forEach((row) => {
    const rowValue = stringifyValue(row[variableKey]);
    const colValue =
      topBreakKeys.length === 0
        ? "Total"
        : topBreakKeys
            .map((key) => `${formatFieldLabel(key)}: ${stringifyValue(row[key])}`)
            .join(" | ");

    rowSet.add(rowValue);
    colSet.add(colValue);

    if (!counts[rowValue]) {
      counts[rowValue] = {};
    }
    counts[rowValue][colValue] = (counts[rowValue][colValue] ?? 0) + 1;
  });

  const rowValues = Array.from(rowSet).sort();
  const colValues = Array.from(colSet).sort();

  rowValues.forEach((rowValue) => {
    if (!counts[rowValue]) {
      counts[rowValue] = {};
    }
    colValues.forEach((colValue) => {
      if (counts[rowValue][colValue] === undefined) {
        counts[rowValue][colValue] = 0;
      }
    });
  });

  return {
    variableKey,
    variableLabel: formatFieldLabel(variableKey),
    rowValues,
    colValues,
    counts,
  };
};

const Analysis = () => {
  const { data: dashboardData, isLoading, isError, error: fetchError, refetch, isFetching } = useDashboardData();
  const rows = useMemo(() => (dashboardData?.analysisRows ?? []) as AnalysisRow[], [dashboardData?.analysisRows]);

  const availableFields = useMemo<string[]>(() => {
    if (!rows || rows.length === 0) {
      return [];
    }

    const keys = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!key || key.startsWith("_")) {
          return;
        }
        keys.add(key);
      });
    });

    return Array.from(keys).sort();
  }, [rows]);

  const allOptions = useMemo(() => availableFields.map(toOption), [availableFields]);

  const [topBreakSelection, setTopBreakSelection] = useState<Option[]>([]);
  const [variableSelection, setVariableSelection] = useState<Option[]>([]);
  const [tables, setTables] = useState<CrosstabTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (availableFields.length === 0) {
      return;
    }

    if (topBreakSelection.length === 0) {
      setTopBreakSelection([toOption(availableFields[0])]);
    }

    if (variableSelection.length === 0) {
      const fallbackVariable = availableFields[1] ?? availableFields[0];
      setVariableSelection([toOption(fallbackVariable)]);
    }
  }, [availableFields, topBreakSelection.length, variableSelection.length]);

  const handleGenerate = () => {
    if (variableSelection.length === 0) {
      setError("Select at least one variable to analyse.");
      return;
    }

    const computedTables = variableSelection.map((variable) =>
      buildCrosstabTable(rows, variable.value, topBreakSelection.map((option) => option.value)),
    );

    setTables(computedTables);
    setError(null);
  };

  const handleReset = () => {
    setTopBreakSelection([]);
    setVariableSelection([]);
    setTables([]);
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

  if ((isLoading || isFetching) && !dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <BarChart3 className="h-6 w-6 animate-pulse" />
          <p>Loading analysis data…</p>
        </div>
      </div>
    );
  }

  if (isError || !dashboardData?.analysisRows) {
    const errorMessage = fetchError?.message ?? "Unable to load analysis data.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const selectedTopBreakLabel = topBreakSelection.length
    ? topBreakSelection.map((item) => item.label).join(", ")
    : "None (showing totals)";

  const variableSummary = variableSelection.length
    ? variableSelection.map((item) => item.label).join(", ")
    : "No variables selected";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OGSTEP Impact Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Build one crosstab per variable. Variables become rows; selected top breaks become the shared columns.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Break configuration</CardTitle>
          <CardDescription>
            Pick the Top breaks (columns) and Variables (rows). Each selected variable renders its own table with the same
            banner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Top break (columns)</h3>
                <Badge variant="secondary">Multi-select</Badge>
              </div>
              <Select<Option, true, GroupBase<Option>>
                closeMenuOnSelect
                components={animatedComponents}
                isMulti
                options={allOptions}
                value={topBreakSelection}
                styles={selectStyles}
                onChange={(value) => setTopBreakSelection((value as Option[]) ?? [])}
                placeholder={isLoading ? "Loading options..." : "Choose respondent attribute"}
                isDisabled={isLoading || allOptions.length === 0}
              />
              <p className="text-xs text-muted-foreground">These fields populate the column banner for every table.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Variables (rows)</h3>
                <Badge variant="secondary">Multi-select</Badge>
              </div>
              <Select<Option, true, GroupBase<Option>>
                closeMenuOnSelect
                components={animatedComponents}
                isMulti
                options={allOptions}
                value={variableSelection}
                styles={selectStyles}
                onChange={(value) => setVariableSelection((value as Option[]) ?? [])}
                placeholder={isLoading ? "Loading variables..." : "Choose outcome indicator"}
                isDisabled={isLoading || allOptions.length === 0}
              />
              <p className="text-xs text-muted-foreground">
                Each selected variable produces its own table with rows for every response value.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} className="gap-2" disabled={isLoading}>
              <RefreshCcw className="h-4 w-4" /> Reset
            </Button>
            <Button onClick={handleGenerate} disabled={isLoading || rows.length === 0} className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Generate tables
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {tables.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Results</h2>
              <p className="text-sm text-muted-foreground">
                {tables.length} table{tables.length === 1 ? "" : "s"} built from {rows.length.toLocaleString()} rows. Top breaks:
                {" "}
                {selectedTopBreakLabel}. Variables: {variableSummary}.
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

          <div ref={tableContainerRef} className="space-y-6">
            {tables.map((table) => (
              <Card key={table.variableKey} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Variable: {table.variableLabel}</CardTitle>
                  <CardDescription>One column per Top break combination. Rows show each response option.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1 bg-muted/40 text-left">{table.variableLabel}</th>
                          {table.colValues.map((col) => (
                            <th key={col} className="border px-2 py-1 bg-muted/40">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rowValues.map((rowValue) => (
                          <tr key={rowValue}>
                            <td className="border px-2 py-1 font-medium">{rowValue}</td>
                            {table.colValues.map((colValue) => (
                              <td key={colValue} className="border px-2 py-1 text-center">
                                {table.counts[rowValue][colValue] ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
