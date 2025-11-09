import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Target, XCircle } from "lucide-react";

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
}

interface SummaryCardsProps {
  data: SummaryData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const cards = [
    {
      title: "Overall Target",
      value: data.overallTarget.toLocaleString(),
      icon: Target,
      variant: "default" as const,
    },
    {
      title: "Total Submissions",
      value: data.totalSubmissions.toLocaleString(),
      icon: AlertCircle,
      variant: "default" as const,
    },
    {
      title: "Approved Submissions",
      value: `${data.approvedSubmissions.toLocaleString()} (${data.approvalRate}%)`,
      icon: CheckCircle,
      variant: "success" as const,
    },
    {
      title: "Not Approved Submissions",
      value: `${data.notApprovedSubmissions.toLocaleString()} (${data.notApprovedRate}%)`,
      icon: XCircle,
      variant: "destructive" as const,
    },
  ];

  const getCardStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "border-success/20 bg-success/5";
      case "destructive":
        return "border-destructive/20 bg-destructive/5";
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
