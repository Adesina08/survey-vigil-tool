export type ApprovalStatus = "Approved" | "Not Approved";
export type Gender = "Male" | "Female" | "Unknown";
export type AgeGroup = "15-24" | "25-34" | "35-44" | "45+" | "Unknown";
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
  id?: string;
  uuid?: string;
  lga?: string;
  ward?: string;
  interviewer?: string;
  submissionTime?: string;
  status?: string;
  approved?: boolean;
  notApproved?: boolean;
  lat?: number;
  lng?: number;
  "Submission ID": string;
  "Submission Date": string;
  "Submission Time": string;
  start?: string;
  end?: string;
  starttime?: string;
  endtime?: string;
  "A1. Enumerator ID": string;
  "Enumerator Name": string;
  "Interviewer ID"?: string;
  "Interviewer Name"?: string;
  username?: string;
  State: string;
  "A3. select the LGA": string;
  LGA?: string;
  deviceid?: string;
  imei?: string;
  subscriberid?: string;
  simserial?: string;
  "Age Group"?: AgeGroup;
  Gender?: Gender;
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
  _ageRaw?: number | string | null;
  _sexRaw?: string | null;
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

interface BaseSubmissionDefinition {
  enumeratorId: string;
  enumeratorName: string;
  lga: string;
  ageGroup: AgeGroup;
  gender: Gender;
  approved: number;
  notApproved: number;
  baseTimestamp: string;
  latitude: number;
  longitude: number;
  interviewLength: number;
  errorDistribution?: Partial<Record<ErrorType, number>>;
}

const padNumber = (value: number, length = 4) => value.toString().padStart(length, "0");

const formatDatePart = (date: Date) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1, 2);
  const day = padNumber(date.getDate(), 2);
  return `${year}-${month}-${day}`;
};

const formatTimePart = (date: Date) => {
  const hours = padNumber(date.getHours(), 2);
  const minutes = padNumber(date.getMinutes(), 2);
  return `${hours}:${minutes}`;
};

const jitterCoordinate = (value: number, index: number, scale = 0.0025) => {
  const offset = ((index % 5) - 2) * scale;
  return Number((value + offset).toFixed(5));
};

const baseDefinitions: BaseSubmissionDefinition[] = [];


let submissionCounter = 0;

export const sheetSubmissions: SheetSubmissionRow[] = baseDefinitions.flatMap((definition) => {
  const rows: SheetSubmissionRow[] = [];
  const baseDate = new Date(definition.baseTimestamp);
  const totalSubmissions = definition.approved + definition.notApproved;

  const buildRow = (status: ApprovalStatus, index: number): SheetSubmissionRow => {
    const timestamp = new Date(baseDate.getTime());
    timestamp.setMinutes(baseDate.getMinutes() + index);

    const latitude = jitterCoordinate(definition.latitude, index);
    const longitude = jitterCoordinate(definition.longitude, index);
    const endTimestamp = new Date(timestamp.getTime() + definition.interviewLength * 60000);

    const isoStart = timestamp.toISOString();
    const isoEnd = endTimestamp.toISOString();
    const phoneNumber =
      index % 9 === 0
        ? "08000000000"
        : `080${padNumber((submissionCounter + index) % 1_000_0000, 8)}`;
    const deviceId = `DEV-${definition.enumeratorId}`;

    submissionCounter += 1;

    return {
      "Submission ID": `OGN-${padNumber(submissionCounter, 5)}`,
      "Submission Date": formatDatePart(timestamp),
      "Submission Time": formatTimePart(timestamp),
      start: isoStart,
      end: isoEnd,
      starttime: isoStart,
      endtime: isoEnd,
      "A1. Enumerator ID": definition.enumeratorId,
      "Enumerator Name": definition.enumeratorName,
      "Interviewer ID": definition.enumeratorId,
      "Interviewer Name": definition.enumeratorName,
      username: definition.enumeratorId,
      State: "Ogun",
      "A3. select the LGA": definition.lga,
      LGA: definition.lga,
      deviceid: deviceId,
      imei: `${deviceId}-IMEI`,
      subscriberid: `${deviceId}-SUB`,
      simserial: `${deviceId}-SIM`,
      "Age Group": definition.ageGroup,
      Gender: definition.gender,
      "Approval Status": status,
      "Outcome Status": status === "Approved" ? "Valid" : "Invalid",
      "Error Flags": [],
      "Interview Length (mins)": definition.interviewLength,
      Resp_No: phoneNumber,
      "Respondent phone number": phoneNumber,
      "A5. GPS Coordinates": `${latitude}, ${longitude}`,
      "_A5. GPS Coordinates_latitude": latitude,
      "_A5. GPS Coordinates_longitude": longitude,
      Latitude: latitude,
      Longitude: longitude,
    };
  };

  for (let index = 0; index < definition.approved; index += 1) {
    rows.push(buildRow("Approved", index));
  }

  for (let index = definition.approved; index < totalSubmissions; index += 1) {
    rows.push(buildRow("Not Approved", index));
  }

  if (definition.errorDistribution) {
    const notApprovedRows = rows.filter(
      (row) => row["Approval Status"] === "Not Approved"
    );

    if (notApprovedRows.length > 0) {
      Object.entries(definition.errorDistribution).forEach(([errorType, count]) => {
        for (let index = 0; index < (count ?? 0); index += 1) {
          const targetRow = notApprovedRows[index % notApprovedRows.length];
          if (!targetRow["Error Flags"].includes(errorType as ErrorType)) {
            targetRow["Error Flags"].push(errorType as ErrorType);
          }
        }
      });
    }
  }

  return rows;
});

export const sheetStateTargets: SheetStateTargetRow[] = [
  { State: "Ogun", "State Target": 0 },
];

export const sheetStateAgeTargets: SheetStateAgeTargetRow[] = [
  { State: "Ogun", "Age Group": "15-24", "Age Group Target": 0 },
  { State: "Ogun", "Age Group": "25-34", "Age Group Target": 0 },
  { State: "Ogun", "Age Group": "35-44", "Age Group Target": 0 },
  { State: "Ogun", "Age Group": "45+", "Age Group Target": 0 },
];

export const sheetStateGenderTargets: SheetStateGenderTargetRow[] = [
  { State: "Ogun", Gender: "Male", "Gender Target": 0 },
  { State: "Ogun", Gender: "Female", "Gender Target": 0 },
];
