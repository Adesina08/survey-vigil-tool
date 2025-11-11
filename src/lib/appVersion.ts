const rawVersion = typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION
  ? String(import.meta.env.VITE_APP_VERSION)
  : "";

const trimmed = rawVersion.trim();

export const APP_VERSION = trimmed.length > 0 ? trimmed : "";

export const APP_VERSION_LABEL = APP_VERSION
  ? APP_VERSION.startsWith("v")
    ? APP_VERSION
    : `v${APP_VERSION}`
  : "";
