import { Button } from "@/components/ui/button";
import type { MapSubmission } from "@/types/submission";

interface ExportBarProps {
  submissions: MapSubmission[];
}

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  return [headerLine, ...dataLines].join("\r\n");
};

const triggerDownload = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatTimestamp = () => {
  const date = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

export function ExportBar({ submissions }: ExportBarProps) {
  const handleExportAll = () => {
    const headers = [
      "id",
      "timestamp",
      "status",
      "interviewerId",
      "interviewerName",
      "state",
      "lga",
      "latitude",
      "longitude",
      "errors",
    ];
    const rows = submissions.map((submission) => ({
      id: submission.id,
      timestamp: submission.timestamp,
      status: submission.status,
      interviewerId: submission.interviewerId,
      interviewerName: submission.interviewerName,
      state: submission.state,
      lga: submission.lga,
      latitude: submission.lat,
      longitude: submission.lng,
      errors: submission.errorTypes.join(" | "),
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `stream_qc_all_${formatTimestamp()}.csv`);
  };

  const handleExportStatus = (status: "approved" | "not_approved") => {
    const filtered = submissions.filter((submission) => submission.status === status);
    const headers = ["id", "timestamp", "interviewerId", "state", "lga", "errors"];
    const rows = filtered.map((submission) => ({
      id: submission.id,
      timestamp: submission.timestamp,
      interviewerId: submission.interviewerId,
      state: submission.state,
      lga: submission.lga,
      errors: submission.errorTypes.join(" | "),
    }));
    const csv = buildCsv(headers, rows);
    if (rows.length === 0) {
      // Ensure the file still contains headers when there are no rows.
      const headerOnly = buildCsv(headers, []);
      triggerDownload(headerOnly, `stream_qc_${status}_${formatTimestamp()}.csv`);
      return;
    }
    triggerDownload(csv, `stream_qc_${status}_${formatTimestamp()}.csv`);
  };

  const handleExportFlags = () => {
    const headers = ["id", "flag", "timestamp", "state", "lga", "interviewerId"];
    const rows: Array<Record<string, unknown>> = [];
    submissions.forEach((submission) => {
      submission.errorTypes.forEach((error) => {
        rows.push({
          id: submission.id,
          flag: error,
          timestamp: submission.timestamp,
          state: submission.state,
          lga: submission.lga,
          interviewerId: submission.interviewerId,
        });
      });
    });
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `stream_qc_flags_${formatTimestamp()}.csv`);
  };

  const handleExportGeotagging = () => {
    const headers = ["id", "lat", "lng", "state", "lga"];
    const rows = submissions.map((submission) => ({
      id: submission.id,
      lat: submission.lat,
      lng: submission.lng,
      state: submission.state,
      lga: submission.lga,
    }));
    const csv = buildCsv(headers, rows);
    triggerDownload(csv, `stream_qc_geotagging_${formatTimestamp()}.csv`);
  };

  return (
    <div className="sticky bottom-0 z-20 border-t bg-card/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex flex-wrap justify-center gap-2">
        <Button onClick={handleExportAll} className="gap-2">
          Export All
        </Button>
        <Button variant="outline" onClick={() => handleExportStatus("approved")} className="gap-2">
          Export Approved
        </Button>
        <Button variant="outline" onClick={() => handleExportStatus("not_approved")} className="gap-2">
          Export Not Approved
        </Button>
        <Button variant="outline" onClick={handleExportFlags} className="gap-2">
          Export Flags Only
        </Button>
        <Button variant="outline" onClick={handleExportGeotagging} className="gap-2">
          Export Geotagging
        </Button>
      </div>
    </div>
  );
}
