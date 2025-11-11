import { Loader2 } from "lucide-react";

import { SummaryCards } from "@/components/KPI/SummaryCards";
import { RankingTable } from "@/components/UserProductivity/RankingTable";
import { SubmissionQualityOverview } from "@/components/SubmissionQuality/Overview";
import { ErrorBreakdown } from "@/components/ErrorBreakdown/ErrorBreakdown";
import { ExportControls } from "@/components/Export/ExportControls";
import { useSurveyData } from "@/hooks/useSurveyData";
import type { SurveyRow } from "@/utils/qcMetrics";

interface QualityControlProps {
  rows: SurveyRow[];
  isLoading?: boolean;
}

const QualityControl = ({ rows, isLoading = false }: QualityControlProps) => {
  const data = useSurveyData(rows);

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading survey quality metrics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <SummaryCards totals={data.totals} />
        </div>
        <div className="lg:ml-6 lg:w-64">
          <ExportControls exports={data.exports} filenamePrefix="survey-qc" />
        </div>
      </div>

      <RankingTable data={data.ranking} totals={data.totals} />

      <SubmissionQualityOverview chartData={data.chartData} qcTable={data.qcTable} />

      <ErrorBreakdown totalErrors={data.errorBreakdown.totalErrors} rows={data.errorBreakdown.rows} />
    </div>
  );
};

export default QualityControl;

