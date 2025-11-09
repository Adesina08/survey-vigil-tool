export type ApprovalStatus = "Approved" | "Not Approved";
export type Gender = "Male" | "Female";
export type AgeGroup = "18-25" | "26-35" | "36-45" | "46+";
export type ErrorType =
  | "Odd Hour"
  | "Low LOI"
  | "Outside LGA Boundary"
  | "Duplicate Phone";

export interface SheetSubmissionRow {
  "Submission ID": string;
  "Submission Date": string;
  "Submission Time": string;
  "A1. Enumerator ID": string;
  "Enumerator Name": string;
  "Interviewer ID"?: string;
  "Interviewer Name"?: string;
  State: string;
  "A3. select the LGA": string;
  LGA?: string;
  "Age Group": AgeGroup;
  Gender: Gender;
  "Approval Status": ApprovalStatus;
  "Outcome Status"?: "Valid" | "Invalid";
  "Error Flags": ErrorType[];
  "Interview Length (mins)": number;
  "_A5. GPS Coordinates_latitude": number;
  "_A5. GPS Coordinates_longitude": number;
  Latitude?: number;
  Longitude?: number;
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

const baseDefinitions: BaseSubmissionDefinition[] = [
  {
    enumeratorId: "OGN-001",
    enumeratorName: "Adeola A.",
    lga: "Abeokuta North",
    ageGroup: "18-25",
    gender: "Female",
    approved: 32,
    notApproved: 6,
    baseTimestamp: "2024-02-01T08:00:00Z",
    latitude: 7.1606,
    longitude: 3.3501,
    interviewLength: 34,
    errorDistribution: {
      "Odd Hour": 3,
      "Low LOI": 2,
      "Outside LGA Boundary": 1,
    },
  },
  {
    enumeratorId: "OGN-001",
    enumeratorName: "Adeola A.",
    lga: "Abeokuta North",
    ageGroup: "26-35",
    gender: "Female",
    approved: 28,
    notApproved: 4,
    baseTimestamp: "2024-02-01T10:15:00Z",
    latitude: 7.1606,
    longitude: 3.3501,
    interviewLength: 33,
    errorDistribution: {
      "Odd Hour": 2,
      "Duplicate Phone": 1,
    },
  },
  {
    enumeratorId: "OGN-002",
    enumeratorName: "Tosin B.",
    lga: "Abeokuta South",
    ageGroup: "26-35",
    gender: "Male",
    approved: 30,
    notApproved: 6,
    baseTimestamp: "2024-02-02T09:00:00Z",
    latitude: 7.1475,
    longitude: 3.3619,
    interviewLength: 31,
    errorDistribution: {
      "Low LOI": 3,
      "Duplicate Phone": 2,
    },
  },
  {
    enumeratorId: "OGN-002",
    enumeratorName: "Tosin B.",
    lga: "Abeokuta South",
    ageGroup: "36-45",
    gender: "Male",
    approved: 25,
    notApproved: 6,
    baseTimestamp: "2024-02-02T11:20:00Z",
    latitude: 7.1475,
    longitude: 3.3619,
    interviewLength: 32,
    errorDistribution: {
      "Odd Hour": 2,
      "Outside LGA Boundary": 2,
    },
  },
  {
    enumeratorId: "OGN-003",
    enumeratorName: "Ibrahim C.",
    lga: "Sagamu",
    ageGroup: "18-25",
    gender: "Male",
    approved: 24,
    notApproved: 4,
    baseTimestamp: "2024-02-03T08:40:00Z",
    latitude: 6.8432,
    longitude: 3.6464,
    interviewLength: 30,
    errorDistribution: {
      "Odd Hour": 2,
      "Duplicate Phone": 1,
    },
  },
  {
    enumeratorId: "OGN-003",
    enumeratorName: "Ibrahim C.",
    lga: "Sagamu",
    ageGroup: "46+",
    gender: "Female",
    approved: 24,
    notApproved: 3,
    baseTimestamp: "2024-02-03T10:05:00Z",
    latitude: 6.8432,
    longitude: 3.6464,
    interviewLength: 29,
    errorDistribution: {
      "Low LOI": 2,
    },
  },
  {
    enumeratorId: "OGN-004",
    enumeratorName: "Sade D.",
    lga: "Ijebu Ode",
    ageGroup: "18-25",
    gender: "Female",
    approved: 26,
    notApproved: 5,
    baseTimestamp: "2024-02-04T09:30:00Z",
    latitude: 6.8198,
    longitude: 3.9173,
    interviewLength: 35,
    errorDistribution: {
      "Outside LGA Boundary": 2,
      "Duplicate Phone": 1,
    },
  },
  {
    enumeratorId: "OGN-004",
    enumeratorName: "Sade D.",
    lga: "Ijebu Ode",
    ageGroup: "36-45",
    gender: "Female",
    approved: 26,
    notApproved: 6,
    baseTimestamp: "2024-02-04T11:10:00Z",
    latitude: 6.8198,
    longitude: 3.9173,
    interviewLength: 34,
    errorDistribution: {
      "Odd Hour": 3,
      "Low LOI": 2,
    },
  },
  {
    enumeratorId: "OGN-005",
    enumeratorName: "Kunle E.",
    lga: "Ifo",
    ageGroup: "26-35",
    gender: "Female",
    approved: 27,
    notApproved: 4,
    baseTimestamp: "2024-02-05T08:15:00Z",
    latitude: 6.817,
    longitude: 3.195,
    interviewLength: 33,
    errorDistribution: {
      "Low LOI": 2,
    },
  },
  {
    enumeratorId: "OGN-005",
    enumeratorName: "Kunle E.",
    lga: "Ifo",
    ageGroup: "46+",
    gender: "Male",
    approved: 23,
    notApproved: 5,
    baseTimestamp: "2024-02-05T09:45:00Z",
    latitude: 6.817,
    longitude: 3.195,
    interviewLength: 31,
    errorDistribution: {
      "Odd Hour": 2,
      "Outside LGA Boundary": 1,
    },
  },
  {
    enumeratorId: "OGN-006",
    enumeratorName: "Yemi F.",
    lga: "Yewa South",
    ageGroup: "18-25",
    gender: "Male",
    approved: 22,
    notApproved: 4,
    baseTimestamp: "2024-02-06T08:50:00Z",
    latitude: 6.8904,
    longitude: 3.0171,
    interviewLength: 32,
    errorDistribution: {
      "Duplicate Phone": 2,
    },
  },
  {
    enumeratorId: "OGN-006",
    enumeratorName: "Yemi F.",
    lga: "Yewa South",
    ageGroup: "36-45",
    gender: "Male",
    approved: 25,
    notApproved: 4,
    baseTimestamp: "2024-02-06T10:20:00Z",
    latitude: 6.8904,
    longitude: 3.0171,
    interviewLength: 30,
    errorDistribution: {
      "Odd Hour": 2,
      "Low LOI": 1,
    },
  },
];

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

    submissionCounter += 1;

    return {
      "Submission ID": `OGN-${padNumber(submissionCounter, 5)}`,
      "Submission Date": formatDatePart(timestamp),
      "Submission Time": formatTimePart(timestamp),
      "A1. Enumerator ID": definition.enumeratorId,
      "Enumerator Name": definition.enumeratorName,
      "Interviewer ID": definition.enumeratorId,
      "Interviewer Name": definition.enumeratorName,
      State: "Ogun",
      "A3. select the LGA": definition.lga,
      LGA: definition.lga,
      "Age Group": definition.ageGroup,
      Gender: definition.gender,
      "Approval Status": status,
      "Outcome Status": status === "Approved" ? "Valid" : "Invalid",
      "Error Flags": [],
      "Interview Length (mins)": definition.interviewLength,
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
  { State: "Ogun", "State Target": 400 },
];

export const sheetStateAgeTargets: SheetStateAgeTargetRow[] = [
  { State: "Ogun", "Age Group": "18-25", "Age Group Target": 130 },
  { State: "Ogun", "Age Group": "26-35", "Age Group Target": 110 },
  { State: "Ogun", "Age Group": "36-45", "Age Group Target": 110 },
  { State: "Ogun", "Age Group": "46+", "Age Group Target": 80 },
];

export const sheetStateGenderTargets: SheetStateGenderTargetRow[] = [
  { State: "Ogun", Gender: "Male", "Gender Target": 200 },
  { State: "Ogun", Gender: "Female", "Gender Target": 200 },
];
