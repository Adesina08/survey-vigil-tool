import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterControlsProps {
  onFilterChange: (filterType: string, value: string) => void;
}

export function FilterControls({ onFilterChange }: FilterControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Select onValueChange={(value) => onFilterChange("state", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All States" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          <SelectItem value="lagos">Lagos</SelectItem>
          <SelectItem value="abuja">Abuja</SelectItem>
          <SelectItem value="kano">Kano</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange("lga", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All LGAs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All LGAs</SelectItem>
          <SelectItem value="ikeja">Ikeja</SelectItem>
          <SelectItem value="gwagwalada">Gwagwalada</SelectItem>
          <SelectItem value="nassarawa">Nassarawa</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange("ageGroup", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All Age Groups" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Age Groups</SelectItem>
          <SelectItem value="18-25">18-25</SelectItem>
          <SelectItem value="26-35">26-35</SelectItem>
          <SelectItem value="36-45">36-45</SelectItem>
          <SelectItem value="46+">46+</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange("gender", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All Genders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Genders</SelectItem>
          <SelectItem value="male">Male</SelectItem>
          <SelectItem value="female">Female</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange("errorType", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All Error Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Error Types</SelectItem>
          <SelectItem value="oddHour">Odd Hour</SelectItem>
          <SelectItem value="lowLOI">Low LOI</SelectItem>
          <SelectItem value="outsideLGA">Outside LGA</SelectItem>
          <SelectItem value="duplicate">Duplicate Phone</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange("interviewer", value)}>
        <SelectTrigger>
          <SelectValue placeholder="All Interviewers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Interviewers</SelectItem>
          <SelectItem value="int001">INT-001</SelectItem>
          <SelectItem value="int002">INT-002</SelectItem>
          <SelectItem value="int003">INT-003</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
