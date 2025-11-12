import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { AlertCircle, FileSpreadsheet } from "lucide-react";
import { ANALYSIS_TABLE_ENDPOINT } from "@/lib/api.endpoints";

type StatType = "counts" | "rowpct" | "colpct" | "totalpct";
type AnalysisTableResponse = {
  html: string;
  meta: {
    n?: number;
    stat?: string;
    topbreak?: string;
    variable?: string;
    notes?: string[];
  };
  chart?: unknown;
};

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    s.set(k, String(v));
  });
  return s.toString();
}

async function fetchAnalysisTable(opts: {
  topbreak: string;
  variable: string;
  stat: StatType;
  signal?: AbortSignal;
}): Promise<AnalysisTableResponse> {
  const qs = buildQuery({
    topbreak: opts.topbreak,
    variable: opts.variable,
    stat: opts.stat,
  });
  const url = qs ? `${ANALYSIS_TABLE_ENDPOINT}?${qs}` : ANALYSIS_TABLE_ENDPOINT;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to build analysis table");
  }
  return res.json() as Promise<AnalysisTableResponse>;
}

function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function basicSanitize(html: string): string {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function exportAnalysisToExcel(
  html: string,
  topbreak: string,
  variable: string | undefined | null,
  stat: StatType
) {
  const blob = new Blob(
    [
      `<!doctype html><html><head><meta charset="UTF-8" /></head><body>${html}</body></html>`,
    ],
    { type: "application/vnd.ms-excel" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const tb = topbreak || "topbreak";
  const v = variable || "variable";
  a.download = `analysis_${tb}_${v}_${stat}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface TopBreakAccordionProps {
  topbreak: string;
  allVariables: string[];
  formatLabel: (key: string) => string;

  variable?: string | null; // external sidebreak
  statExternal?: StatType;
  analyzeKey?: number; // bump to refetch
  hideControls?: boolean; // hide internal selects when externally controlled
}

const TopBreakAccordion: React.FC<TopBreakAccordionProps> = ({
  topbreak,
  allVariables,
  formatLabel,
  variable,
  statExternal,
  analyzeKey,
  hideControls,
}) => {
  const [selectedVariable, setSelectedVariable] = useState<string | undefined>();
  const [stat, setStat] = useState<StatType>("counts");

  const effectiveVariable =
    typeof variable !== "undefined" && variable !== null ? variable : selectedVariable;
  const effectiveStat = statExternal ?? stat;

  const [response, setResponse] = useState<AnalysisTableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, AnalysisTableResponse>>(new Map());
  const debouncedVariable = useDebouncedValue(effectiveVariable, 400);

  const cacheKey = useMemo(
    () =>
      `${topbreak}::${debouncedVariable || ""}::${effectiveStat}::${analyzeKey ?? 0}`,
    [topbreak, debouncedVariable, effectiveStat, analyzeKey]
  );

  useEffect(() => {
    if (!debouncedVariable) {
      setResponse(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResponse(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();

    fetchAnalysisTable({
      topbreak,
      variable: debouncedVariable,
      stat: effectiveStat,
      signal: controller.signal,
    })
      .then((res) => {
        cacheRef.current.set(cacheKey, res);
        setResponse(res);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to build analysis table");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [cacheKey, debouncedVariable, effectiveStat, topbreak]);

  const sanitizedHtml = useMemo(
    () => (response?.html ? basicSanitize(response.html) : ""),
    [response]
  );

  return (
    <AccordionItem value={topbreak} className="border-b border-border/60">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formatLabel(topbreak)}</span>
            {response?.meta?.n ? (
              <Badge variant="outline">n = {response.meta.n.toLocaleString()}</Badge>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            {effectiveStat === "counts"
              ? "Counts"
              : effectiveStat === "rowpct"
              ? "Row %"
              : effectiveStat === "colpct"
              ? "Column %"
              : "Total %"}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <div className="space-y-4">
          {!hideControls && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Variable</div>
                <Select value={selectedVariable} onValueChange={(val) => setSelectedVariable(val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a variable to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {allVariables.map((v) => (
                      <SelectItem key={v} value={v}>
                        {formatLabel(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Statistic</div>
                <Select value={stat} onValueChange={(val) => setStat(val as StatType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Counts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="counts">Counts</SelectItem>
                    <SelectItem value="rowpct">Row %</SelectItem>
                    <SelectItem value="colpct">Column %</SelectItem>
                    <SelectItem value="totalpct">Total %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportAnalysisToExcel(
                      response.html,
                      topbreak,
                      response.meta?.variable,
                      effectiveStat
                    )
                  }
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export table
                </Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div
                    className="prose max-w-none overflow-auto"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {typeof response.meta?.n === "number" && (
                  <Badge variant="outline">n = {response.meta.n.toLocaleString()}</Badge>
                )}
                {response.meta?.stat && (
                  <Badge variant="outline">Statistic: {response.meta.stat}</Badge>
                )}
                {response.meta?.topbreak && (
                  <Badge variant="outline">Top break: {formatLabel(response.meta.topbreak)}</Badge>
                )}
                {response.meta?.variable && (
                  <Badge variant="outline">Variable: {formatLabel(response.meta.variable)}</Badge>
                )}
                {response.meta?.notes?.map((note) => (
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
