import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatErrorLabel = (rawLabel: unknown): string => {
  if (rawLabel == null) {
    return "";
  }

  const label = String(rawLabel);

  if (!label) {
    return "";
  }

  return label
    .replace(/^QC[\s_-]*(?:FLAG|WARN)[\s_-]*/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};
