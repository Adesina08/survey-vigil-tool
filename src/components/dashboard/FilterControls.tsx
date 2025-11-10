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
    <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
      <Select value={currentValue} onValueChange={(value) => onFilterChange("lga", value)}>
        <SelectTrigger>
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
