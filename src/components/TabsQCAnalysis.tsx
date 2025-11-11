import { type ReactNode, useState } from "react";

import Analysis from "@/pages/Analysis";

interface TabsQCAnalysisProps {
  qualityControl: ReactNode;
}

const TabsQCAnalysis = ({ qualityControl }: TabsQCAnalysisProps) => {
  const [activeTab, setActiveTab] = useState<"qc" | "analysis">("qc");

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("qc")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 ${
            activeTab === "qc"
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Quality Control
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analysis")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 ${
            activeTab === "analysis"
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Analysis
        </button>
      </div>

      <div className="pt-6">
        <section className={activeTab === "qc" ? "block" : "hidden"}>{qualityControl}</section>
        <section className={activeTab === "analysis" ? "block" : "hidden"}>
          <Analysis />
        </section>
      </div>
    </div>
  );
};

export default TabsQCAnalysis;
