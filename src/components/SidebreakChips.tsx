
import React from "react";
import { cn } from "@/lib/utils";

export interface SidebreakOption {
  key: string;
  label: string;
  group: string; // group label e.g., "SECTION B – PROGRAM EXPOSURE / PARTICIPATION"
}

interface SidebreakChipsProps {
  options: SidebreakOption[];
  value: string | null;
  onChange: (key: string | null) => void;
}

/** Horizontal, scrollable, single-select chip list grouped by sections */
const SidebreakChips: React.FC<SidebreakChipsProps> = ({ options, value, onChange }) => {
  // group by section
  const groups = options.reduce<Record<string, SidebreakOption[]>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 pr-2">
              {items.map((opt) => {
                const active = value === opt.key;
                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => onChange(active ? null : opt.key)}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SidebreakChips;
