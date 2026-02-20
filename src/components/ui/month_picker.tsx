"use client";

import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

function buildMonthOptions(fromYear: number, toYear: number) {
  const options: Array<{ value: string; label: string }> = [];

  for (let year = fromYear; year <= toYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}`;
      const label = format(new Date(year, month - 1, 1), "LLLL yyyy", {
        locale: de,
      });
      options.push({ value, label });
    }
  }

  return options;
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Monat auswaehlen",
  disabled,
  className,
  fromYear = 2020,
  toYear = 2055,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
}) {
  const monthOptions = buildMonthOptions(fromYear, toYear);
  const hasCurrentValue = monthOptions.some((option) => option.value === value);

  return (
    <Select
      value={hasCurrentValue ? value : undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {monthOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
