import { CheckCircle2, OctagonAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardsProps {
  totals: {
    approved: number;
    flagged: number;
    total: number;
    approvalRate: number;
    flaggedRate: number;
  };
}

const formatNumber = (value: number) => value.toLocaleString();
const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

export const SummaryCards = ({ totals }: SummaryCardsProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <Card className="border-success/40 bg-success/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-success">Approved Interviews</CardTitle>
        <CheckCircle2 className="h-5 w-5 text-success" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-success">{formatNumber(totals.approved)}</div>
        <p className="mt-2 text-sm text-success/80">
          {totals.total > 0 ? `${formatPercentage(totals.approvalRate)} of ${formatNumber(totals.total)} interviews` : "No submissions yet"}
        </p>
      </CardContent>
    </Card>

    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-destructive">Flagged Interviews</CardTitle>
        <OctagonAlert className="h-5 w-5 text-destructive" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-destructive">{formatNumber(totals.flagged)}</div>
        <p className="mt-2 text-sm text-destructive/80">
          {totals.total > 0 ? `${formatPercentage(totals.flaggedRate)} of ${formatNumber(totals.total)} interviews` : "No submissions yet"}
        </p>
      </CardContent>
    </Card>
  </div>
);

