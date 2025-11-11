import { useMemo } from "react";

import {
  processSurveyRows,
  type ProcessedSurveyData,
  type SurveyRow,
} from "@/utils/qcMetrics";

export const useSurveyData = (rows: SurveyRow[] = []): ProcessedSurveyData =>
  useMemo(() => processSurveyRows(Array.isArray(rows) ? rows : []), [rows]);

