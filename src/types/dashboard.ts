export type DashboardData = ReturnType<
  (typeof import("@/lib/dataTransformer"))["transformGoogleSheetsData"]
>;
