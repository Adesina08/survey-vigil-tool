import * as XLSX from "xlsx";

interface ExportData {
  topbreak: string;
  variable: string;
  rows: Array<Record<string, string | number>>;
  stat: string;
}

const parseHtmlTable = (html: string): Array<Record<string, string | number>> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  
  if (!table) {
    return [];
  }

  const headers: string[] = [];
  const headerRow = table.querySelector("thead tr");
  if (headerRow) {
    headerRow.querySelectorAll("th").forEach((th) => {
      headers.push(th.textContent?.trim() || "");
    });
  }

  const rows: Array<Record<string, string | number>> = [];
  const bodyRows = table.querySelectorAll("tbody tr");
  
  bodyRows.forEach((tr) => {
    const row: Record<string, string | number> = {};
    tr.querySelectorAll("td").forEach((td, index) => {
      const header = headers[index] || `Column ${index + 1}`;
      const text = td.textContent?.trim() || "";
      
      // Try to parse as number if it looks numeric
      const numMatch = text.match(/^[\d,]+\.?\d*$/);
      if (numMatch) {
        row[header] = parseFloat(text.replace(/,/g, ""));
      } else {
        row[header] = text;
      }
    });
    rows.push(row);
  });

  return rows;
};

export const exportAnalysisToCSV = (
  html: string,
  topbreak: string,
  variable: string,
  stat: string
): void => {
  const rows = parseHtmlTable(html);
  
  if (rows.length === 0) {
    console.error("No data to export");
    return;
  }

  // Convert to CSV
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      // Escape values that contain commas or quotes
      if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(","));
  }

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `analysis_${topbreak}_by_${variable}_${stat}.csv`;
  
  downloadBlob(blob, filename);
};

export const exportAnalysisToExcel = (
  html: string,
  topbreak: string,
  variable: string,
  stat: string
): void => {
  const rows = parseHtmlTable(html);
  
  if (rows.length === 0) {
    console.error("No data to export");
    return;
  }

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Analysis");

  // Auto-size columns
  const maxWidths: Record<string, number> = {};
  Object.keys(rows[0]).forEach((header) => {
    maxWidths[header] = header.length;
  });

  rows.forEach((row) => {
    Object.entries(row).forEach(([header, value]) => {
      const valueLength = String(value).length;
      if (valueLength > maxWidths[header]) {
        maxWidths[header] = valueLength;
      }
    });
  });

  worksheet["!cols"] = Object.values(maxWidths).map((width) => ({
    wch: Math.min(width + 2, 50),
  }));

  // Generate and download
  const filename = `analysis_${topbreak}_by_${variable}_${stat}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
