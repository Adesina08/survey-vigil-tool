import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download, FileSpreadsheet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { sanitizeHtml } from "@/lib/sanitize";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import {
  type AnalysisChartSeries,
  type AnalysisChartSpec,
  type AnalysisTableResponse,
  getAnalysisTable,
} from "@/lib/api.analysis";
import { exportAnalysisToCSV, exportAnalysisToExcel } from "@/lib/exportAnalysis";

interface TopBreakAccordionProps {
  topbreak: string;
  allVariables: string[];
  formatLabel: (key: string) => string;
}

const ChartEmptyState = () => (
  <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
    No chart data available for the current selection.
  </div>
);

const COLOR_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#ef4444",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
];

const buildCartesianRows = (series: AnalysisChartSeries[]) => {
  const order: (string | number)[] = [];
  const lookup = new Map<string | number, Record<string, unknown>>();

  series.forEach((entry) => {
    entry.data.forEach((point) => {
      const key = point.x;
      if (!lookup.has(key)) {
        lookup.set(key, { x: key });
        order.push(key);
      }
      lookup.get(key)![entry.name] = point.y;
    });
  });

  return order.map((key) => lookup.get(key)!);
};

const AnalysisChart = ({ spec }: { spec: AnalysisChartSpec | null }) => {
  const dataRows = useMemo(() => {
    if (!spec || !spec.series?.length) {
      return [];
    }
    return buildCartesianRows(spec.series);
  }, [spec]);

  if (!spec || !spec.series.length) {
    return <ChartEmptyState />;
  }

  const isStacked = spec.kind === "stacked_bar" || spec.kind === "hist";

  return (
    <div className="h-80">
      <ResponsiveContainer>
        <BarChart data={dataRows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {spec.series.map((series, index) => (
            <Bar
              key={series.name}
              dataKey={series.name}
              stackId={isStacked ? "analysis" : undefined}
              fill={COLOR_PALETTE[index % COLOR_PALETTE.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const TopBreakAccordion = ({ topbreak, allVariables, formatLabel }: TopBreakAccordionProps) => {
  const [selectedVariable, setSelectedVariable] = useState<string>("");
  const [stat, setStat] = useState<"rowpct" | "counts" | "colpct" | "totalpct">("rowpct");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalysisTableResponse | null>(null);
  const cacheRef = useRef<Map<string, AnalysisTableResponse>>(new Map());
  const debouncedVariable = useDebouncedValue(selectedVariable, 400);

  const cacheKey = useMemo(() => `${topbreak}::${debouncedVariable || ""}::${stat}`, [topbreak, debouncedVariable, stat]);

  useEffect(() => {
    if (!debouncedVariable) {
      setResponse(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResponse(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getAnalysisTable({
      topbreak,
      variable: debouncedVariable,
      stat,
      signal: controller.signal,
    })
      .then((payload) => {
        cacheRef.current.set(cacheKey, payload);
        setResponse(payload);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to build table");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [cacheKey, debouncedVariable, stat, topbreak]);

  const sanitizedHtml = useMemo(() => {
    if (!response?.html) {
      return "";
    }
    return sanitizeHtml(response.html);
  }, [response]);

  const statOptions: { value: typeof stat; label: string }[] = [
    { value: "counts", label: "Counts" },
    { value: "rowpct", label: "Row %" },
    { value: "colpct", label: "Column %" },
    { value: "totalpct", label: "Total %" },
  ];

  return (
    <AccordionItem value={topbreak} className="border-b border-border/60">
      <AccordionTrigger className="text-left text-base font-semibold">
        {formatLabel(topbreak)}
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <Select value={selectedVariable} onValueChange={setSelectedVariable}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Select a variable to analyse" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allVariables.map((variable) => (
                    <SelectItem key={variable} value={variable}>
                      {formatLabel(variable)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Statistic</span>
              <Select value={stat} onValueChange={(value) => setStat(value as typeof stat)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && response && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">Analysis Results</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAnalysisToCSV(response.html, topbreak, selectedVariable, stat)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAnalysisToExcel(response.html, topbreak, selectedVariable, stat)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                </div>
              </div>
              
              <Card>
                <CardContent className="prose max-w-none overflow-x-auto py-4" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              </Card>

              <Card>
                <CardContent className="space-y-2 py-4">
                  <AnalysisChart spec={response.chart} />
                  {response.chart?.histogram ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Badge variant="secondary">Histogram</Badge>
                        <span className="text-muted-foreground">Distribution across {formatLabel(topbreak)}</span>
                      </div>
                      <AnalysisChart spec={response.chart.histogram} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">n = {response.meta.n.toLocaleString()}</Badge>
                <Badge variant="outline">Statistic: {response.meta.stat}</Badge>
                {response.meta.topbreak ? (
                  <Badge variant="outline">Top break: {formatLabel(response.meta.topbreak)}</Badge>
                ) : null}
                <Badge variant="outline">Variable: {formatLabel(response.meta.variable)}</Badge>
                {response.meta.notes?.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && !response && (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
              Select a variable to generate a cross-tabulation for {formatLabel(topbreak)}.
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default TopBreakAccordion;
