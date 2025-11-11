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
      APPS_SCRIPT_URL: formatEnvValue(process.env.APPS_SCRIPT_URL),
      VITE_APPS_SCRIPT_URL: formatEnvValue(process.env.VITE_APPS_SCRIPT_URL),
    },
    timestamp: new Date().toISOString(),
  });
};
