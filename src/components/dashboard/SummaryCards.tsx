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
        return "border-success/30 bg-gradient-to-b from-success/10 via-background to-background";
      case "destructive":
        return "border-destructive/30 bg-gradient-to-b from-destructive/10 via-background to-background";
      case "treatment":
        return "border-blue-500/30 bg-gradient-to-b from-blue-500/10 via-background to-background";
      case "control":
        return "border-green-500/30 bg-gradient-to-b from-green-500/10 via-background to-background";
      default:
        return "border-border/70 bg-gradient-to-b from-muted/10 via-background to-background";
    }
  };

  const getAccentGradient = (variant: string) => {
    switch (variant) {
      case "success":
        return "from-success/80 via-success/60 to-success/80";
      case "destructive":
        return "from-destructive/70 via-destructive/60 to-destructive/70";
      case "treatment":
        return "from-blue-500/80 via-blue-400/70 to-blue-500/80";
      case "control":
        return "from-green-500/80 via-green-400/70 to-green-500/80";
      default:
        return "from-primary/70 via-primary/60 to-primary/70";
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

  const getIconBackgroundStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "bg-success/10 text-success";
      case "destructive":
        return "bg-destructive/10 text-destructive";
      case "treatment":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-300";
      case "control":
        return "bg-green-500/10 text-green-600 dark:text-green-300";
      default:
        return "bg-primary/10 text-primary";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`count-up relative h-full min-w-0 overflow-hidden border bg-card/80 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${getCardStyles(card.variant)}`.trim()}
        >
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getAccentGradient(card.variant)}`} />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1 text-balance">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Key Metric
              </p>
              <CardTitle className="text-lg font-semibold leading-tight text-foreground">{card.title}</CardTitle>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-border/60 ${getIconBackgroundStyles(card.variant)}`}
            >
              <card.icon className={`h-5 w-5 ${getIconStyles(card.variant)}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={
                card.metrics.length > 1
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
                  : "space-y-4"
            }
          >
            {card.metrics.map((metric) => (
              <div
                key={metric.label}
                className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-3 shadow-inner"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {metric.icon ? (
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/70 ${getMetricToneStyles(
                        metric.tone,
                      )}`}
                    >
                      <metric.icon className="h-4 w-4" />
                    </span>
                  ) : null}
                  <span className="min-w-0 leading-snug break-words text-balance">{metric.label}</span>
                </div>
                <div className={`text-3xl font-bold leading-tight tracking-tight ${getMetricToneStyles(metric.tone)}`}>
                  {metric.value}
                </div>
                {metric.helper ? (
                  <div className="text-xs leading-relaxed text-muted-foreground text-balance break-words">{metric.helper}</div>
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
