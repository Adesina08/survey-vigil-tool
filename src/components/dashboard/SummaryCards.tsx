import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  canceledSubmissions: number;
  canceledRate: number;
  wrongVersionFlagCount: number;
  terminatedInterviews: number;
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
  const invalidSubmissionsTotal = summary.terminatedInterviews + summary.wrongVersionFlagCount;
  const unqualifiedRespondents = summary.unknownPathCount;
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

  const validSubmissions = Math.max(summary.totalSubmissions - invalidSubmissionsTotal, 0);

  const totalSubmissionRate =
    summary.overallTarget > 0 ? (summary.totalSubmissions / summary.overallTarget) * 100 : 0;

  const validSubmissionRate =
    summary.overallTarget > 0 ? (validSubmissions / summary.overallTarget) * 100 : 0;

  type MetricTone = "default" | "success" | "destructive" | "treatment" | "control";

  interface CardMetric {
    label: string;
    value: string;
    helper?: string;
    tone?: MetricTone;
    colSpan?: number;
    valueClassName?: string;
    labelClassName?: string;
    extraHelperLine?: boolean;
  }

  interface CardConfig {
    title: string;
    variant: string;
    metrics: CardMetric[];
    footer?: string;
  }

  const cards: CardConfig[] = [
    {
      title: "Target Interviews",
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
      title: "Submissions",
      variant: "default",
      metrics: [
        {
          label: "Total submissions",
          value: formatNumber(summary.totalSubmissions),
          helper:
            summary.overallTarget > 0
              ? `${formatPercentage(totalSubmissionRate)} of target volume`
              : "",
        },
        {
          label: "Valid submissions",
          value: formatNumber(validSubmissions),
          helper:
            summary.overallTarget > 0
              ? `${formatPercentage(validSubmissionRate)} of target volume`
              : "",
        },
        {
          label: "Terminated interviews",
          value: formatNumber(summary.terminatedInterviews),
          helper: `Includes ${formatNumber(unqualifiedRespondents)} unqualified respondents`,
          labelClassName: "text-[10px] sm:text-[11px]",
          valueClassName: "text-2xl sm:text-3xl",
        },
        {
          label: "Wrong Version",
          value: formatNumber(summary.wrongVersionFlagCount),
          helper: "",
          labelClassName: "text-[10px] sm:text-[11px]",
          valueClassName: "text-2xl sm:text-3xl",
        },
      ],
    },
    {
      title: "Interview Outcomes",
      variant: "success",
      metrics: [
        {
          label: "Approved",
          value: formatNumber(summary.approvedSubmissions),
          helper: `Approval rate: ${formatPercentage(summary.approvalRate)}`,
          tone: "success",
          valueClassName: "mt-1",
          extraHelperLine: true,
        },
        {
          label: "Not Approved",
          value: formatNumber(summary.notApprovedSubmissions),
          helper: `Not approved rate: ${formatPercentage(summary.notApprovedRate)}`,
          tone: "destructive",
          labelClassName: "whitespace-nowrap",
          extraHelperLine: true,
        },
        {
          label: "Canceled",
          value: formatNumber(summary.canceledSubmissions),
          helper: `Cancellation rate: ${formatPercentage(summary.canceledRate)}`,
        },
      ],
    },
    {
      title: "OGSTEP Paths",
      variant: "treatment",
      metrics: [
        {
          label: "Treatment",
          value: formatNumber(summary.treatmentPathCount),
          helper: formatPathHelper(summary.treatmentPathCount),
          tone: "treatment",
          extraHelperLine: true,
        },
        {
          label: "Control",
          value: formatNumber(summary.controlPathCount),
          helper: formatPathHelper(summary.controlPathCount),
          tone: "control",
          extraHelperLine: true,
        },
      ],
    },
    {
      title: "Gender Distribution",
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

  const renderMetric = (metric: CardMetric) => (
      <div
        key={metric.label}
        className={`flex flex-col items-start gap-1.5 ${
          metric.colSpan ? `col-span-${metric.colSpan}` : ""
        }`.trim()}
      >
        <div
          className={`text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${
            metric.labelClassName ?? ""
          }`.trim()}
        >
          {metric.label}
        </div>
        <div
          className={`text-3xl font-semibold leading-tight sm:text-4xl ${getMetricToneStyles(
            metric.tone
          )} ${metric.valueClassName ?? ""}`.trim()}
        >
          {metric.value}
        </div>
        <div className="min-h-[18px] text-xs leading-snug text-muted-foreground">{metric.helper ?? ""}</div>
        {metric.extraHelperLine ? <div className="min-h-[18px] text-xs text-transparent">-</div> : null}
      </div>
  );

  const renderMetrics = (card: CardConfig) => {
    if (card.title === "Submissions") {
      const [totalSubmissions, validSubmissionsMetric, ...invalidMetrics] = card.metrics;

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {totalSubmissions ? renderMetric(totalSubmissions) : null}
            {validSubmissionsMetric ? renderMetric(validSubmissionsMetric) : null}
          </div>
          {invalidMetrics.length > 0 ? (
            <div className="rounded-lg border border-amber-200/70 bg-amber-500/10 p-3 pb-2 dark:border-amber-500/30 dark:bg-amber-500/5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <span aria-label="Caution" role="img">
                  🚨
                </span>
                <span>Invalid Submissions</span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {invalidMetrics.map((metric) => renderMetric(metric))}
              </div>
              <div className="mt-2 text-right text-xs text-amber-800/80 dark:text-amber-200/80">
                Sum<sub className="text-[10px] align-sub">subscript</sub>: {formatNumber(invalidSubmissionsTotal)}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    const gridColumns = card.metrics.length > 1 ? "grid grid-cols-2" : "grid grid-cols-1";

    return (
      <div className={`${gridColumns} items-start gap-4 sm:gap-6`}>
        {card.metrics.map((metric) => renderMetric(metric))}
      </div>
    );
  };

  const getCardStyles = (variant: string) => {
    switch (variant) {
        case "success":
          return "border-emerald-200/80 dark:border-emerald-500/40";
        case "destructive":
          return "border-rose-200/80 dark:border-rose-500/40";
        case "treatment":
          return "border-amber-200/80 dark:border-amber-400/30";
        case "control":
          return "border-cyan-200/80 dark:border-cyan-400/30";
        default:
          return "border-border";
      }
    };

  const getAccentGradient = (variant: string) => {
    switch (variant) {
        case "success":
          return "from-emerald-500/80 via-emerald-400/80 to-emerald-500/80";
        case "destructive":
          return "from-rose-500/80 via-rose-400/80 to-rose-500/80";
        case "treatment":
          return "from-amber-400/80 via-amber-300/80 to-amber-400/80";
        case "control":
          return "from-cyan-400/80 via-cyan-300/80 to-cyan-400/80";
        default:
          return "from-sky-500/80 via-indigo-400/80 to-sky-500/80";
      }
    };

  const getMetricToneStyles = (tone: MetricTone = "default") => {
    switch (tone) {
        case "success":
          return "text-success";
        case "destructive":
          return "text-destructive";
        case "treatment":
          return "text-amber-700 dark:text-amber-200";
        case "control":
          return "text-cyan-700 dark:text-cyan-200";
        default:
          return "text-card-foreground";
      }
    };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
          <Card
            key={card.title}
            className={`count-up relative h-full min-w-0 overflow-hidden border bg-gradient-to-b from-card/95 via-card/90 to-card/95 text-card-foreground shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${getCardStyles(card.variant)}`.trim()}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getAccentGradient(card.variant)}`} />
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold leading-tight text-card-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-3">
              {renderMetrics(card)}
              {card.footer ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{card.footer}</div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    );
}
