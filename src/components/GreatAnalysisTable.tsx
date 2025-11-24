import { useMemo } from "react";

export type TableAlignment = "left" | "center" | "right" | undefined;

export interface ParsedTableCell {
  content: string;
  colSpan?: number;
  rowSpan?: number;
  isHeader?: boolean;
  align?: TableAlignment;
}

export interface ParsedTableRow {
  cells: ParsedTableCell[];
}

export interface ParsedTable {
  caption?: string;
  headerRows: ParsedTableRow[];
  bodyRows: ParsedTableRow[];
  footerRows: ParsedTableRow[];
}

const normaliseAlignment = (align?: string | null): TableAlignment => {
  if (!align) {
    return undefined;
  }
  const trimmed = align.trim().toLowerCase();
  if (trimmed === "left" || trimmed === "center" || trimmed === "right") {
    return trimmed;
  }
  return undefined;
};

const parseRows = (rows: NodeListOf<HTMLTableRowElement>, isHeader = false): ParsedTableRow[] => {
  const parsedRows: ParsedTableRow[] = [];

  rows.forEach((row) => {
    const cells: ParsedTableCell[] = [];
    row.querySelectorAll("th, td").forEach((cell) => {
      const content = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
      const align = normaliseAlignment(cell.getAttribute("align") ?? cell.style.textAlign);
      cells.push({
        content,
        colSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
        rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
        isHeader: cell.tagName.toLowerCase() === "th" || isHeader,
        align,
      });
    });
    parsedRows.push({ cells });
  });

  return parsedRows;
};

export const parseAnalysisTable = (html: string): ParsedTable => {
  if (typeof window === "undefined") {
    return { caption: undefined, headerRows: [], bodyRows: [], footerRows: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tableElement = doc.querySelector("table");

  if (!tableElement) {
    return { caption: undefined, headerRows: [], bodyRows: [], footerRows: [] };
  }

  const caption = tableElement.querySelector("caption")?.textContent?.trim();
  const headerRows = parseRows(tableElement.querySelectorAll("thead tr"), true);
  const bodyRows = parseRows(tableElement.querySelectorAll("tbody tr"));
  const footerRows = parseRows(tableElement.querySelectorAll("tfoot tr"));

  if (!headerRows.length && !bodyRows.length && !footerRows.length) {
    const looseRows = parseRows(tableElement.querySelectorAll("tr"));
    return { caption: caption || undefined, headerRows, bodyRows: looseRows, footerRows };
  }

  return { caption: caption || undefined, headerRows, bodyRows, footerRows };
};

const alignmentClassName = (align?: TableAlignment): string => {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
};

interface GreatAnalysisTableProps {
  table: ParsedTable;
}

const GreatAnalysisTable = ({ table }: GreatAnalysisTableProps) => {
  const hasHeader = table.headerRows.length > 0;
  const hasFooter = table.footerRows.length > 0;
  const hasBody = table.bodyRows.length > 0;

  const fallbackBody = useMemo(() => {
    if (hasBody) return table.bodyRows;
    if (hasHeader) return table.headerRows;
    return [];
  }, [hasBody, hasHeader, table.bodyRows, table.headerRows]);

  return (
    <div className="great-table-wrapper overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="great-table w-full border-separate border-spacing-0 text-sm text-slate-800">
        {table.caption && (
          <caption className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900">
            {table.caption}
          </caption>
        )}

        {hasHeader && (
          <thead className="bg-slate-50 text-slate-900">
            {table.headerRows.map((row, rowIndex) => (
              <tr key={`head-${rowIndex}`} className="border-b border-slate-200">
                {row.cells.map((cell, cellIndex) => (
                  <th
                    key={`head-${rowIndex}-${cellIndex}`}
                    className={`border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide last:border-r-0 ${alignmentClassName(cell.align)}`}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                  >
                    {cell.content}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}

        {hasBody && (
          <tbody>
            {table.bodyRows.map((row, rowIndex) => (
              <tr
                key={`body-${rowIndex}`}
                className={`border-b border-slate-200 ${rowIndex % 2 === 1 ? "bg-slate-50/80" : "bg-white"}`}
              >
                {row.cells.map((cell, cellIndex) => {
                  const CellTag = cell.isHeader ? "th" : "td";
                  return (
                    <CellTag
                      key={`body-${rowIndex}-${cellIndex}`}
                      className={`border-r border-slate-200 px-4 py-3 text-sm text-slate-800 last:border-r-0 ${alignmentClassName(cell.align)}`}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      scope={cell.isHeader ? "row" : undefined}
                    >
                      {cell.content}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        )}

        {!hasBody && fallbackBody.length > 0 && (
          <tbody>
            {fallbackBody.map((row, rowIndex) => (
              <tr key={`fallback-${rowIndex}`} className="border-b border-slate-200">
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`fallback-${rowIndex}-${cellIndex}`}
                    className={`border-r border-slate-200 px-4 py-3 text-sm text-slate-800 last:border-r-0 ${alignmentClassName(cell.align)}`}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                  >
                    {cell.content}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}

        {hasFooter && (
          <tfoot className="bg-slate-50/90 text-slate-900">
            {table.footerRows.map((row, rowIndex) => (
              <tr key={`foot-${rowIndex}`} className="border-t border-slate-200">
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`foot-${rowIndex}-${cellIndex}`}
                    className={`border-r border-slate-200 px-4 py-3 text-sm font-medium last:border-r-0 ${alignmentClassName(cell.align)}`}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                  >
                    {cell.content}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default GreatAnalysisTable;
