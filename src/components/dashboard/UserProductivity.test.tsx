import { describe, expect, it } from "vitest";
import {
  compareUserProductivityRows,
  getUserProductivitySortValue,
  type InterviewerData,
  type UserProductivitySortState,
} from "./UserProductivity";

const buildRow = (id: string, flagged: string): InterviewerData => ({
  interviewerId: id,
  interviewerName: id,
  displayLabel: id.toUpperCase(),
  totalSubmissions: 0,
  validSubmissions: 0,
  invalidSubmissions: flagged as unknown as number,
  approvalRate: 0,
  errors: {},
  totalErrors: 0,
});

describe("UserProductivity sorting", () => {
  it("sorts flagged interviews numerically when values arrive as strings", () => {
    const rows: InterviewerData[] = [
      buildRow("alpha", "1,200"),
      buildRow("bravo", "25"),
      buildRow("charlie", "3"),
    ];

    const ascending: UserProductivitySortState = {
      column: "invalidSubmissions",
      direction: "asc",
    };

    const sortedAscending = [...rows].sort((a, b) =>
      compareUserProductivityRows(a, b, ascending, getUserProductivitySortValue),
    );

    expect(sortedAscending.map((row) => row.interviewerId)).toEqual([
      "charlie",
      "bravo",
      "alpha",
    ]);

    const descending: UserProductivitySortState = {
      column: "invalidSubmissions",
      direction: "desc",
    };

    const sortedDescending = [...rows].sort((a, b) =>
      compareUserProductivityRows(a, b, descending, getUserProductivitySortValue),
    );

    expect(sortedDescending.map((row) => row.interviewerId)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
  });

  it("applies sort direction to tie-breakers when values are equal", () => {
    const rows: InterviewerData[] = [
      buildRow("bravo", "10"),
      buildRow("alpha", "10"),
      buildRow("charlie", "10"),
    ];

    const ascending: UserProductivitySortState = {
      column: "invalidSubmissions",
      direction: "asc",
    };

    const sortedAscending = [...rows].sort((a, b) =>
      compareUserProductivityRows(a, b, ascending, getUserProductivitySortValue),
    );

    expect(sortedAscending.map((row) => row.interviewerId)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);

    const descending: UserProductivitySortState = {
      column: "invalidSubmissions",
      direction: "desc",
    };

    const sortedDescending = [...rows].sort((a, b) =>
      compareUserProductivityRows(a, b, descending, getUserProductivitySortValue),
    );

    expect(sortedDescending.map((row) => row.interviewerId)).toEqual([
      "charlie",
      "bravo",
      "alpha",
    ]);
  });
});
