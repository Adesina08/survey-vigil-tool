// @vitest-environment jsdom
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { UserProductivity } from "./UserProductivity";

const sampleData = [
  {
    interviewerId: "charlie",
    displayLabel: "Charlie",
    totalSubmissions: 12,
    validSubmissions: 6,
    invalidSubmissions: 6,
    approvalRate: 50,
    errors: { missingField: 3 },
    totalErrors: 3,
  },
  {
    interviewerId: "alpha",
    displayLabel: "Alpha",
    totalSubmissions: 10,
    validSubmissions: 8,
    invalidSubmissions: 2,
    approvalRate: 80,
    errors: { missingField: 1 },
    totalErrors: 1,
  },
  {
    interviewerId: "bravo",
    displayLabel: "Bravo",
    totalSubmissions: 5,
    validSubmissions: 5,
    invalidSubmissions: 0,
    approvalRate: 100,
    errors: { missingField: 5 },
    totalErrors: 5,
  },
];

const renderComponent = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <UserProductivity
        data={sampleData}
        errorTypes={["missingField"]}
        errorLabels={{ missingField: "Missing Field" }}
      />,
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const clickElementByText = (container: HTMLElement, text: string) => {
  const element = Array.from(container.querySelectorAll("button, th")).find((node) =>
    node.textContent?.trim().includes(text),
  );

  expect(element).toBeDefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const readInterviewerOrder = (container: HTMLElement) => {
  const table = container.querySelector("[data-testid='submission-quality-table']") as HTMLTableElement | null;
  expect(table).toBeTruthy();

  const rows = table?.querySelectorAll("tbody tr") ?? [];
  return Array.from(rows).map((row) => row.querySelector("td")?.textContent?.trim());
};

describe("UserProductivity table sorting", () => {
  it("sorts string columns when headers are clicked", () => {
    const { container, cleanup } = renderComponent();

    clickElementByText(container, "Table");
    clickElementByText(container, "Interviewer ID");
    expect(readInterviewerOrder(container)).toEqual(["Alpha", "Bravo", "Charlie"]);

    clickElementByText(container, "Interviewer ID");
    expect(readInterviewerOrder(container)).toEqual(["Charlie", "Bravo", "Alpha"]);

    cleanup();
  });

  it("sorts dynamic numeric error columns", () => {
    const { container, cleanup } = renderComponent();

    clickElementByText(container, "Table");
    clickElementByText(container, "Missing Field");
    expect(readInterviewerOrder(container)).toEqual(["Bravo", "Charlie", "Alpha"]);

    clickElementByText(container, "Missing Field");
    expect(readInterviewerOrder(container)).toEqual(["Alpha", "Charlie", "Bravo"]);

    cleanup();
  });
});
