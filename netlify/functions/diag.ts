const jsonResponse = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload, null, 2),
});

const formatEnvValue = (value: string | undefined) => {
  if (!value) {
    return { present: false };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { present: true, empty: true };
  }

  const previewLength = 4;
  const prefix = trimmed.slice(0, previewLength);
  const suffix = trimmed.slice(-previewLength);
  return {
    present: true,
    length: trimmed.length,
    preview: `${prefix}…${suffix}`,
  };
};

export const handler = async () => {
  return jsonResponse(200, {
    env: {
      GOOGLE_SHEETS_ID: formatEnvValue(process.env.GOOGLE_SHEETS_ID),
      GOOGLE_SHEETS_SUBMISSIONS_SHEET: formatEnvValue(process.env.GOOGLE_SHEETS_SUBMISSIONS_SHEET),
      GOOGLE_SHEETS_DEFAULT_STATE: formatEnvValue(process.env.GOOGLE_SHEETS_DEFAULT_STATE),
      GOOGLE_SHEETS_STATE_TARGETS_SHEET: formatEnvValue(process.env.GOOGLE_SHEETS_STATE_TARGETS_SHEET),
      GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET: formatEnvValue(process.env.GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET),
      GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET: formatEnvValue(
        process.env.GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET,
      ),
    },
    timestamp: new Date().toISOString(),
  });
};
