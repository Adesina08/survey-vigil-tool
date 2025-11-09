import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { QuotaTracker } from "@/components/dashboard/QuotaTracker";
import { ExportBar } from "@/components/dashboard/ExportBar";

const Index = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(
    new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(
        new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 2000);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    console.log(`Filter changed: ${filterType} = ${value}`);
    // Backend integration point for filtering
  };

  // Mock data - will be replaced with backend API calls
  const summaryData = {
    overallTarget: 5000,
    totalSubmissions: 3847,
    validSubmissions: 3245,
    validPercentage: 84.4,
    invalidSubmissions: 456,
    invalidPercentage: 11.9,
    forceApproved: 89,
    forceCancelled: 23,
    terminated: 146,
  };

  const statusBreakdown = {
    valid: 3245,
    invalid: 456,
    terminated: 146,
  };

  const quotaProgress = 64.9;

  const byStateData = [
    { state: "Lagos", target: 2000, achieved: 1687, balance: 313 },
    { state: "Abuja", target: 1500, achieved: 981, balance: 519 },
    { state: "Kano", target: 1500, achieved: 577, balance: 923 },
  ];

  const byStateAgeData = [
    { state: "Lagos", ageGroup: "18-25", target: 500, achieved: 421, balance: 79 },
    { state: "Lagos", ageGroup: "26-35", target: 500, achieved: 433, balance: 67 },
    { state: "Lagos", ageGroup: "36-45", target: 500, achieved: 412, balance: 88 },
    { state: "Lagos", ageGroup: "46+", target: 500, achieved: 421, balance: 79 },
    { state: "Abuja", ageGroup: "18-25", target: 375, achieved: 245, balance: 130 },
    { state: "Abuja", ageGroup: "26-35", target: 375, achieved: 251, balance: 124 },
  ];

  const byStateGenderData = [
    { state: "Lagos", gender: "Male", target: 1000, achieved: 843, balance: 157 },
    { state: "Lagos", gender: "Female", target: 1000, achieved: 844, balance: 156 },
    { state: "Abuja", gender: "Male", target: 750, achieved: 490, balance: 260 },
    { state: "Abuja", gender: "Female", target: 750, achieved: 491, balance: 259 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        lastRefreshed={lastRefreshed}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <FilterControls onFilterChange={handleFilterChange} />
        
        <SummaryCards data={summaryData} />
        
        <ProgressCharts
          quotaProgress={quotaProgress}
          statusBreakdown={statusBreakdown}
        />
        
        <QuotaTracker
          byState={byStateData}
          byStateAge={byStateAgeData}
          byStateGender={byStateGenderData}
        />
      </main>

      <ExportBar />
    </div>
  );
};

export default Index;
