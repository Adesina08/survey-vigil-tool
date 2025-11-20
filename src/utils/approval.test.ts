import { describe, expect, it } from "bun:test";

import { determineApprovalCategory } from "./approval";

describe("normaliseCandidateWithCancellation", () => {
  const cancellationSamples = [
    { value: "CN", description: "short cancellation code" },
    { value: "CNL", description: "longer cancellation code" },
    { value: 2, description: "numeric cancellation code" },
  ];

  cancellationSamples.forEach(({ value, description }) => {
    it(`treats ${description} as Canceled`, () => {
      expect(determineApprovalCategory({ Approval: value })).toBe("Canceled");
    });
  });

  it("still buckets non-cancellation values as Not Approved when not truthy", () => {
    expect(determineApprovalCategory({ Approval: "No" })).toBe("Not Approved");
  });
});
