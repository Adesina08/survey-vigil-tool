import type { DashboardData } from "@/types/dashboard";
import { QualityControlContent } from "@/components/dashboard/QualityControlContent";

interface QualityControlProps {
  dashboardData: DashboardData | undefined;
  selectedLga: string | null;
}

const QualityControl = ({ dashboardData, selectedLga }: QualityControlProps) => {
  if (!dashboardData) {
    return <div>Loading…</div>;
  }

  return (
    <QualityControlContent
      dashboardData={dashboardData}
      selectedLga={selectedLga}
    />
  );
};

export default QualityControl;
