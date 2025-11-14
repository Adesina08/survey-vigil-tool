import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Circle, Target, XCircle } from "lucide-react";

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  completionRate: number;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
}

interface SummaryCardsProps {
  summary: SummaryData;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const knownPathTotal = Math.max(summary.treatmentPathCount + summary.controlPathCount, 0);

  const formatPathHelper = (count: number) => {
    if (knownPathTotal === 0) {
      return "No submissions with recorded OGSTEP path.";
    }

    const percentage = (count / knownPathTotal) * 100;
    return `${percentage.toFixed(1)}% of submissions with OGSTEP path`;
  };

  const cards = [
    {
      title: "Target interviews",
      value: formatNumber(summary.overallTarget),
      icon: Target,
      variant: "default" as const,
      helper: `Completion: ${formatPercentage(summary.completionRate)}`,
    },
    {
      title: "Total submissions",
      value: formatNumber(summary.totalSubmissions),
      icon: AlertCircle,
      variant: "default" as const,
      helper:
        summary.overallTarget > 0
          ? `${((summary.totalSubmissions / summary.overallTarget) * 100).toFixed(1)}% of target volume`
          : undefined,
    },
    {
      title: "Approved interviews",
      value: formatNumber(summary.approvedSubmissions),
      icon: CheckCircle,
      variant: "success" as const,
      helper: `Approval rate: ${formatPercentage(summary.approvalRate)}`,
    },
    {
      title: "Flagged interviews",
      value: formatNumber(summary.notApprovedSubmissions),
      icon: XCircle,
      variant: "destructive" as const,
      helper: `Flag rate: ${formatPercentage(summary.notApprovedRate)}`,
    },
    {
      title: "Treatment path",
      value: formatNumber(summary.treatmentPathCount),
      icon: Circle,
      variant: "treatment" as const,
      helper: formatPathHelper(summary.treatmentPathCount),
    },
    {
      title: "Control path",
      value: formatNumber(summary.controlPathCount),
      icon: Circle,
      variant: "control" as const,
      helper: formatPathHelper(summary.controlPathCount),
    },
  ];

  const getCardStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "border-success/20 bg-success/5";
      case "destructive":
        return "border-destructive/20 bg-destructive/5";
      case "treatment":
        return "border-blue-500/20 bg-blue-500/5";
      case "control":
        return "border-green-500/20 bg-green-500/5";
      default:
        return "";
    }
  };

  const getIconStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "text-success";
      case "destructive":
        return "text-destructive";
      case "treatment":
        return "text-blue-500";
      case "control":
        return "text-green-500";
      default:
        return "text-primary";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className={`count-up ${getCardStyles(card.variant)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${getIconStyles(card.variant)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
