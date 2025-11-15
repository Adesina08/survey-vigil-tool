import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Circle, Flag, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  maleCount: number;
  femaleCount: number;
}

interface SummaryCardsProps {
  summary: SummaryData;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const knownPathTotal = Math.max(summary.treatmentPathCount + summary.controlPathCount, 0);
  const knownGenderTotal = Math.max(summary.maleCount + summary.femaleCount, 0);

  const formatPathHelper = (count: number) => {
    if (knownPathTotal === 0) {
      return "No submissions with recorded OGSTEP path.";
    }

    const percentage = (count / knownPathTotal) * 100;
    return `${percentage.toFixed(1)}% of submissions with OGSTEP path`;
  };

  const formatGenderHelper = (count: number) => {
    if (knownGenderTotal === 0) {
      return "No respondents with recorded gender.";
    }

    const percentage = (count / knownGenderTotal) * 100;
    return `${percentage.toFixed(1)}% of respondents with recorded gender`;
  };

  const totalSubmissionRate =
    summary.overallTarget > 0 ? (summary.totalSubmissions / summary.overallTarget) * 100 : 0;

  type MetricTone = "default" | "success" | "destructive" | "treatment" | "control";

  interface CardMetric {
    label: string;
    value: string;
    helper?: string;
    icon?: LucideIcon;
    tone?: MetricTone;
  }

  interface CardConfig {
    title: string;
    icon: LucideIcon;
    variant: string;
    metrics: CardMetric[];
    footer?: string;
  }

  const cards: CardConfig[] = [
    {
      title: "Target interviews",
      icon: Target,
      variant: "default",
      metrics: [
        {
          label: "Overall target",
          value: formatNumber(summary.overallTarget),
          helper: `Approved completion: ${formatPercentage(summary.completionRate)}`,
        },
      ],
    },
    {
      title: "Total submissions",
      icon: AlertCircle,
      variant: "default",
      metrics: [
        {
          label: "Collected interviews",
          value: formatNumber(summary.totalSubmissions),
          helper:
            summary.overallTarget > 0
              ? `${formatPercentage(totalSubmissionRate)} of target volume`
              : undefined,
        },
      ],
    },
    {
      title: "Interview outcomes",
      icon: CheckCircle,
      variant: "success",
      metrics: [
        {
          label: "Approved",
          value: formatNumber(summary.approvedSubmissions),
          helper: `Approval rate: ${formatPercentage(summary.approvalRate)}`,
          icon: CheckCircle,
          tone: "success",
        },
        {
          label: "Flagged",
          value: formatNumber(summary.notApprovedSubmissions),
          helper: `Flag rate: ${formatPercentage(summary.notApprovedRate)}`,
          icon: Flag,
          tone: "destructive",
        },
      ],
    },
    {
      title: "OGSTEP paths",
      icon: Circle,
      variant: "treatment",
      metrics: [
        {
          label: "Treatment",
          value: formatNumber(summary.treatmentPathCount),
          helper: formatPathHelper(summary.treatmentPathCount),
          icon: Circle,
          tone: "treatment",
        },
        {
          label: "Control",
          value: formatNumber(summary.controlPathCount),
          helper: formatPathHelper(summary.controlPathCount),
          icon: Circle,
          tone: "control",
        },
      ],
      footer:
        summary.unknownPathCount > 0
          ? `${formatNumber(summary.unknownPathCount)} submissions without OGSTEP path`
          : undefined,
    },
    {
      title: "Gender distribution",
      icon: Users,
      variant: "default",
      metrics: [
        {
          label: "Male respondents",
          value: formatNumber(summary.maleCount),
          helper: formatGenderHelper(summary.maleCount),
        },
        {
          label: "Female respondents",
          value: formatNumber(summary.femaleCount),
          helper: formatGenderHelper(summary.femaleCount),
        },
      ],
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

  const getMetricToneStyles = (tone: MetricTone = "default") => {
    switch (tone) {
      case "success":
        return "text-success";
      case "destructive":
        return "text-destructive";
      case "treatment":
        return "text-blue-600 dark:text-blue-400";
      case "control":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`count-up h-full ${getCardStyles(card.variant)}`.trim()}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${getIconStyles(card.variant)}`} />
          </CardHeader>
          <CardContent>
            <div
              className={
                card.metrics.length > 1
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
                  : "space-y-3"
              }
            >
              {card.metrics.map((metric) => (
                <div key={metric.label} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {metric.icon ? (
                      <metric.icon className={`h-4 w-4 ${getMetricToneStyles(metric.tone)}`} />
                    ) : null}
                    <span>{metric.label}</span>
                  </div>
                  <div className={`text-xl font-semibold ${getMetricToneStyles(metric.tone)}`}>
                    {metric.value}
                  </div>
                  {metric.helper ? (
                    <div className="text-xs text-muted-foreground">{metric.helper}</div>
                  ) : null}
                </div>
              ))}
            </div>
            {card.footer ? (
              <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">{card.footer}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
