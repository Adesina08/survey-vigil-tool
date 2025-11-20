export type ApprovalStatus = "Approved" | "Not Approved" | "Canceled";
export type Gender = "Male" | "Female" | "Unknown";
export type AgeGroup = "Youth" | ">35" | "Unknown";
export const AGE_GROUP_ORDER: AgeGroup[] = ["Youth", ">35", "Unknown"];
export const TARGET_AGE_GROUPS: AgeGroup[] = ["Youth", ">35"];
export type ErrorType =
  | "OddHour"
  | "Low LOI"
  | "High LOI"
  | "Outside LGA Boundary"
  | "DuplicatePhone"
  | "Interwoven"
  | "ShortGap"
  | "ClusteredInterview"
  | "Terminated";

export interface SheetSubmissionRow {
  _index?: number | string;
  _id?: string;
  _uuid?: string;
  _submission_time?: string;
  _submitted_by?: string;
  "Submission ID": string;
  "Submission Date": string;
  "Submission Time": string;
  start?: string;
  end?: string;
  today?: string;
  starttime?: string;
  endtime?: string;
  "A1. Enumerator ID": string;
  "Enumerator Name": string;
  "Interviewer ID"?: string;
  "Interviewer Name"?: string;
  username?: string;
  phonenumber?: string;
  interviewer?: string;
  State: string;
  "A3. select the LGA": string;
  LGA?: string;
  deviceid?: string;
  imei?: string;
  subscriberid?: string;
  simserial?: string;
  "Age Group"?: AgeGroup;
  Gender?: Gender;
  "Pillar. Interviewers,  kindly recruit the respondent into the right Pillar according to your target"?: string;
  Approval?: ApprovalStatus | string;
  "Approval Status"?: ApprovalStatus;
  "Outcome Status"?: "Valid" | "Invalid";
  "Error Flags": ErrorType[];
  "Interview Length (mins)": number;
  Resp_No?: string;
  "Respondent phone number"?: string;
  "A5. GPS Coordinates"?: string;
  "_A5. GPS Coordinates_latitude": number;
  "_A5. GPS Coordinates_longitude": number;
  Latitude?: number;
  Longitude?: number;
  _validation_status?: string;
  _status?: string;
  _notes?: unknown;
  __version__?: string;
  _tags?: string | string[];
}

export interface SheetStateTargetRow {
  State: string;
  "State Target": number;
}

export interface SheetStateAgeTargetRow {
  State: string;
  "Age Group": AgeGroup;
  "Age Group Target": number;
}

export interface SheetStateGenderTargetRow {
  State: string;
  Gender: Gender;
  "Gender Target": number;
}
