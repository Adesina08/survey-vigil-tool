import type { DashboardData } from "@/types/dashboard";
import { QualityControlContent } from "@/components/dashboard/QualityControlContent";

interface QualityControlProps {
  dashboardData: DashboardData | undefined;
  onFilterChange: (filterType: string, value: string) => void;
  selectedLga: string | null;
}

const QualityControl = ({ dashboardData, onFilterChange, selectedLga }: QualityControlProps) => {
  if (!dashboardData) {
    return <div>Loading…</div>;
  }

  return (
    <QualityControlContent
      dashboardData={dashboardData}
      selectedLga={selectedLga}
      onFilterChange={onFilterChange}
    />
  );
};

export default QualityControl;
