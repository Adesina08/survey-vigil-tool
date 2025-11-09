export const handler = async () => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const submissionsSheet = process.env.GOOGLE_SHEETS_SUBMISSIONS_SHEET;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      GOOGLE_SHEETS_ID: spreadsheetId ? "[set]" : "[missing]",
      GOOGLE_SHEETS_SUBMISSIONS_SHEET: submissionsSheet ?? "(missing)",
    }),
  };
};
