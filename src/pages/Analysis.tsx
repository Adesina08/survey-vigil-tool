import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";

import TopBreakAccordion from "@/components/TopBreakAccordion";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getAnalysisSchema, type AnalysisSchema } from "@/lib/api.analysis";

const CURATED_TOP_BREAKS = [
  "a3_select_the_lga",
  "a3b_select_the_ward",
  "a7_sex",
  "a8_age",
  "c4_current_employment_status",
  "d2_type_of_enterprise",
  "e2_business_sector",
  "g3_member_of_mens_womens_or_youth_group",
  "h1_satisfaction_with_ogstep",
  "h2_trust_in_implementing_institutions",
];

const formatKeyToLabel = (key: string) => {
  if (!key) {
    return "Unknown";
  }
  return key
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const buildTopBreakList = (schema: AnalysisSchema | undefined) => {
  if (!schema) {
    return [];
  }

  const fieldMap = new Map(schema.fields.map((field) => [field.name, field]));
  const curated = CURATED_TOP_BREAKS.filter((key) => fieldMap.has(key));

  const autoCandidates = schema.fields
    .filter((field) => {
      if (!fieldMap.has(field.name)) {
        return false;
      }
      const isCategorical = field.type === "categorical" || field.distinct_count <= 30;
      return isCategorical;
    })
    .map((field) => field.name);

  const extra = new Set<string>([...(schema.topbreak_candidates ?? []), ...autoCandidates]);
  curated.forEach((key) => extra.delete(key));

  const extraSorted = Array.from(extra).sort((a, b) => a.localeCompare(b));

  return [...curated, ...extraSorted];
};

const Analysis = () => {
  const { data: dashboardData } = useDashboardData();
  const cachedRowsRef = useRef(dashboardData?.analysisRows ?? []);

  useEffect(() => {
    if (dashboardData?.analysisRows?.length) {
      cachedRowsRef.current = dashboardData.analysisRows;
    }
  }, [dashboardData]);

  const schemaQuery = useQuery({
    queryKey: ["analysis", "schema"],
    queryFn: () => getAnalysisSchema(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const topBreaks = useMemo(() => buildTopBreakList(schemaQuery.data), [schemaQuery.data]);
  const allVariables = useMemo(() => {
    if (!schemaQuery.data?.fields) {
      return [];
    }
    return [...schemaQuery.data.fields.map((field) => field.name)].sort((a, b) => a.localeCompare(b));
  }, [schemaQuery.data]);

  if (schemaQuery.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading analysis schema…</span>
        </div>
      </div>
    );
  }

  if (schemaQuery.isError || !schemaQuery.data) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <CardTitle className="text-base font-semibold">Analysis service unavailable</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => schemaQuery.refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {schemaQuery.error instanceof Error
              ? schemaQuery.error.message
              : "We were unable to load the analysis schema."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (topBreaks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">No categorical top breaks available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We could not identify any categorical dimensions suitable for top-break analysis. Ensure your dataset includes
            categorical fields with limited cardinality.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Analysis workspace</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">Top breaks: {topBreaks.length}</Badge>
          <Badge variant="outline">Variables: {allVariables.length}</Badge>
          {cachedRowsRef.current.length ? (
            <Badge variant="outline">Cached rows: {cachedRowsRef.current.length.toLocaleString()}</Badge>
          ) : null}
          <span>
            Select a top break to compare survey variables. Tables are generated server-side with great_tables and rendered
            alongside interactive charts.
          </span>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {topBreaks.map((topbreak) => (
          <TopBreakAccordion
            key={topbreak}
            topbreak={topbreak}
            allVariables={allVariables}
            formatLabel={formatKeyToLabel}
          />
        ))}
      </Accordion>
    </div>
  );
};

export default Analysis;
