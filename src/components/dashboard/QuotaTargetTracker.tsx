import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QUOTA_TARGETS } from "@/lib/quotaTargets";
import { quotaMappers, type QuotaRecord, type QuotaMappers } from "@/lib/quotaMappers";

const toPercent = (value: number): string => `${Math.round(value * 100)}%`;

const calculatePercent = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
};

const withinApproximateBand = (value: number, target: number, tolerance = 0.05): boolean =>
  Math.abs(value - target) <= tolerance;

interface QuotaRowProps {
  label: string;
  value: number;
  target: number;
  mode: "min" | "approx";
}

const QuotaRow = ({ label, value, target, mode }: QuotaRowProps) => {
  const meetsTarget =
    mode === "min" ? value >= target : withinApproximateBand(value, target, 0.05);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>{toPercent(value)}</span>
        <span className="text-xs font-normal text-muted-foreground">
          target {toPercent(target)} {mode === "approx" ? "≈" : "≥"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            meetsTarget ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {meetsTarget ? "On track" : "Behind"}
        </span>
      </div>
    </div>
  );
};

interface QuotaGroup {
  pillar: string;
  arm: string;
  total: number;
  femaleCount: number;
  youthCount: number;
}

const buildGroupKey = (pillar: string, arm: string) => `${pillar}||${arm}`;

interface QuotaTargetTrackerProps {
  records: QuotaRecord[] | undefined;
  mappers?: Partial<QuotaMappers>;
}

export function QuotaTargetTracker({ records, mappers }: QuotaTargetTrackerProps) {
  const activeMappers: QuotaMappers = useMemo(
    () => ({ ...quotaMappers, ...mappers }),
    [mappers],
  );

  const groups = useMemo(() => {
    if (!records || records.length === 0) {
      return [] as QuotaGroup[];
    }

    const collection = new Map<string, QuotaGroup>();

    records.forEach((record) => {
      const pillarRaw = activeMappers.getPillar(record);
      const armRaw = activeMappers.getArm(record);
      const pillar = pillarRaw || "Unknown pillar";
      const arm = armRaw || "Comparison";
      const key = buildGroupKey(pillar, arm);

      if (!collection.has(key)) {
        collection.set(key, {
          pillar,
          arm,
          total: 0,
          femaleCount: 0,
          youthCount: 0,
        });
      }

      const group = collection.get(key)!;
      group.total += 1;

      const sex = activeMappers.getSex(record).toLowerCase();
      if (sex === "female" || sex === "f") {
        group.femaleCount += 1;
      }

      if (activeMappers.isYouth(record)) {
        group.youthCount += 1;
      }
    });

    return Array.from(collection.values()).sort((a, b) => {
      const pillarCompare = a.pillar.localeCompare(b.pillar);
      if (pillarCompare !== 0) {
        return pillarCompare;
      }
      return a.arm.localeCompare(b.arm);
    });
  }, [activeMappers, records]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg shadow-primary/15">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <CardTitle className="text-lg">Quota Tracker (Gender & Youth)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {groups.map((group) => {
          const target = QUOTA_TARGETS[group.pillar]?.[group.arm] ?? {};
          const femaleTarget = target.targetFemale ?? target.minFemale;
          const youthTarget = target.targetYouth ?? target.minYouth;
          const femaleMode = target.targetFemale !== undefined ? "approx" : "min";
          const youthMode = target.targetYouth !== undefined ? "approx" : "min";
          const femaleShare = calculatePercent(group.femaleCount, group.total);
          const youthShare = calculatePercent(group.youthCount, group.total);
          const achievedLabel = target.n ? `${group.total}/${target.n} collected` : `${group.total}`;
          const hasReachedTotal = target.n ? group.total >= target.n : true;
          const progress = target.n ? Math.min(100, (group.total / target.n) * 100) : 100;

          return (
            <div key={buildGroupKey(group.pillar, group.arm)} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-base font-semibold">{group.pillar} — {group.arm}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    hasReachedTotal ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {achievedLabel}
                </span>
              </div>
              {target.n ? (
                <div className="h-2 w-full rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${progress}%` }}
                    aria-label={`${achievedLabel}`}
                  />
                </div>
              ) : null}
              {typeof femaleTarget === "number" ? (
                <QuotaRow
                  label="Female share"
                  value={femaleShare}
                  target={femaleTarget}
                  mode={femaleMode}
                />
              ) : null}
              {typeof youthTarget === "number" ? (
                <QuotaRow
                  label="Youth share"
                  value={youthShare}
                  target={youthTarget}
                  mode={youthMode}
                />
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
