import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { QuotaTracker } from "@/components/dashboard/QuotaTracker";
import { InteractiveMap } from "@/components/dashboard/InteractiveMap";
import { UserProductivity } from "@/components/dashboard/UserProductivity";
import { ErrorBreakdown } from "@/components/dashboard/ErrorBreakdown";
import { AchievementsTables } from "@/components/dashboard/AchievementsTables";
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

  // Mock data for map
  const mapSubmissions = [
    {
      id: "SUB-001",
      lat: 6.5244,
      lng: 3.3792,
      interviewer: "INT-001",
      lga: "Ikeja",
      state: "Lagos",
      errorTypes: [],
      timestamp: "2024-01-15 10:30 AM",
      status: "valid" as const,
    },
    {
      id: "SUB-002",
      lat: 6.4541,
      lng: 3.3947,
      interviewer: "INT-002",
      lga: "Lagos Island",
      state: "Lagos",
      errorTypes: ["Low LOI"],
      timestamp: "2024-01-15 11:45 AM",
      status: "invalid" as const,
    },
    {
      id: "SUB-003",
      lat: 9.0579,
      lng: 7.4951,
      interviewer: "INT-003",
      lga: "Gwagwalada",
      state: "Abuja",
      errorTypes: [],
      timestamp: "2024-01-15 09:15 AM",
      status: "valid" as const,
    },
    {
      id: "SUB-004",
      lat: 12.0022,
      lng: 8.5920,
      interviewer: "INT-004",
      lga: "Nassarawa",
      state: "Kano",
      errorTypes: ["Odd Hour", "Outside LGA"],
      timestamp: "2024-01-15 02:30 AM",
      status: "invalid" as const,
    },
    {
      id: "SUB-005",
      lat: 6.4474,
      lng: 3.4700,
      interviewer: "INT-001",
      lga: "Surulere",
      state: "Lagos",
      errorTypes: [],
      timestamp: "2024-01-15 03:20 PM",
      status: "terminated" as const,
    },
  ];

  // Mock data for user productivity
  const productivityData = [
    {
      interviewer: "INT-001",
      totalSubmissions: 487,
      oddHour: 12,
      lowLOI: 8,
      outsideLGA: 5,
      duplicate: 3,
      terminated: 15,
      totalErrors: 43,
    },
    {
      interviewer: "INT-002",
      totalSubmissions: 423,
      oddHour: 7,
      lowLOI: 11,
      outsideLGA: 4,
      duplicate: 2,
      terminated: 12,
      totalErrors: 36,
    },
    {
      interviewer: "INT-003",
      totalSubmissions: 398,
      oddHour: 15,
      lowLOI: 6,
      outsideLGA: 8,
      duplicate: 5,
      terminated: 18,
      totalErrors: 52,
    },
    {
      interviewer: "INT-004",
      totalSubmissions: 356,
      oddHour: 9,
      lowLOI: 14,
      outsideLGA: 3,
      duplicate: 1,
      terminated: 10,
      totalErrors: 37,
    },
    {
      interviewer: "INT-005",
      totalSubmissions: 312,
      oddHour: 5,
      lowLOI: 9,
      outsideLGA: 6,
      duplicate: 4,
      terminated: 8,
      totalErrors: 32,
    },
  ];

  // Mock data for error breakdown
  const errorBreakdownData = [
    { errorType: "Odd Hour", count: 127, percentage: 27.8 },
    { errorType: "Low LOI", count: 98, percentage: 21.5 },
    { errorType: "Outside LGA Boundary", count: 84, percentage: 18.4 },
    { errorType: "Duplicate Phone", count: 71, percentage: 15.6 },
    { errorType: "Terminated", count: 76, percentage: 16.7 },
  ];

  // Mock data for achievements
  const achievementsByState = [
    { state: "Lagos", total: 1687, valid: 1423, invalid: 189, percentageValid: 84.4 },
    { state: "Abuja", total: 981, valid: 834, invalid: 118, percentageValid: 85.0 },
    { state: "Kano", total: 577, valid: 488, invalid: 149, percentageValid: 84.6 },
  ];

  const achievementsByInterviewer = [
    { interviewer: "INT-001", total: 487, valid: 412, invalid: 60, percentageValid: 84.6 },
    { interviewer: "INT-002", total: 423, valid: 361, invalid: 50, percentageValid: 85.3 },
    { interviewer: "INT-003", total: 398, valid: 329, invalid: 51, percentageValid: 82.7 },
    { interviewer: "INT-004", total: 356, valid: 304, invalid: 42, percentageValid: 85.4 },
    { interviewer: "INT-005", total: 312, valid: 267, invalid: 37, percentageValid: 85.6 },
  ];

  const achievementsByLGA = [
    { lga: "Ikeja", state: "Lagos", total: 623, valid: 531, invalid: 72, percentageValid: 85.2 },
    { lga: "Lagos Island", state: "Lagos", total: 542, valid: 451, invalid: 69, percentageValid: 83.2 },
    { lga: "Gwagwalada", state: "Abuja", total: 481, valid: 411, invalid: 58, percentageValid: 85.4 },
    { lga: "Nassarawa", state: "Kano", total: 377, valid: 318, invalid: 47, percentageValid: 84.4 },
    { lga: "Surulere", state: "Lagos", total: 322, valid: 278, invalid: 36, percentageValid: 86.3 },
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
        
        <InteractiveMap submissions={mapSubmissions} />
        
        <QuotaTracker
          byState={byStateData}
          byStateAge={byStateAgeData}
          byStateGender={byStateGenderData}
        />
        
        <UserProductivity data={productivityData} />
        
        <ErrorBreakdown data={errorBreakdownData} />
        
        <AchievementsTables
          byState={achievementsByState}
          byInterviewer={achievementsByInterviewer}
          byLGA={achievementsByLGA}
        />
      </main>

      <ExportBar />
    </div>
  );
};

export default Index;
