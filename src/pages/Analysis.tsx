import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion } from "@/components/ui/accordion";

import TopBreakAccordion from "@/components/TopBreakAccordion";
import SidebreakChips, { SidebreakOption } from "@/components/SidebreakChips";

import { useDashboardData } from "@/hooks/useDashboardData";
import { getAnalysisSchema, type AnalysisSchema } from "@/lib/api.analysis";

// Curated Top breaks (multiselect)
const CURATED_TOP_BREAKS = [
  "a3_select_the_lga",
  "a7_sex",
  "a9_marital_status",
  "a10_highest_education_completed",
];

const LABELS: Record<string, string> = {
  a3_select_the_lga: "A3. select the LGA",
  a7_sex: "A7. Sex",
  a9_marital_status: "A9. Marital status",
  a10_highest_education_completed: "A10. Highest education completed",
};

const formatKeyToLabel = (key: string) => LABELS[key] ?? key.replace(/_/g, " ");

// Sidebreak groups → JSON key mapping (single select)
const SIDEBREAK_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "SECTION B – PROGRAM EXPOSURE / PARTICIPATION",
    items: [
      { key: "b1_are_you_aware_of_ogstep", label: "B1 – Awareness of OGSTEP" },
      { key: "b2_did_you_participate_in_ogstep", label: "B2 – Participation in OGSTEP" },
      { key: "b4_type_of_support_received", label: "B4 – Type of support received" },
      { key: "b6_have_you_participated_in_any_other_training_support_program_in_the_last_3_years", label: "B6 – Participated in other programs" },
      { key: "b7_if_yes_specify_program_name", label: "B7 – Program name" },
    ],
  },
  {
    group: "SECTION C – TVET / SKILLS DEVELOPMENT",
    items: [
      { key: "c1_did_you_complete_ogstep_training", label: "C1 – Completed OGSTEP training" },
      { key: "c2_type_of_ogstep_training", label: "C2 – Type of OGSTEP training" },
      { key: "c3_did_you_complete_any_non_ogstep_training_in_last_3_years", label: "C3 – Completed any non-OGSTEP training" },
      { key: "c4_current_employment_status", label: "C4 – Current employment status" },
      { key: "c7_is_your_job_related_to_your_training", label: "C7 – Job related to training" },
      { key: "c8_main_barriers_to_finding_work", label: "C8 – Barriers to finding work" },
    ],
  },
  {
    group: "SECTION D – AGRICULTURE / VCDF FARMERS",
    items: [
      { key: "d1_do_you_currently_farm", label: "D1 – Currently farm" },
      { key: "d2_type_of_enterprise", label: "D2 – Type of enterprise" },
      { key: "d6_inputs_received_via_ogstep", label: "D6 – Inputs received via OGSTEP" },
      { key: "d7_inputs_received_from_other_sources", label: "D7 – Inputs from other sources" },
      { key: "d11_access_to_off_taker_contract", label: "D11 – Access to off-taker contract" },
    ],
  },
  {
    group: "SECTION E – SMEs / STARTUPS",
    items: [
      { key: "e1_own_or_manage_a_business", label: "E1 – Own/manage business" },
      { key: "e2_business_sector", label: "E2 – Business sector" },
      { key: "e6_received_ogstep_finance_support", label: "E6 – Received OGSTEP finance/support" },
      { key: "e7_received_other_support", label: "E7 – Received other support" },
      { key: "e8_adopted_new_technology_since_support", label: "E8 – Adopted new technology" },
      { key: "e9_main_constraints_to_growth", label: "E9 – Main constraints to growth" },
    ],
  },
  {
    group: "SECTION F – HOUSEHOLD & FOOD SECURITY",
    items: [
      { key: "f1_did_you_worry_that_your_household_would_not_have_enough_food", label: "F1 – Worry not enough food" },
      { key: "f2_did_you_or_any_household_member_have_to_eat_smaller_meals_than_you_felt_you_needed_because_there_wasnt_enough_food", label: "F2 – Smaller meals" },
      { key: "f3_did_you_or_any_household_member_eat_fewer_meals_in_a_day_because_there_wasnt_enough_food", label: "F3 – Fewer meals" },
      { key: "f4_did_you_or_any_household_member_go_to_sleep_hungry_because_there_wasnt_enough_food", label: "F4 – Sleep hungry" },
      { key: "f5_did_you_or_any_household_member_go_a_whole_day_and_night_without_eating_because_there_wasnt_enough_food", label: "F5 – Whole day without eating" },
      { key: "f6_compared_to_before_ogstep_has_your_household_food_situation_improved_stayed_the_same_or_worsened", label: "F6 – Household food situation" },
    ],
  },
  {
    group: "SECTION G – GENDER & YOUTH EMPOWERMENT",
    items: [
      { key: "g1_who_decides_income_use", label: "G1 – Who decides income use" },
      { key: "g2_have_your_own_savings_credit", label: "G2 – Have own savings/credit" },
      { key: "g3_member_of_mens_womens_or_youth_group", label: "G3 – Member of group" },
      { key: "g4_compared_to_before_ogstep_ability_to_influence_decisions", label: "G4 – Influence on decisions" },
    ],
  },
  {
    group: "SECTION H – PERCEPTIONS & SUSTAINABILITY",
    items: [
      { key: "h1_satisfaction_with_ogstep", label: "H1 – Satisfaction" },
      { key: "h2_trust_in_implementing_institutions", label: "H2 – Trust" },
      { key: "h3_can_you_continue_activities_without_external_support", label: "H3 – Continue without support" },
      { key: "h4_biggest_risks_to_sustaining_benefits", label: "H4 – Risks to sustain benefits" },
    ],
  },
];

type StatType = "counts" | "rowpct" | "colpct" | "totalpct";

const Analysis: React.FC = () => {
  // Keep data hook in case you use it elsewhere on the page
  useDashboardData();

  const { data: schema, isLoading, isError, refetch, isFetching } = useQuery<AnalysisSchema, Error>({
    queryKey: ["analysis-schema"],
    queryFn: () => getAnalysisSchema(undefined),
    staleTime: 10 * 60 * 1000,
  });

  // selections
  const [selectedTopBreaks, setSelectedTopBreaks] = useState<string[]>(["a3_select_the_lga"]);
  const [selectedSidebreak, setSelectedSidebreak] = useState<string | null>(null);
  const [stat, setStat] = useState<StatType>("counts");
  const [analyzeKey, setAnalyzeKey] = useState(0);

  const allVariables = useMemo(() => schema?.fields?.map((f) => f.name) ?? [], [schema]);

  const sidebreakOptions: SidebreakOption[] = useMemo(
    () => SIDEBREAK_GROUPS.flatMap(({ group, items }) => items.map(({ key, label }) => ({ key, label, group }))),
    []
  );

  const onAnalyze = () => setAnalyzeKey((n) => n + 1);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analysis</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCcw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
          Refresh schema
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading variables…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> Failed to load analysis schema
        </div>
      )}

      {/* Section 1: Top break (multiselect) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top break</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CURATED_TOP_BREAKS.map((key) => {
              const active = selectedTopBreaks.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setSelectedTopBreaks((prev) =>
                      active ? prev.filter((k) => k !== key) : [...prev, key]
                    )
                  }
                  className={
                    "rounded-full border px-3 py-1 text-sm " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted")
                  }
                >
                  {formatKeyToLabel(key)}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Sidebreaks (single-select, horizontal, grouped) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sidebreaks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SidebreakChips
            options={sidebreakOptions}
            value={selectedSidebreak}
            onChange={setSelectedSidebreak}
          />

          {/* Measure dropdown (small) + Analyze */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Measure:</span>
            <select
              value={stat}
              onChange={(e) => setStat(e.target.value as StatType)}
              className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="counts">Counts</option>
              <option value="rowpct">Row %</option>
              <option value="colpct">Column %</option>
              <option value="totalpct">Total %</option>
            </select>

            <Button
              className="ml-auto"
              disabled={!selectedSidebreak || selectedTopBreaks.length === 0}
              onClick={onAnalyze}
            >
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results: one block per selected Top break (WRAPPED IN ACCORDION) */}
      <Accordion type="multiple" className="space-y-4">
        {selectedTopBreaks.map((tb) => (
          <TopBreakAccordion
            key={`${tb}-${analyzeKey}`}
            topbreak={tb}
            allVariables={allVariables}
            formatLabel={formatKeyToLabel}
            variable={selectedSidebreak}
            statExternal={stat}
            analyzeKey={analyzeKey}
            hideControls
          />
        ))}
      </Accordion>
    </div>
  );
};

export default Analysis;
