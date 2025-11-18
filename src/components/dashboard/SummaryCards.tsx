import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    tone?: MetricTone;
  }

  interface CardConfig {
    title: string;
    variant: string;
    metrics: CardMetric[];
    footer?: string;
  }

  const cards: CardConfig[] = [
    {
      title: "Target interviews",
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
      variant: "success",
      metrics: [
        {
          label: "Approved",
          value: formatNumber(summary.approvedSubmissions),
          helper: `Approval rate: ${formatPercentage(summary.approvalRate)}`,
          tone: "success",
        },
        {
          label: "Flagged",
          value: formatNumber(summary.notApprovedSubmissions),
          helper: `Flag rate: ${formatPercentage(summary.notApprovedRate)}`,
          tone: "destructive",
        },
      ],
    },
    {
      title: "OGSTEP paths",
      variant: "treatment",
      metrics: [
        {
          label: "Treatment",
          value: formatNumber(summary.treatmentPathCount),
          helper: formatPathHelper(summary.treatmentPathCount),
          tone: "treatment",
        },
        {
          label: "Control",
          value: formatNumber(summary.controlPathCount),
          helper: formatPathHelper(summary.controlPathCount),
          tone: "control",
        },
        {
          label: "Unqualified Respondent",
          value: formatNumber(summary.unknownPathCount),
        },
      ],
    },
    {
      title: "Gender distribution",
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
        return "border-emerald-500/30 from-emerald-900/40";
      case "destructive":
        return "border-rose-500/30 from-rose-900/30";
      case "treatment":
        return "border-amber-400/30 from-amber-900/30";
      case "control":
        return "border-cyan-400/30 from-cyan-900/30";
      default:
        return "border-slate-800 from-slate-900";
    }
  };

  const getAccentGradient = (variant: string) => {
    switch (variant) {
      case "success":
        return "from-emerald-400 via-emerald-300 to-emerald-400";
      case "destructive":
        return "from-rose-400 via-rose-300 to-rose-400";
      case "treatment":
        return "from-amber-300 via-amber-200 to-amber-300";
      case "control":
        return "from-cyan-300 via-cyan-200 to-cyan-300";
      default:
        return "from-sky-400 via-indigo-300 to-sky-400";
    }
  };

  const getMetricToneStyles = (tone: MetricTone = "default") => {
    switch (tone) {
      case "success":
        return "text-emerald-300";
      case "destructive":
        return "text-rose-300";
      case "treatment":
        return "text-amber-200";
      case "control":
        return "text-cyan-200";
      default:
        return "text-slate-50";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`count-up relative h-full min-w-0 overflow-hidden border bg-gradient-to-b via-slate-950/50 to-slate-950/80 text-slate-100 shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${getCardStyles(card.variant)}`.trim()}
        >
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getAccentGradient(card.variant)}`} />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold leading-tight text-slate-100">{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={
                card.metrics.length > 1
                  ? "grid grid-cols-2 gap-6"
                  : "space-y-3"
              }
            >
              {card.metrics.map((metric) => (
                <div key={metric.label} className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </div>
                  <div className={`text-3xl font-semibold leading-tight sm:text-4xl ${getMetricToneStyles(metric.tone)}`}>
                    {metric.value}
                  </div>
                  {metric.helper ? <div className="text-xs text-slate-400">{metric.helper}</div> : null}
                </div>
              ))}
            </div>
            {card.footer ? (
              <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-200/80">{card.footer}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
