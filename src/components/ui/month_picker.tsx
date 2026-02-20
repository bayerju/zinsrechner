"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

const MONTH_INDICES = Array.from({ length: 12 }, (_, index) => index);

function parseMonthValue(
  value: string,
): { year: number; monthIndex: number } | null {
  if (!value) return null;
  const [yearRaw, monthRaw] = value.split("-").map(Number);
  if (!yearRaw || !monthRaw || monthRaw < 1 || monthRaw > 12) return null;
  return { year: yearRaw, monthIndex: monthRaw - 1 };
}

function toMonthValue(year: number, monthIndex: number) {
  return `${year.toString().padStart(4, "0")}-${(monthIndex + 1)
    .toString()
    .padStart(2, "0")}`;
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
  const parsed = parseMonthValue(value);
  const initialYear = parsed?.year ?? fromYear;
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() =>
    Math.min(toYear, Math.max(fromYear, initialYear)),
  );

  const monthLabel = useMemo(() => {
    if (!parsed) return placeholder;
    return format(new Date(parsed.year, parsed.monthIndex, 1), "LLLL yyyy", {
      locale: de,
    });
  }, [parsed, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between border-neutral-300 bg-white text-black hover:bg-neutral-50",
            className,
          )}
        >
          <span className={cn(!parsed && "text-neutral-500")}>
            {monthLabel}
          </span>
          <span className="text-xs text-neutral-500">Monat</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={visibleYear <= fromYear}
            onClick={() =>
              setVisibleYear((year) => Math.max(fromYear, year - 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{visibleYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={visibleYear >= toYear}
            onClick={() => setVisibleYear((year) => Math.min(toYear, year + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTH_INDICES.map((monthIndex) => {
            const monthDate = new Date(visibleYear, monthIndex, 1);
            const monthText = format(monthDate, "LLL", { locale: de });
            const monthValue = toMonthValue(visibleYear, monthIndex);
            const isSelected = value === monthValue;

            return (
              <Button
                key={monthValue}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => {
                  onChange(monthValue);
                  setOpen(false);
                }}
              >
                {monthText}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
