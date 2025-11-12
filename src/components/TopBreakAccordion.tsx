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
import {
  buildAnalysisTable,
  type AnalysisTableResponse,
} from "@/lib/api.analysis";

/** Simple debounce hook kept local to make this component self-contained */
function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Minimal sanitize to avoid scripts; feel free to replace with your project’s sanitizer */
function basicSanitize(html: string): string {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

/** Very lightweight HTML->Excel download.
 * NOTE: If you already have a more robust `exportAnalysisToExcel(...)`, you can swap this call.
 */
function exportAnalysisToExcel(
  html: string,
  topbreak: string,
  variable: string | undefined | null,
  stat: "counts" | "rowpct" | "colpct" | "totalpct"
) {
  const blob = new Blob(
    [
      `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          ${html}
        </body>
      </html>
      `,
    ],
    { type: "application/vnd.ms-excel" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const tb = topbreak || "topbreak";
  const v = variable || "variable";
  a.href = url;
  a.download = `analysis_${tb}_${v}_${stat}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface TopBreakAccordionProps {
  /** existing props */
  topbreak: string;
  allVariables: string[];
  formatLabel: (key: string) => string;

  /** new external-control props (used by the redesigned Analysis page) */
  variable?: string | null; // sidebreak key (externally selected)
  statExternal?: "counts" | "rowpct" | "colpct" | "totalpct";
  analyzeKey?: number; // bump to trigger fresh analysis
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
  /** Internal state (used when not externally controlled) */
  const [selectedVariable, setSelectedVariable] = useState<string | undefined>();
  const [stat, setStat] = useState<"counts" | "rowpct" | "colpct" | "totalpct">(
    "counts"
  );

  /** Effective values (external wins if provided) */
  const effectiveVariable =
    typeof variable !== "undefined" && variable !== null
      ? variable
      : selectedVariable;

  const effectiveStat = statExternal ?? stat;

  /** Result & status */
  const [response, setResponse] = useState<AnalysisTableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Cache by key: prevents flicker and avoids repeated fetches for the same query */
  const cacheRef = useRef<Map<string, AnalysisTableResponse>>(new Map());

  /** Debounce variable to avoid spamming the API while typing/selecting */
  const debouncedVariable = useDebouncedValue(effectiveVariable, 400);

  /** Stable cache key (includes analyzeKey so the page’s Analyze button forces a refetch) */
  const cacheKey = useMemo(
    () =>
      `${topbreak}::${debouncedVariable || ""}::${effectiveStat}::${analyzeKey ?? 0}`,
    [topbreak, debouncedVariable, effectiveStat, analyzeKey]
  );

  /** Fetch on change */
  useEffect(() => {
    // If no variable yet, clear result and stop
    if (!debouncedVariable) {
      setResponse(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Cache hit?
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

    buildAnalysisTable({
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
        setError(
          err instanceof Error ? err.message : "Unable to build analysis table"
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [cacheKey, debouncedVariable, effectiveStat, topbreak]);

  const sanitizedHtml = useMemo(() => {
    if (!response?.html) return "";
    return basicSanitize(response.html);
  }, [response]);

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
          {/* Internal controls (hidden when externally controlled) */}
          {!hideControls && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Variable select */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Variable
                </div>
                <Select
                  value={selectedVariable}
                  onValueChange={(val) => setSelectedVariable(val)}
                >
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

              {/* Stat select */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Statistic
                </div>
                <Select
                  value={stat}
                  onValueChange={(val) =>
                    setStat(
                      val as "counts" | "rowpct" | "colpct" | "totalpct"
                    )
                  }
                >
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

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {!loading && !error && response && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Analysis Results
                </h3>
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
                  {/* Server-rendered HTML table */}
                  <div
                    className="prose max-w-none overflow-auto"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {typeof response.meta?.n === "number" && (
                  <Badge variant="outline">
                    n = {response.meta.n.toLocaleString()}
                  </Badge>
                )}
                {response.meta?.stat && (
                  <Badge variant="outline">Statistic: {response.meta.stat}</Badge>
                )}
                {response.meta?.topbreak && (
                  <Badge variant="outline">
                    Top break: {formatLabel(response.meta.topbreak)}
                  </Badge>
                )}
                {response.meta?.variable && (
                  <Badge variant="outline">
                    Variable: {formatLabel(response.meta.variable)}
                  </Badge>
                )}
                {response.meta?.notes?.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no variable chosen yet */}
          {!loading && !error && !response && (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
              Select a variable to generate a cross-tabulation for{" "}
              {formatLabel(topbreak)}.
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default TopBreakAccordion;
