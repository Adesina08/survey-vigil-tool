export type QCStatus = "approved" | "not_approved";

export type ErrorType =
  | "Low LOI"
  | "High LOI"
  | "OddHour"
  | "DuplicatePhone"
  | "Interwoven"
  | "ShortGap"
  | "Terminated"
  | "Force Cancelled"
  | "Outside LGA Boundary"
  | "ClusteredInterview";

export interface MapSubmission {
  id: string;
  lat: number | null;
  lng: number | null;
  interviewerId: string;
  interviewerName: string;
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: QCStatus;
}
