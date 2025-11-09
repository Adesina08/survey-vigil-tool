import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Target, XCircle, Ban, StopCircle } from "lucide-react";

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  validSubmissions: number;
  validPercentage: number;
  invalidSubmissions: number;
  invalidPercentage: number;
  forceApproved: number;
  forceCancelled: number;
  terminated: number;
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
      title: "Valid Submissions",
      value: `${data.validSubmissions.toLocaleString()} (${data.validPercentage}%)`,
      icon: CheckCircle,
      variant: "success" as const,
    },
    {
      title: "Invalid Submissions",
      value: `${data.invalidSubmissions.toLocaleString()} (${data.invalidPercentage}%)`,
      icon: XCircle,
      variant: "destructive" as const,
    },
    {
      title: "Force Approved",
      value: data.forceApproved.toLocaleString(),
      icon: CheckCircle,
      variant: "default" as const,
    },
    {
      title: "Force Cancelled",
      value: data.forceCancelled.toLocaleString(),
      icon: Ban,
      variant: "default" as const,
    },
    {
      title: "Terminated",
      value: data.terminated.toLocaleString(),
      icon: StopCircle,
      variant: "warning" as const,
    },
  ];

  const getCardStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "border-success/20 bg-success/5";
      case "destructive":
        return "border-destructive/20 bg-destructive/5";
      case "warning":
        return "border-warning/20 bg-warning/5";
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
      case "warning":
        return "text-warning";
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
