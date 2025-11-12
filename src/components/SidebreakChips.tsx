import React from "react";
import { cn } from "@/lib/utils";

export interface SidebreakOption {
  key: string;
  label: string;
  group: string;
}

interface SidebreakChipsProps {
  options: SidebreakOption[];
  value: string | null;
  onChange: (key: string) => void;
}

/** Vertical, single-select list grouped by sections */
const SidebreakChips: React.FC<SidebreakChipsProps> = ({ options, value, onChange }) => {
  const groups = options.reduce<Record<string, SidebreakOption[]>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </div>
          <div className="flex flex-col gap-2">
            {items.map((opt) => {
              const active = value === opt.key;
              return (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => onChange(opt.key)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
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
      ))}
    </div>
  );
};

export default SidebreakChips;
