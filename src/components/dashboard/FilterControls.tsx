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
}

export function FilterControls({ lgas, onFilterChange }: FilterControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
      <Select onValueChange={(value) => onFilterChange("lga", value)}>
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
