import { useCallback, useEffect, useMemo, useState } from "react";

import type { QCStatus } from "@/types/submission";

export interface QCOverrideRecord {
  status: QCStatus;
  officer: string;
  comment: string;
  timestamp: string;
}

const STORAGE_KEY = "qcOverrides";

const readOverridesFromStorage = (): Record<string, QCOverrideRecord> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return {};

    return Object.entries(parsed).reduce<Record<string, QCOverrideRecord>>((acc, [key, value]) => {
      if (!value || typeof value !== "object") return acc;
      const { status, officer, comment, timestamp } = value as Record<string, unknown>;
      if (status !== "approved" && status !== "not_approved") return acc;
      const officerString = typeof officer === "string" ? officer : "";
      const commentString = typeof comment === "string" ? comment : "";
      const timestampString = typeof timestamp === "string" ? timestamp : new Date().toISOString();
      acc[key] = {
        status,
        officer: officerString,
        comment: commentString,
        timestamp: timestampString,
      };
      return acc;
    }, {});
  } catch (error) {
    console.warn("Failed to parse QC overrides from localStorage", error);
    return {};
  }
};

const persistOverrides = (data: Record<string, QCOverrideRecord>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to persist QC overrides", error);
  }
};

export const useQcOverrides = () => {
  const [overrides, setOverrides] = useState<Record<string, QCOverrideRecord>>(() => readOverridesFromStorage());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setOverrides(readOverridesFromStorage());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setOverride = useCallback((id: string, record: QCOverrideRecord) => {
    setOverrides((current) => {
      const next = { ...current, [id]: record };
      persistOverrides(next);
      return next;
    });
  }, []);

  const removeOverride = useCallback((id: string) => {
    setOverrides((current) => {
      if (!(id in current)) return current;
      const { [id]: _removed, ...rest } = current;
      persistOverrides(rest);
      return rest;
    });
  }, []);

  const clearOverrides = useCallback(() => {
    setOverrides(() => {
      persistOverrides({});
      return {};
    });
  }, []);

  const hasOverrides = useMemo(() => Object.keys(overrides).length > 0, [overrides]);

  return {
    overrides,
    setOverride,
    removeOverride,
    clearOverrides,
    hasOverrides,
  };
};
