export type Status = "Valid" | "Invalid" | "Terminated";
export type Gender = "Male" | "Female";
export type AgeGroup = "18-25" | "26-35" | "36-45" | "46+";
export type ErrorType = "Odd Hour" | "Low LOI" | "Outside LGA" | "Duplicate";

export interface SheetSubmissionRow {
  "Submission ID": string;
  "Submission Date": string;
  "Submission Time": string;
  "Interviewer ID": string;
  "Interviewer Name": string;
  State: string;
  LGA: string;
  "Age Group": AgeGroup;
  Gender: Gender;
  "Outcome Status": Status;
  "Force Approved": "Yes" | "No";
  "Force Cancelled": "Yes" | "No";
  Terminated: "Yes" | "No";
  "Odd Hour Flag": "Yes" | "No";
  "Low LOI Flag": "Yes" | "No";
  "Outside LGA Flag": "Yes" | "No";
  "Duplicate Flag": "Yes" | "No";
  "Interview Length (mins)": number;
  Latitude: number;
  Longitude: number;
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
  interviewerId: string;
  interviewerName: string;
  state: string;
  lga: string;
  ageGroup: AgeGroup;
  gender: Gender;
  status: Status;
  count: number;
  baseTimestamp: string;
  latitude: number;
  longitude: number;
  interviewLength: number;
  forceApproved?: number;
  forceCancelled?: number;
  errorCounts?: Partial<Record<ErrorType, number>>;
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

const ERROR_COLUMN_MAP: Record<ErrorType, keyof SheetSubmissionRow> = {
  "Odd Hour": "Odd Hour Flag",
  "Low LOI": "Low LOI Flag",
  "Outside LGA": "Outside LGA Flag",
  Duplicate: "Duplicate Flag",
};

const baseDefinitions: BaseSubmissionDefinition[] = [
  // Lagos valid submissions
  {
    interviewerId: "INT-001",
    interviewerName: "Amaka I.",
    state: "Lagos",
    lga: "Ikeja",
    ageGroup: "18-25",
    gender: "Female",
    status: "Valid",
    count: 421,
    baseTimestamp: "2024-01-15T08:00:00Z",
    latitude: 6.6018,
    longitude: 3.3515,
    interviewLength: 34,
    forceApproved: 10,
  },
  {
    interviewerId: "INT-002",
    interviewerName: "Bisi A.",
    state: "Lagos",
    lga: "Surulere",
    ageGroup: "26-35",
    gender: "Male",
    status: "Valid",
    count: 433,
    baseTimestamp: "2024-01-15T08:10:00Z",
    latitude: 6.5013,
    longitude: 3.3560,
    interviewLength: 36,
    forceApproved: 10,
  },
  {
    interviewerId: "INT-001",
    interviewerName: "Amaka I.",
    state: "Lagos",
    lga: "Ikeja",
    ageGroup: "36-45",
    gender: "Female",
    status: "Valid",
    count: 412,
    baseTimestamp: "2024-01-15T08:20:00Z",
    latitude: 6.6018,
    longitude: 3.3515,
    interviewLength: 35,
    forceApproved: 10,
  },
  {
    interviewerId: "INT-002",
    interviewerName: "Bisi A.",
    state: "Lagos",
    lga: "Eti-Osa",
    ageGroup: "46+",
    gender: "Male",
    status: "Valid",
    count: 421,
    baseTimestamp: "2024-01-15T08:30:00Z",
    latitude: 6.4592,
    longitude: 3.6015,
    interviewLength: 37,
    forceApproved: 10,
  },
  // Abuja valid submissions
  {
    interviewerId: "INT-003",
    interviewerName: "Chinedu K.",
    state: "FCT Abuja",
    lga: "Gwagwalada",
    ageGroup: "18-25",
    gender: "Female",
    status: "Valid",
    count: 245,
    baseTimestamp: "2024-01-16T09:15:00Z",
    latitude: 8.9620,
    longitude: 7.0795,
    interviewLength: 33,
    forceApproved: 7,
  },
  {
    interviewerId: "INT-004",
    interviewerName: "Dami S.",
    state: "FCT Abuja",
    lga: "Bwari",
    ageGroup: "26-35",
    gender: "Male",
    status: "Valid",
    count: 251,
    baseTimestamp: "2024-01-16T09:25:00Z",
    latitude: 9.3056,
    longitude: 7.3878,
    interviewLength: 32,
    forceApproved: 7,
  },
  {
    interviewerId: "INT-003",
    interviewerName: "Chinedu K.",
    state: "FCT Abuja",
    lga: "Abaji",
    ageGroup: "36-45",
    gender: "Female",
    status: "Valid",
    count: 242,
    baseTimestamp: "2024-01-16T09:35:00Z",
    latitude: 8.4754,
    longitude: 6.9443,
    interviewLength: 34,
    forceApproved: 7,
  },
  {
    interviewerId: "INT-004",
    interviewerName: "Dami S.",
    state: "FCT Abuja",
    lga: "Kuje",
    ageGroup: "46+",
    gender: "Male",
    status: "Valid",
    count: 243,
    baseTimestamp: "2024-01-16T09:45:00Z",
    latitude: 8.8795,
    longitude: 7.2299,
    interviewLength: 35,
    forceApproved: 7,
  },
  // Kano valid submissions
  {
    interviewerId: "INT-005",
    interviewerName: "Farida M.",
    state: "Kano",
    lga: "Nassarawa",
    ageGroup: "18-25",
    gender: "Female",
    status: "Valid",
    count: 180,
    baseTimestamp: "2024-01-17T10:10:00Z",
    latitude: 12.0022,
    longitude: 8.5920,
    interviewLength: 32,
    forceApproved: 6,
  },
  {
    interviewerId: "INT-006",
    interviewerName: "Gambo Y.",
    state: "Kano",
    lga: "Tarauni",
    ageGroup: "26-35",
    gender: "Male",
    status: "Valid",
    count: 142,
    baseTimestamp: "2024-01-17T10:20:00Z",
    latitude: 12.0041,
    longitude: 8.5619,
    interviewLength: 33,
    forceApproved: 5,
  },
  {
    interviewerId: "INT-005",
    interviewerName: "Farida M.",
    state: "Kano",
    lga: "Gwale",
    ageGroup: "36-45",
    gender: "Female",
    status: "Valid",
    count: 130,
    baseTimestamp: "2024-01-17T10:30:00Z",
    latitude: 11.9986,
    longitude: 8.5167,
    interviewLength: 31,
    forceApproved: 5,
  },
  {
    interviewerId: "INT-006",
    interviewerName: "Gambo Y.",
    state: "Kano",
    lga: "Kumbotso",
    ageGroup: "46+",
    gender: "Male",
    status: "Valid",
    count: 125,
    baseTimestamp: "2024-01-17T10:40:00Z",
    latitude: 11.8900,
    longitude: 8.5556,
    interviewLength: 34,
    forceApproved: 5,
  },
  // Lagos invalid submissions
  {
    interviewerId: "INT-001",
    interviewerName: "Amaka I.",
    state: "Lagos",
    lga: "Surulere",
    ageGroup: "18-25",
    gender: "Female",
    status: "Invalid",
    count: 60,
    baseTimestamp: "2024-01-18T07:30:00Z",
    latitude: 6.5013,
    longitude: 3.3560,
    interviewLength: 18,
    forceCancelled: 3,
    errorCounts: { "Odd Hour": 60 },
  },
  {
    interviewerId: "INT-002",
    interviewerName: "Bisi A.",
    state: "Lagos",
    lga: "Ikeja",
    ageGroup: "26-35",
    gender: "Male",
    status: "Invalid",
    count: 70,
    baseTimestamp: "2024-01-18T07:40:00Z",
    latitude: 6.6018,
    longitude: 3.3515,
    interviewLength: 17,
    forceCancelled: 3,
    errorCounts: { "Low LOI": 70 },
  },
  {
    interviewerId: "INT-001",
    interviewerName: "Amaka I.",
    state: "Lagos",
    lga: "Ikeja",
    ageGroup: "36-45",
    gender: "Female",
    status: "Invalid",
    count: 59,
    baseTimestamp: "2024-01-18T07:50:00Z",
    latitude: 6.6018,
    longitude: 3.3515,
    interviewLength: 19,
    forceCancelled: 3,
    errorCounts: { "Outside LGA": 40, Duplicate: 19 },
  },
  // Abuja invalid submissions
  {
    interviewerId: "INT-003",
    interviewerName: "Chinedu K.",
    state: "FCT Abuja",
    lga: "Bwari",
    ageGroup: "18-25",
    gender: "Female",
    status: "Invalid",
    count: 40,
    baseTimestamp: "2024-01-18T08:00:00Z",
    latitude: 9.3056,
    longitude: 7.3878,
    interviewLength: 16,
    forceCancelled: 2,
    errorCounts: { "Odd Hour": 20, "Low LOI": 20 },
  },
  {
    interviewerId: "INT-004",
    interviewerName: "Dami S.",
    state: "FCT Abuja",
    lga: "Gwagwalada",
    ageGroup: "26-35",
    gender: "Male",
    status: "Invalid",
    count: 40,
    baseTimestamp: "2024-01-18T08:10:00Z",
    latitude: 8.9620,
    longitude: 7.0795,
    interviewLength: 17,
    forceCancelled: 2,
    errorCounts: { "Outside LGA": 20, Duplicate: 20 },
  },
  {
    interviewerId: "INT-003",
    interviewerName: "Chinedu K.",
    state: "FCT Abuja",
    lga: "Kuje",
    ageGroup: "36-45",
    gender: "Female",
    status: "Invalid",
    count: 38,
    baseTimestamp: "2024-01-18T08:20:00Z",
    latitude: 8.8795,
    longitude: 7.2299,
    interviewLength: 17,
    forceCancelled: 3,
    errorCounts: { "Low LOI": 18, Duplicate: 20 },
  },
  // Kano invalid submissions
  {
    interviewerId: "INT-005",
    interviewerName: "Farida M.",
    state: "Kano",
    lga: "Tarauni",
    ageGroup: "18-25",
    gender: "Female",
    status: "Invalid",
    count: 50,
    baseTimestamp: "2024-01-18T08:30:00Z",
    latitude: 12.0041,
    longitude: 8.5619,
    interviewLength: 18,
    forceCancelled: 2,
    errorCounts: { "Odd Hour": 30, "Outside LGA": 20 },
  },
  {
    interviewerId: "INT-006",
    interviewerName: "Gambo Y.",
    state: "Kano",
    lga: "Nassarawa",
    ageGroup: "26-35",
    gender: "Male",
    status: "Invalid",
    count: 49,
    baseTimestamp: "2024-01-18T08:40:00Z",
    latitude: 12.0022,
    longitude: 8.5920,
    interviewLength: 18,
    forceCancelled: 2,
    errorCounts: { "Low LOI": 25, Duplicate: 24 },
  },
  {
    interviewerId: "INT-005",
    interviewerName: "Farida M.",
    state: "Kano",
    lga: "Gwale",
    ageGroup: "36-45",
    gender: "Female",
    status: "Invalid",
    count: 50,
    baseTimestamp: "2024-01-18T08:50:00Z",
    latitude: 11.9986,
    longitude: 8.5167,
    interviewLength: 17,
    forceCancelled: 3,
    errorCounts: { "Outside LGA": 30, Duplicate: 20 },
  },
  // Lagos terminated submissions
  {
    interviewerId: "INT-002",
    interviewerName: "Bisi A.",
    state: "Lagos",
    lga: "Eti-Osa",
    ageGroup: "26-35",
    gender: "Male",
    status: "Terminated",
    count: 32,
    baseTimestamp: "2024-01-19T06:45:00Z",
    latitude: 6.4592,
    longitude: 3.6015,
    interviewLength: 9,
  },
  {
    interviewerId: "INT-001",
    interviewerName: "Amaka I.",
    state: "Lagos",
    lga: "Ikeja",
    ageGroup: "46+",
    gender: "Female",
    status: "Terminated",
    count: 33,
    baseTimestamp: "2024-01-19T06:55:00Z",
    latitude: 6.6018,
    longitude: 3.3515,
    interviewLength: 10,
  },
  // Abuja terminated submissions
  {
    interviewerId: "INT-003",
    interviewerName: "Chinedu K.",
    state: "FCT Abuja",
    lga: "Abaji",
    ageGroup: "36-45",
    gender: "Female",
    status: "Terminated",
    count: 20,
    baseTimestamp: "2024-01-19T07:05:00Z",
    latitude: 8.4754,
    longitude: 6.9443,
    interviewLength: 9,
  },
  {
    interviewerId: "INT-004",
    interviewerName: "Dami S.",
    state: "FCT Abuja",
    lga: "Gwagwalada",
    ageGroup: "26-35",
    gender: "Male",
    status: "Terminated",
    count: 18,
    baseTimestamp: "2024-01-19T07:15:00Z",
    latitude: 8.9620,
    longitude: 7.0795,
    interviewLength: 9,
  },
  // Kano terminated submissions
  {
    interviewerId: "INT-005",
    interviewerName: "Farida M.",
    state: "Kano",
    lga: "Kumbotso",
    ageGroup: "46+",
    gender: "Female",
    status: "Terminated",
    count: 22,
    baseTimestamp: "2024-01-19T07:25:00Z",
    latitude: 11.8900,
    longitude: 8.5556,
    interviewLength: 8,
  },
  {
    interviewerId: "INT-006",
    interviewerName: "Gambo Y.",
    state: "Kano",
    lga: "Tarauni",
    ageGroup: "18-25",
    gender: "Male",
    status: "Terminated",
    count: 21,
    baseTimestamp: "2024-01-19T07:35:00Z",
    latitude: 12.0041,
    longitude: 8.5619,
    interviewLength: 8,
  },
];

let submissionCounter = 0;

export const sheetSubmissions: SheetSubmissionRow[] = baseDefinitions.flatMap((definition) => {
  const rows: SheetSubmissionRow[] = [];
  const baseDate = new Date(definition.baseTimestamp);
  const forceApprovedLimit = Math.min(definition.forceApproved ?? 0, definition.count);
  const forceCancelledLimit = Math.min(definition.forceCancelled ?? 0, definition.count);

  for (let index = 0; index < definition.count; index += 1) {
    submissionCounter += 1;
    const timestamp = new Date(baseDate.getTime());
    timestamp.setMinutes(baseDate.getMinutes() + index);

    const row: SheetSubmissionRow = {
      "Submission ID": `SUB-${padNumber(submissionCounter, 4)}`,
      "Submission Date": formatDatePart(timestamp),
      "Submission Time": formatTimePart(timestamp),
      "Interviewer ID": definition.interviewerId,
      "Interviewer Name": definition.interviewerName,
      State: definition.state,
      LGA: definition.lga,
      "Age Group": definition.ageGroup,
      Gender: definition.gender,
      "Outcome Status": definition.status,
      "Force Approved": index < forceApprovedLimit ? "Yes" : "No",
      "Force Cancelled": index < forceCancelledLimit ? "Yes" : "No",
      Terminated: definition.status === "Terminated" ? "Yes" : "No",
      "Odd Hour Flag": "No",
      "Low LOI Flag": "No",
      "Outside LGA Flag": "No",
      "Duplicate Flag": "No",
      "Interview Length (mins)": definition.interviewLength,
      Latitude: definition.latitude,
      Longitude: definition.longitude,
    };

    rows.push(row);
  }

  if (definition.errorCounts) {
    (Object.entries(definition.errorCounts) as Array<[ErrorType, number]>).forEach(([errorType, count]) => {
      const limit = Math.min(count, rows.length);
      for (let i = 0; i < limit; i += 1) {
        const targetRow = rows[i % rows.length];
        targetRow[ERROR_COLUMN_MAP[errorType]] = "Yes";
      }
    });
  }

  return rows;
});

export const sheetStateTargets: SheetStateTargetRow[] = [
  { State: "Lagos", "State Target": 2000 },
  { State: "FCT Abuja", "State Target": 1500 },
  { State: "Kano", "State Target": 1500 },
];

export const sheetStateAgeTargets: SheetStateAgeTargetRow[] = [
  { State: "Lagos", "Age Group": "18-25", "Age Group Target": 500 },
  { State: "Lagos", "Age Group": "26-35", "Age Group Target": 500 },
  { State: "Lagos", "Age Group": "36-45", "Age Group Target": 500 },
  { State: "Lagos", "Age Group": "46+", "Age Group Target": 500 },
  { State: "FCT Abuja", "Age Group": "18-25", "Age Group Target": 375 },
  { State: "FCT Abuja", "Age Group": "26-35", "Age Group Target": 375 },
  { State: "FCT Abuja", "Age Group": "36-45", "Age Group Target": 375 },
  { State: "FCT Abuja", "Age Group": "46+", "Age Group Target": 375 },
  { State: "Kano", "Age Group": "18-25", "Age Group Target": 375 },
  { State: "Kano", "Age Group": "26-35", "Age Group Target": 375 },
  { State: "Kano", "Age Group": "36-45", "Age Group Target": 375 },
  { State: "Kano", "Age Group": "46+", "Age Group Target": 375 },
];

export const sheetStateGenderTargets: SheetStateGenderTargetRow[] = [
  { State: "Lagos", Gender: "Male", "Gender Target": 1000 },
  { State: "Lagos", Gender: "Female", "Gender Target": 1000 },
  { State: "FCT Abuja", Gender: "Male", "Gender Target": 750 },
  { State: "FCT Abuja", Gender: "Female", "Gender Target": 750 },
  { State: "Kano", Gender: "Male", "Gender Target": 750 },
  { State: "Kano", Gender: "Female", "Gender Target": 750 },
];

