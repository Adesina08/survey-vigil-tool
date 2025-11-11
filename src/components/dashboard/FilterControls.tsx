import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterControlsProps {
  lgas: string[];
  onFilterChange: (filterType: string, value: string) => void;
  selectedLga?: string | null;
}

export function FilterControls({ lgas, onFilterChange, selectedLga }: FilterControlsProps) {
  const currentValue = selectedLga && selectedLga !== "all" ? selectedLga : "all";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={currentValue} onValueChange={(value) => onFilterChange("lga", value)}>
        <SelectTrigger className="min-w-[180px]">
          <SelectValue placeholder="All LGAs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All LGAs</SelectItem>
          {lgas.map((lga) => (
            <SelectItem key={lga} value={lga}>
              {lga}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
