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
  data: SummaryData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const pathTotal = Math.max(
    data.treatmentPathCount + data.controlPathCount + data.unknownPathCount,
    0,
  );

  const formatPathHelper = (count: number) => {
    if (pathTotal === 0) {
      return "No submissions recorded";
    }

    const percentage = (count / pathTotal) * 100;
    const unknownNote =
      data.unknownPathCount > 0
        ? ` · ${data.unknownPathCount.toLocaleString()} unknown`
        : "";
    return `${percentage.toFixed(1)}% of submissions${unknownNote}`;
  };

  const cards = [
    {
      title: "Target interviews",
      value: formatNumber(data.overallTarget),
      icon: Target,
      variant: "default" as const,
      helper: `Completion: ${formatPercentage(data.completionRate)}`,
    },
    {
      title: "Total submissions",
      value: formatNumber(data.totalSubmissions),
      icon: AlertCircle,
      variant: "default" as const,
      helper:
        data.overallTarget > 0
          ? `${((data.totalSubmissions / data.overallTarget) * 100).toFixed(1)}% of target volume`
          : undefined,
    },
    {
      title: "Approved interviews",
      value: formatNumber(data.approvedSubmissions),
      icon: CheckCircle,
      variant: "success" as const,
      helper: `Approval rate: ${formatPercentage(data.approvalRate)}`,
    },
    {
      title: "Flagged interviews",
      value: formatNumber(data.notApprovedSubmissions),
      icon: XCircle,
      variant: "destructive" as const,
      helper: `Flag rate: ${formatPercentage(data.notApprovedRate)}`,
    },
    {
      title: "🔵 Treatment path",
      value: formatNumber(data.treatmentPathCount),
      icon: Circle,
      variant: "treatment" as const,
      helper: formatPathHelper(data.treatmentPathCount),
    },
    {
      title: "🟢 Control path",
      value: formatNumber(data.controlPathCount),
      icon: Circle,
      variant: "control" as const,
      helper: formatPathHelper(data.controlPathCount),
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
            {card.helper ? (
              <p className="mt-2 text-xs text-muted-foreground">{card.helper}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
