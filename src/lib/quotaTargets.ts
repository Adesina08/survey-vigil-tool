export interface QuotaTargetConfig {
  n?: number;
  minFemale?: number;
  minYouth?: number;
  targetFemale?: number;
  targetYouth?: number;
}

export type QuotaArmTargets = Record<string, QuotaTargetConfig>;

export type QuotaTargets = Record<string, QuotaArmTargets>;

export const QUOTA_TARGETS: QuotaTargets = {
  TVET: {
    Treatment: { n: 800, minFemale: 0.4, minYouth: 0.5 },
    Comparison: { n: 800, minFemale: 0.4, minYouth: 0.5 },
  },
  Agriculture: {
    Treatment: { n: 1100, minFemale: 0.4, minYouth: 0.5 },
    Comparison: { n: 1100, minFemale: 0.4, minYouth: 0.5 },
  },
  SMEs: {
    Treatment: { n: 400, minFemale: 0.3, minYouth: 0.4 },
    Comparison: { n: 400, minFemale: 0.3, minYouth: 0.4 },
  },
  Households: {
    Treatment: { n: 200, targetFemale: 0.5, targetYouth: 0.5 },
    Comparison: { n: 200, targetFemale: 0.5, targetYouth: 0.5 },
  },
};
