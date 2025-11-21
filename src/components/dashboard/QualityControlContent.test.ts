import { describe, expect, it } from "vitest";
import { computeKpiMetrics } from "./QualityControlContent";

const minimalDashboardData = {
  quotaByLGA: [],
  summary: { overallTarget: 0 },
};

describe("computeKpiMetrics", () => {
  it("counts canceled submissions even when wrong version or consent issues are present", () => {
    const rows = [
      {
        Approval: "Canceled",
        "QC_FLAG_wrong_version": 1,
        "A6. Consent to participate": "No",
      },
    ];

    const { summary, statusBreakdown } = computeKpiMetrics(rows, minimalDashboardData, null);

    expect(summary.canceledSubmissions).toBe(1);
    expect(statusBreakdown.canceled).toBe(1);
    expect(summary.wrongVersionFlagCount).toBe(1);
    expect(summary.validSubmissions).toBe(1);
  });
});
